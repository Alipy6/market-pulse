"use strict";

const assert = require("node:assert/strict");
const {
  calculate18kGoldToman,
  formatUsd,
  getBadgeText,
  CRYPTO_DEFAULTS,
  MAX_CRYPTO_WATCHLIST,
  normalizeCoin,
  validateWatchlist
} = require("../utils.js");

assert.equal(
  calculate18kGoldToman(100, 60000),
  4500000,
  "18K Toman price uses the 24K gram price × USDT/Toman × 0.75 purity formula"
);
assert.equal(calculate18kGoldToman("invalid", 60000), null);

assert.equal(formatUsd(2735.6), "$2,735.60");
assert.equal(formatUsd(2735.6, 0), "$2,736");
assert.equal(formatUsd(2735.6, 2), "$2,735.60");
assert.equal(formatUsd(null, 0), "—");
assert.equal(formatUsd("invalid", 0), "—");

// Crypto prices must retain decimal precision in the UI.
assert.equal(formatUsd(79166, 2), "$79,166.00");
assert.equal(formatUsd(1.02, 2), "$1.02");
assert.equal(formatUsd(0.123456, 2), "$0.12");

assert.equal(getBadgeText(2735.4), "2735");
assert.equal(getBadgeText(123456), "1234");
assert.equal(getBadgeText(null), "");

assert.deepEqual(validateWatchlist(null), CRYPTO_DEFAULTS, "Defaults returned for missing storage");
assert.deepEqual(validateWatchlist([]), [], "An intentionally empty watchlist remains empty");
assert.equal(MAX_CRYPTO_WATCHLIST, 3);
assert.equal(
  validateWatchlist([
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
    { id: "ethereum", name: "Ethereum", symbol: "ETH" },
    { id: "solana", name: "Solana", symbol: "SOL" },
    { id: "cardano", name: "Cardano", symbol: "ADA" }
  ]).length,
  3,
  "Maximum 3 items enforced"
);
assert.deepEqual(
  validateWatchlist([
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
    { id: "bitcoin", name: "Bitcoin Duplicate", symbol: "BTC" }
  ]),
  [{ id: "bitcoin", name: "Bitcoin", symbol: "BTC" }],
  "Duplicates rejected"
);
assert.deepEqual(
  validateWatchlist([{ id: "solana", name: "Solana" }]),
  [{ id: "solana", name: "Solana", symbol: "SOLANA" }],
  "Missing symbol falls back to uppercase ID"
);
assert.deepEqual(
  validateWatchlist(["invalid-item", null, { id: "" }]),
  [],
  "Invalid items ignored"
);
assert.equal(normalizeCoin({ id: "bad id", name: "Bad Coin" }), null);
assert.equal(normalizeCoin({ id: "solana", name: "Solana" }).symbol, "SOLANA");

console.log("All Market Pulse utility tests passed.");
