# Market Pulse

A Chrome Manifest V3 toolbar extension that shows cached gold, Toman, and user-configurable cryptocurrency prices.

## Features

- **Configurable Crypto Watchlist**: Select up to 3 cryptocurrencies and customize their order.
- Add, remove, reorder, and restore the default Bitcoin + Ethereum watchlist.
- Search CoinGecko by cryptocurrency name, symbol, or ID.
- Prevent duplicate selections and safely validate stored watchlist data.
- Refreshes data in the background every 30 minutes and on browser startup/installation.
- Keeps the popup fast by reading `chrome.storage.local` cache.
- Shows XAU/USD per ounce, 24K and 18K gold per gram in USD.
- Shows selected cryptocurrencies with 24-hour percentage changes.
- Optionally shows USDT/Toman and 18K gold per gram in Toman after saving a personal BRSAPI key.
- Preserves previously confirmed data during temporary API failures and CoinGecko HTTP 429 rate limits.
- Uses separate requests for Gold, Crypto, and Toman so one source failing does not block the others.
- Shows a compact rounded gold price on the toolbar badge.

## Load it unpacked in Chrome

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Select this `market-pulse` folder.
5. Pin **Market Pulse** from Chrome's Extensions menu.
6. Open the gear icon to configure the crypto watchlist or BRSAPI key.

Chrome fetches fresh data after installation. If the popup opens before the first fetch finishes, use **Refresh** once.

## Run the pure JavaScript tests

From the extension folder:

```powershell
node tests/utils.test.js
```

The tests cover:

- 18K gold in Toman calculation;
- USD formatting, including zero-decimal crypto formatting;
- toolbar badge formatting;
- watchlist defaults;
- empty watchlists;
- maximum of 3 assets;
- duplicate prevention;
- malformed watchlist data;
- coin normalization.

## Privacy and key handling

The BRSAPI key is entered by the user in `options.html` and stored only with `chrome.storage.local` in their Chrome profile. It is never hardcoded, logged, or included in this project.
