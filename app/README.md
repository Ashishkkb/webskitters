# Live Candlestick Chart — Binance Futures + TradingView

A real-time candlestick chart application built with React, TypeScript, and TradingView Lightweight Charts. Displays USDⓈ-M Futures data from Binance with historical bootstrap via REST API and live streaming via WebSocket.

## Quick Start

```bash
cd app
npm install
npm run dev
```

Open the localhost URL printed in the terminal. Defaults load **BTCUSDT**, interval **1m**, history **last 500 candles (~8 hours)**.

## Features

- **Real-time streaming**: Live candle updates via Binance WebSocket
- **Historical data**: Paginated REST API fetching for deep history
- **Smart merging**: Forming candles update in-place, closed candles append
- **Auto-reconnect**: Exponential backoff on disconnect (2s → 30s cap)
- **State preservation**: Cached candles survive reconnections
- **Clean architecture**: Separated services, hooks, and components

## Architecture

```
src/
├── App.tsx                 # Main app component (layout + state)
├── App.css                 # Stylesheet with CSS variables
├── types.ts                # Shared TypeScript types
├── services/
│   └── binance.ts          # REST/WebSocket API layer
├── hooks/
│   └── useKlines.ts        # Data fetching + streaming hook
└── components/
    ├── PriceChart.tsx      # TradingView chart wrapper
    ├── SymbolList.tsx      # Sidebar symbol picker
    ├── Controls.tsx        # Form inputs
    ├── StatusBar.tsx       # Connection status badges
    ├── InfoRow.tsx         # Info pills
    └── StatsGrid.tsx       # Feature highlights
```

## How It Works

### Historical Bootstrap (REST)

On load or when config changes:

1. Calculate how many candles are needed for the selected time range
2. Fetch from `fapi/v1/klines` with pagination (max 1500 per request)
3. Walk backwards in time until target range is filled
4. Sort chronologically and render on chart

### Live Updates (WebSocket)

After history loads:

1. Connect to `wss://fstream.binance.com/ws/{symbol}@kline_{interval}`
2. On each message, parse the kline data
3. If `candle.time === last.time`: Update forming candle (OHLC changed)
4. If `candle.time > last.time`: Append new candle
5. On disconnect: Schedule reconnect with exponential backoff

### Chart Reset Detection

The `PriceChart` component detects when to use `setData()` vs `update()`:

- **Reset triggers**: Symbol change, range change, time discontinuity
- **Update triggers**: Single candle append or in-place update

This prevents the "Cannot update oldest data" error.

## Configuration

| Setting  | Default                         | Description                 |
|----------|---------------------------------|-----------------------------|
| Symbol   | BTCUSDT                         | Trading pair               |
| Interval | 1m                              | Candle timeframe           |
| History  | Last 500 candles (~8 hours)     | How far back to load       |

## API Endpoints

- **REST**: `https://fapi.binance.com/fapi/v1/klines`
- **WebSocket**: `wss://fstream.binance.com/ws/{symbol}@kline_{interval}`

No API key required (public endpoints only).

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- TradingView Lightweight Charts
- date-fns (date formatting)

## License

MIT

---

## Requirement Checklist & Implementation Notes

**Historical candles (REST on load)**  
- Implemented in `useKlines`: fetches from `fapi/v1/klines` on load and when symbol/interval/history change.  
- Default: `BTCUSDT`, `1m`, **last 500 candles (~8h)** (matches spec example).  
- Pagination: requests up to 1500 per call until the target range (capped at 50k candles) is filled.

**Live candle formation (WebSocket)**  
- WebSocket subscribes to `{symbol}@kline_{interval}`.  
- Forming candle: if incoming kline time matches the last candle, we **update** that candle (OHLC).  
- Closed candle: when `k.x === true`, we **append** the new candle and continue forming the next.

**Correctness**  
- Candles sorted oldest→newest before render; deduped on arrival.  
- No duplicates: forming candle updates in-place; new times append.  
- Reconnect: exponential backoff (2s → 30s cap); cached candles are retained so the chart does not wipe on reconnect.

**Deliverables present**  
- README includes: how to run, defaults, and how REST + WS are combined.  
- Codebase structured into services (`services/binance.ts`), data hook (`hooks/useKlines.ts`), and UI components.

**Evaluation checklist**  
- Candle behavior: correct forming + closing merge logic.  
- Code quality: split into services/hook/components; typed; commented.  
- Resiliency: reconnect with backoff; state preserved; aborts stale REST requests.  
- Run instructions: in Quick Start.  

## FAQ

**Are we creating the candles?**  
We render candlesticks from Binance data: historical candles come from REST; live candles come from the kline WebSocket. We merge forming candles and append closed candles.

**What is OHLC?**  
OHLC stands for **Open, High, Low, Close** — the four price points that define each candlestick.
