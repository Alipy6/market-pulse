/* global MarketPulseUtils */
const CACHE_KEY = "marketPulseCache";
const CRYPTO_WATCHLIST_KEY = "cryptoWatchlist";

const elements = {
  status: document.querySelector("#status"),
  goldOunce: document.querySelector("#gold-ounce"),
  gold24k: document.querySelector("#gold-24k"),
  gold18kUsd: document.querySelector("#gold-18k-usd"),
  usdtToman: document.querySelector("#usdt-toman"),
  usdtChange: document.querySelector("#usdt-change"),
  gold18kToman: document.querySelector("#gold-18k-toman"),
  tomanNote: document.querySelector("#toman-note"),
  cryptoContainer: document.querySelector("#crypto-container"),
  lastUpdated: document.querySelector("#last-updated"),
  refreshButton: document.querySelector("#refresh-button")
};

function relativeTime(timestamp) {
  if (!timestamp) {
    return "Not updated yet";
  }

  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Updated just now";
  if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `Updated ${Math.floor(seconds / 3600)}h ago`;
  return `Updated ${Math.floor(seconds / 86400)}d ago`;
}

function setChange(element, value) {
  element.textContent = MarketPulseUtils.formatPercent(value);
  element.classList.remove("positive", "negative");
  const numericValue = MarketPulseUtils.toFiniteNumber(value);
  if (numericValue > 0) element.classList.add("positive");
  if (numericValue < 0) element.classList.add("negative");
}

function renderCrypto(crypto, watchlist) {
  elements.cryptoContainer.innerHTML = "";
  const validWatchlist = MarketPulseUtils.validateWatchlist(watchlist);

  if (!validWatchlist.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "crypto-empty";
    emptyDiv.innerHTML = `
      <p class="subtle">No cryptocurrencies selected.</p>
      <a href="options.html" target="_blank" class="settings-inline-link">Configure watchlist</a>
    `;
    elements.cryptoContainer.appendChild(emptyDiv);
    return;
  }

  for (const coin of validWatchlist) {
    const coinData = crypto?.[coin.id];
    const row = document.createElement("div");
    row.className = "crypto-row";

    const details = document.createElement("div");
    const nameSpan = document.createElement("span");
    nameSpan.className = "coin-name";
    nameSpan.textContent = coin.name;
    const priceStrong = document.createElement("strong");
    priceStrong.textContent = MarketPulseUtils.formatUsd(coinData?.usd, 2);
    details.appendChild(nameSpan);
    details.appendChild(priceStrong);

    const changeSpan = document.createElement("span");
    changeSpan.className = "change";
    setChange(changeSpan, coinData?.change24h);

    row.appendChild(details);
    row.appendChild(changeSpan);
    elements.cryptoContainer.appendChild(row);
  }
}

function render(cache, watchlist) {
  const gold = cache?.gold;
  const gram24kUsd = gold?.gram24kUsd;
  const gram18kUsd = MarketPulseUtils.toFiniteNumber(gram24kUsd) === null
    ? null
    : gram24kUsd * MarketPulseUtils.GOLD_18K_PURITY;

  elements.goldOunce.textContent = MarketPulseUtils.formatUsd(gold?.ounceUsd, 2);
  elements.gold24k.textContent = MarketPulseUtils.formatUsd(gram24kUsd, 2);
  elements.gold18kUsd.textContent = MarketPulseUtils.formatUsd(gram18kUsd, 2);

  const toman = cache?.toman;
  elements.usdtToman.textContent = MarketPulseUtils.formatToman(toman?.usdtToman);
  setChange(elements.usdtChange, toman?.changePercent);
  elements.gold18kToman.textContent = MarketPulseUtils.formatToman(
    MarketPulseUtils.calculate18kGoldToman(gram24kUsd, toman?.usdtToman)
  );
  elements.tomanNote.hidden = Boolean(toman);

  renderCrypto(cache?.crypto, watchlist);
  elements.lastUpdated.textContent = relativeTime(cache?.timestamp);

  const errors = Object.entries(cache?.errors || {});
  const unavailableSources = errors
    .map(([source, reason]) => `${source} (${reason})`)
    .join(", ");
  if (!cache?.timestamp) {
    elements.status.textContent = "No cached prices yet. Use Refresh to try again.";
    elements.status.classList.add("error");
  } else if (errors.length) {
    elements.status.textContent = `Temporarily unavailable: ${unavailableSources}.`;
    elements.status.classList.add("error");
  } else {
    elements.status.textContent = "Prices are cached in the background.";
    elements.status.classList.remove("error");
  }
}

async function loadCachedData() {
  const { [CACHE_KEY]: cache, [CRYPTO_WATCHLIST_KEY]: rawWatchlist } =
    await chrome.storage.local.get([CACHE_KEY, CRYPTO_WATCHLIST_KEY]);
  const watchlist = MarketPulseUtils.validateWatchlist(rawWatchlist);
  render(cache, watchlist);
}

async function refreshNow() {
  elements.refreshButton.disabled = true;
  elements.refreshButton.textContent = "Refreshing…";

  try {
    const response = await chrome.runtime.sendMessage({ type: "refresh-now" });
    if (!response?.ok) {
      throw new Error(response?.error || "Background worker did not return a response.");
    }

    const { [CRYPTO_WATCHLIST_KEY]: rawWatchlist } =
      await chrome.storage.local.get(CRYPTO_WATCHLIST_KEY);
    const watchlist = MarketPulseUtils.validateWatchlist(rawWatchlist);

    // Render the returned data immediately; storage.onChanged remains a backup.
    render(response.cache, watchlist);
  } catch (error) {
    console.error("Market Pulse manual refresh failed:", error);
    await loadCachedData();

    const detail = error instanceof Error ? error.message : String(error);
    elements.status.textContent = `Could not refresh: ${detail}`;
    elements.status.classList.add("error");
  } finally {
    elements.refreshButton.disabled = false;
    elements.refreshButton.textContent = "↻ Refresh";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadCachedData();
  elements.refreshButton.addEventListener("click", () => void refreshNow());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes[CACHE_KEY] || changes[CRYPTO_WATCHLIST_KEY])) {
    void loadCachedData();
  }
});
