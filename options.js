/* global MarketPulseUtils */
const BRSAPI_KEY_STORAGE_KEY = "brsApiKey";
const CRYPTO_WATCHLIST_KEY = "cryptoWatchlist";
const COINGECKO_SEARCH_URL = "https://api.coingecko.com/api/v3/search";
const SEARCH_TIMEOUT_MS = 5000;

const POPULAR_COINS = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "solana", name: "Solana", symbol: "SOL" },
  { id: "cardano", name: "Cardano", symbol: "ADA" },
  { id: "ripple", name: "XRP", symbol: "XRP" },
  { id: "dogecoin", name: "Dogecoin", symbol: "DOGE" },
  { id: "polkadot", name: "Polkadot", symbol: "DOT" },
  { id: "avalanche-2", name: "Avalanche", symbol: "AVAX" },
  { id: "chainlink", name: "Chainlink", symbol: "LINK" },
  { id: "polygon-ecosystem-token", name: "Polygon", symbol: "POL" },
  { id: "shiba-inu", name: "Shiba Inu", symbol: "SHIB" },
  { id: "litecoin", name: "Litecoin", symbol: "LTC" },
  { id: "uniswap", name: "Uniswap", symbol: "UNI" },
  { id: "near", name: "NEAR Protocol", symbol: "NEAR" },
  { id: "tron", name: "TRON", symbol: "TRX" },
  { id: "the-open-network", name: "Toncoin", symbol: "TON" },
  { id: "sui", name: "Sui", symbol: "SUI" },
  { id: "aptos", name: "Aptos", symbol: "APT" },
  { id: "pepe", name: "Pepe", symbol: "PEPE" },
  { id: "stellar", name: "Stellar", symbol: "XLM" },
  { id: "monero", name: "Monero", symbol: "XMR" },
  { id: "cosmos", name: "Cosmos", symbol: "ATOM" },
  { id: "hedera-hashgraph", name: "Hedera", symbol: "HBAR" },
  { id: "kaspa", name: "Kaspa", symbol: "KAS" },
  { id: "render-token", name: "Render", symbol: "RENDER" }
];

const elements = {
  keyInput: document.querySelector("#brsapi-key"),
  status: document.querySelector("#status"),
  saveButton: document.querySelector("#save"),
  removeButton: document.querySelector("#remove"),
  watchlistCount: document.querySelector("#watchlist-count"),
  restoreDefaultsBtn: document.querySelector("#restore-defaults"),
  watchlistList: document.querySelector("#watchlist-list"),
  showAddBtn: document.querySelector("#show-add-btn"),
  searchModal: document.querySelector("#search-modal"),
  coinSearchInput: document.querySelector("#coin-search-input"),
  closeSearchBtn: document.querySelector("#close-search-btn"),
  searchResults: document.querySelector("#search-results")
};

let currentWatchlist = [];
let searchDebounceTimeout = null;
let searchRequestId = 0;

async function requestRefresh() {
  try {
    await chrome.runtime.sendMessage({ type: "refresh-now" });
  } catch (_error) {
    // Settings remain saved even if the service worker is restarting.
  }
}

async function loadSettings() {
  const data = await chrome.storage.local.get([
    BRSAPI_KEY_STORAGE_KEY,
    CRYPTO_WATCHLIST_KEY
  ]);

  elements.keyInput.value = typeof data[BRSAPI_KEY_STORAGE_KEY] === "string"
    ? data[BRSAPI_KEY_STORAGE_KEY]
    : "";

  currentWatchlist = MarketPulseUtils.validateWatchlist(data[CRYPTO_WATCHLIST_KEY]);

  // Persist the defaults once so the storage model is explicit for new users.
  if (data[CRYPTO_WATCHLIST_KEY] === undefined) {
    await chrome.storage.local.set({ [CRYPTO_WATCHLIST_KEY]: currentWatchlist });
  }

  renderWatchlist();
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.dataset.state = isError ? "error" : "success";
}

async function saveWatchlist(newWatchlist, message = "Watchlist saved.") {
  currentWatchlist = MarketPulseUtils.validateWatchlist(newWatchlist);

  await chrome.storage.local.set({ [CRYPTO_WATCHLIST_KEY]: currentWatchlist });
  renderWatchlist();

  if (elements.coinSearchInput.value) {
    void renderSearchResults(elements.coinSearchInput.value);
  }

  showStatus(`${message} Refreshing market data…`);
  await requestRefresh();
  showStatus(message);
}

function renderWatchlist() {
  elements.watchlistList.replaceChildren();

  const count = currentWatchlist.length;
  elements.watchlistCount.textContent = `${count} / ${MarketPulseUtils.MAX_CRYPTO_WATCHLIST} selected`;
  elements.showAddBtn.disabled = count >= MarketPulseUtils.MAX_CRYPTO_WATCHLIST;

  if (count === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.className = "watchlist-item";
    emptyLi.textContent = "No cryptocurrencies selected.";
    elements.watchlistList.appendChild(emptyLi);
    return;
  }

  currentWatchlist.forEach((coin, index) => {
    const li = document.createElement("li");
    li.className = "watchlist-item";

    const info = document.createElement("div");
    info.className = "coin-info";

    const nameSpan = document.createElement("strong");
    nameSpan.textContent = coin.name;

    const symbolSpan = document.createElement("span");
    symbolSpan.className = "coin-symbol";
    symbolSpan.textContent = coin.symbol;

    info.append(nameSpan, symbolSpan);

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "secondary icon-button";
    upBtn.textContent = "↑";
    upBtn.setAttribute("aria-label", `Move ${coin.name} up`);
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => void moveCoin(index, -1));

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "secondary icon-button";
    downBtn.textContent = "↓";
    downBtn.setAttribute("aria-label", `Move ${coin.name} down`);
    downBtn.disabled = index === count - 1;
    downBtn.addEventListener("click", () => void moveCoin(index, 1));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "secondary text-button";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove ${coin.name}`);
    removeBtn.addEventListener("click", () => void removeCoin(index));

    actions.append(upBtn, downBtn, removeBtn);
    li.append(info, actions);
    elements.watchlistList.appendChild(li);
  });
}

async function moveCoin(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= currentWatchlist.length) return;

  const updated = currentWatchlist.slice();
  const [moved] = updated.splice(index, 1);
  updated.splice(targetIndex, 0, moved);
  await saveWatchlist(updated, "Watchlist reordered.");
}

async function removeCoin(index) {
  const updated = currentWatchlist.slice();
  const [removed] = updated.splice(index, 1);
  if (!removed) return;
  await saveWatchlist(updated, `Removed ${removed.name}.`);
}

function dedupeCoins(coins) {
  const seen = new Set();
  return coins.filter((coin) => {
    if (!coin || seen.has(coin.id)) return false;
    seen.add(coin.id);
    return true;
  });
}

async function searchCoinGecko(query) {
  const q = query.trim().toLowerCase();

  if (!q) {
    return POPULAR_COINS.slice(0, 10);
  }

  const matched = POPULAR_COINS.filter((coin) =>
    coin.name.toLowerCase().includes(q) ||
    coin.symbol.toLowerCase().includes(q) ||
    coin.id.toLowerCase().includes(q)
  );

  if (matched.length > 0) {
    return matched.slice(0, 10);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${COINGECKO_SEARCH_URL}?query=${encodeURIComponent(q)}`,
      { cache: "no-store", signal: controller.signal }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const coins = Array.isArray(data?.coins) ? data.coins : [];

    return dedupeCoins(coins.slice(0, 10).map((coin) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol ? coin.symbol.toUpperCase() : String(coin.id || "").toUpperCase()
    })));
  } catch (_error) {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function renderSearchResults(query) {
  const requestId = ++searchRequestId;
  elements.searchResults.replaceChildren();

  const loading = document.createElement("div");
  loading.className = "search-result-item";
  loading.textContent = "Searching…";
  elements.searchResults.appendChild(loading);

  const results = await searchCoinGecko(query);
  if (requestId !== searchRequestId) return;

  elements.searchResults.replaceChildren();

  if (!results.length) {
    const empty = document.createElement("div");
    empty.className = "search-result-item";
    empty.textContent = "No cryptocurrencies found.";
    elements.searchResults.appendChild(empty);
    return;
  }

  const selectedIds = new Set(currentWatchlist.map((coin) => coin.id));
  const maxReached = currentWatchlist.length >= MarketPulseUtils.MAX_CRYPTO_WATCHLIST;

  results.forEach((coin) => {
    const item = document.createElement("div");
    item.className = "search-result-item";

    const info = document.createElement("div");
    info.className = "coin-info";

    const nameSpan = document.createElement("strong");
    nameSpan.textContent = coin.name;

    const symbolSpan = document.createElement("span");
    symbolSpan.className = "coin-symbol";
    symbolSpan.textContent = coin.symbol;
    info.append(nameSpan, symbolSpan);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "text-button";

    if (selectedIds.has(coin.id)) {
      addBtn.textContent = "Added";
      addBtn.disabled = true;
    } else if (maxReached) {
      addBtn.textContent = "Add";
      addBtn.disabled = true;
      addBtn.title = "Maximum 3 cryptocurrencies allowed";
    } else {
      addBtn.textContent = "Add";
      addBtn.addEventListener("click", () => {
        if (currentWatchlist.length >= MarketPulseUtils.MAX_CRYPTO_WATCHLIST) return;
        if (currentWatchlist.some((selected) => selected.id === coin.id)) return;
        void saveWatchlist([...currentWatchlist, coin], `Added ${coin.name}.`);
      });
    }

    item.append(info, addBtn);
    elements.searchResults.appendChild(item);
  });
}

function closeSearch() {
  elements.searchModal.classList.add("hidden");
  searchRequestId += 1;
}

async function saveBRSAPIKey() {
  const key = elements.keyInput.value.trim();
  if (!key) {
    showStatus("Paste a key first, or use Remove key.", true);
    return;
  }

  elements.saveButton.disabled = true;
  try {
    await chrome.storage.local.set({ [BRSAPI_KEY_STORAGE_KEY]: key });
    showStatus("Saved. Refreshing market data…");
    await requestRefresh();
    showStatus("Key saved locally. Open the popup to see Toman prices.");
  } catch (_error) {
    showStatus("Could not save the key. Please try again.", true);
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function removeBRSAPIKey() {
  elements.removeButton.disabled = true;
  try {
    await chrome.storage.local.remove(BRSAPI_KEY_STORAGE_KEY);
    elements.keyInput.value = "";
    showStatus("Key removed. Refreshing market data…");
    await requestRefresh();
    showStatus("Key removed from this Chrome profile.");
  } catch (_error) {
    showStatus("Could not remove the key. Please try again.", true);
  } finally {
    elements.removeButton.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadSettings().catch(() => {
    showStatus("Could not load settings. Please reload the page.", true);
  });

  elements.saveButton.addEventListener("click", () => void saveBRSAPIKey());
  elements.removeButton.addEventListener("click", () => void removeBRSAPIKey());

  elements.restoreDefaultsBtn.addEventListener("click", () => {
    void saveWatchlist(
      MarketPulseUtils.CRYPTO_DEFAULTS,
      "Restored default cryptocurrencies."
    );
  });

  elements.showAddBtn.addEventListener("click", () => {
    elements.searchModal.classList.remove("hidden");
    elements.coinSearchInput.value = "";
    elements.coinSearchInput.focus();
    void renderSearchResults("");
  });

  elements.closeSearchBtn.addEventListener("click", closeSearch);

  elements.coinSearchInput.addEventListener("input", (event) => {
    const value = event.target.value;
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
      void renderSearchResults(value);
    }, 250);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.searchModal.classList.contains("hidden")) {
      closeSearch();
    }
  });
});
