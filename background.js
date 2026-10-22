/* global MarketPulseUtils */
importScripts("utils.js");

const GOLD_URL = "https://api.gold-api.com/price/XAU";
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/simple/price";
const BRSAPI_BASE_URL = "https://Api.BrsApi.ir/Market/Gold_Currency.php";

const CACHE_KEY = "marketPulseCache";
const BRSAPI_KEY_STORAGE_KEY = "brsApiKey";
const CRYPTO_WATCHLIST_KEY = "cryptoWatchlist";
const REFRESH_ALARM = "market-pulse-refresh";
const REFRESH_PERIOD_MINUTES = 30;
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;
const CRYPTO_REQUEST_TIMEOUT_MS = 5000;

async function fetchJson(url, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGold() {
  const data = await fetchJson(GOLD_URL);
  const ounceUsd = MarketPulseUtils.toFiniteNumber(data?.price);

  if (ounceUsd === null) {
    throw new Error("Gold API response did not contain a valid price.");
  }

  return {
    ounceUsd,
    gram24kUsd: MarketPulseUtils.calculateGram24kUsd(ounceUsd)
  };
}

async function fetchCrypto(watchlist) {
  if (!watchlist.length) {
    return {};
  }

  const ids = watchlist.map((item) => item.id).join(",");
  const url = new URL(COINGECKO_BASE_URL);
  url.searchParams.set("ids", ids);
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("include_24hr_change", "true");

  const data = await fetchJson(url.toString(), CRYPTO_REQUEST_TIMEOUT_MS);
  const result = {};

  for (const coin of watchlist) {
    const coinData = data?.[coin.id];
    if (!coinData || typeof coinData !== "object") {
      continue;
    }

    result[coin.id] = {
      usd: MarketPulseUtils.toFiniteNumber(coinData.usd),
      change24h: MarketPulseUtils.toFiniteNumber(coinData.usd_24h_change)
    };
  }

  return result;
}

function requestFailureLabel(error) {
  const message = error instanceof Error ? error.message : "";
  const status = message.match(/status\s+(\d{3})/i)?.[1];
  if (status) return `HTTP ${status}`;
  if (/timed out/i.test(message)) return "timed out";
  return "network error";
}

async function fetchToman(apiKey) {
  if (!apiKey) {
    return null;
  }

  const url = new URL(BRSAPI_BASE_URL);
  url.searchParams.set("key", apiKey);

  const data = await fetchJson(url.toString());
  const currencies = Array.isArray(data?.currency) ? data.currency : [];
  const usdt = currencies.find((item) => item?.symbol === "USDT_IRT");
  const toman = MarketPulseUtils.toFiniteNumber(usdt?.price);

  if (toman === null) {
    throw new Error("USDT_IRT was not present in the BRSAPI response.");
  }

  return {
    usdtToman: toman,
    changePercent: MarketPulseUtils.toFiniteNumber(usdt?.change_percent)
  };
}

async function updateBadge(gold) {
  const text = MarketPulseUtils.getBadgeText(gold?.ounceUsd);
  try {
    await chrome.action.setBadgeText({ text });
    if (text) {
      await chrome.action.setBadgeBackgroundColor({ color: "#C99632" });
    }
  } catch (error) {
    console.warn("Market Pulse could not update its toolbar badge.", error);
  }
}

async function refreshMarketData() {
  const storage = await chrome.storage.local.get([
    BRSAPI_KEY_STORAGE_KEY,
    CRYPTO_WATCHLIST_KEY,
    CACHE_KEY
  ]);

  const brsApiKey = storage[BRSAPI_KEY_STORAGE_KEY] || "";
  const watchlist = MarketPulseUtils.validateWatchlist(storage[CRYPTO_WATCHLIST_KEY]);
  const previousCache = storage[CACHE_KEY] || {};
  const tomanKey = typeof brsApiKey === "string" ? brsApiKey.trim() : "";

  const [goldResult, cryptoResult, tomanResult] = await Promise.allSettled([
    fetchGold(),
    fetchCrypto(watchlist),
    fetchToman(tomanKey)
  ]);

  const cache = { timestamp: Date.now(), errors: {} };

  if (goldResult.status === "fulfilled") {
    cache.gold = goldResult.value;
  } else {
    cache.errors.gold = requestFailureLabel(goldResult.reason);
    if (previousCache.gold) {
      cache.gold = previousCache.gold;
    }
  }

  if (cryptoResult.status === "fulfilled") {
    cache.crypto = cryptoResult.value;
  } else {
    const reason = requestFailureLabel(cryptoResult.reason);
    if (previousCache.crypto) {
      // Keep the last confirmed crypto snapshot during temporary outages or rate limits.
      cache.crypto = previousCache.crypto;
    }
    // A 429 is expected rate limiting, so avoid turning it into a noisy popup error.
    if (reason !== "HTTP 429") {
      cache.errors.crypto = reason;
    }
  }

  if (tomanResult.status === "fulfilled" && tomanResult.value) {
    cache.toman = tomanResult.value;
  } else if (tomanResult.status === "rejected") {
    cache.errors.toman = "unavailable";
  }

  await chrome.storage.local.set({ [CACHE_KEY]: cache });
  await updateBadge(cache.gold);
  return cache;
}

async function safeRefreshMarketData(context = "background refresh") {
  try {
    return await refreshMarketData();
  } catch (error) {
    console.error(`Market Pulse ${context} failed:`, error);
    return null;
  }
}

async function initialize() {
  await chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_PERIOD_MINUTES
  });
  await safeRefreshMarketData("initialization");
}

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void initialize();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void safeRefreshMarketData("scheduled refresh");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "refresh-now") {
    return false;
  }

  void (async () => {
    try {
      const cache = await refreshMarketData();
      sendResponse({ ok: true, cache });
    } catch (error) {
      console.error("Market Pulse refresh failed before the cache could be saved.", error);
      sendResponse({ ok: false, error: "Background refresh failed." });
    }
  })();

  return true;
});
