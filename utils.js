(function attachMarketPulseUtils(globalScope) {
  "use strict";

  const TROY_OUNCE_GRAMS = 31.1034768;
  const GOLD_18K_PURITY = 0.75;
  const MAX_CRYPTO_WATCHLIST = 3;

  const CRYPTO_DEFAULTS = Object.freeze([
    Object.freeze({ id: "bitcoin", name: "Bitcoin", symbol: "BTC" }),
    Object.freeze({ id: "ethereum", name: "Ethereum", symbol: "ETH" })
  ]);

  function toFiniteNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function calculateGram24kUsd(ounceUsd) {
    const ounce = toFiniteNumber(ounceUsd);
    return ounce === null || ounce <= 0 ? null : ounce / TROY_OUNCE_GRAMS;
  }

  function calculate18kGoldToman(gram24kUsd, usdtToman) {
    const gram24k = toFiniteNumber(gram24kUsd);
    const toman = toFiniteNumber(usdtToman);

    if (gram24k === null || toman === null || gram24k <= 0 || toman <= 0) {
      return null;
    }

    return gram24k * toman * GOLD_18K_PURITY;
  }

  function formatUsd(value, maximumFractionDigits = 2) {
    const amount = toFiniteNumber(value);

    if (amount === null) {
      return "—";
    }

    const maxDigits = Number.isInteger(maximumFractionDigits)
      ? Math.min(Math.max(maximumFractionDigits, 0), 20)
      : 2;

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: maxDigits,
      maximumFractionDigits: maxDigits
    }).format(amount);
  }

  function formatToman(value) {
    const amount = toFiniteNumber(value);

    if (amount === null || amount <= 0) {
      return "—";
    }

    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(Math.round(amount))} Toman`;
  }

  function formatPercent(value) {
    const percentage = toFiniteNumber(value);

    if (percentage === null) {
      return "—";
    }

    return `${percentage > 0 ? "+" : ""}${percentage.toFixed(2)}%`;
  }

  function getBadgeText(ounceUsd, maxLength = 4) {
    const ounce = toFiniteNumber(ounceUsd);

    if (ounce === null || ounce <= 0) {
      return "";
    }

    const limit = Number.isInteger(maxLength)
      ? Math.max(maxLength, 1)
      : 4;

    return String(Math.round(ounce)).slice(0, limit);
  }

  function normalizeCoin(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const id = typeof item.id === "string" ? item.id.trim().toLowerCase() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const symbol = typeof item.symbol === "string" ? item.symbol.trim() : "";

    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(id) || !name) {
      return null;
    }

    return {
      id,
      name: name.slice(0, 80),
      symbol: (symbol || id).toUpperCase().slice(0, 20)
    };
  }

  function validateWatchlist(watchlist) {
    if (watchlist === undefined || watchlist === null) {
      return CRYPTO_DEFAULTS.map((coin) => ({ ...coin }));
    }

    if (!Array.isArray(watchlist)) {
      return CRYPTO_DEFAULTS.map((coin) => ({ ...coin }));
    }

    const ids = new Set();
    const valid = [];

    for (const item of watchlist) {
      const coin = normalizeCoin(item);
      if (!coin || ids.has(coin.id)) {
        continue;
      }

      ids.add(coin.id);
      valid.push(coin);

      if (valid.length >= MAX_CRYPTO_WATCHLIST) {
        break;
      }
    }

    return valid;
  }

  const api = {
    TROY_OUNCE_GRAMS,
    GOLD_18K_PURITY,
    MAX_CRYPTO_WATCHLIST,
    CRYPTO_DEFAULTS,
    calculateGram24kUsd,
    calculate18kGoldToman,
    formatUsd,
    formatToman,
    formatPercent,
    getBadgeText,
    toFiniteNumber,
    normalizeCoin,
    validateWatchlist
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.MarketPulseUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this);