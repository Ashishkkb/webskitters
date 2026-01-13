# Frontend Overview (Candles, Data Flow, Lightweight Charts)

This app renders **Binance USDⓈ-M Futures** candlesticks using **React + TypeScript** with **TradingView Lightweight Charts**. It bootstraps historical OHLC data via REST, then stays live via WebSocket.

## What are candles / OHLC (project context)
- A **candlestick** ("candle") represents price action for one time bucket (e.g., 1 minute).
- **OHLC** = **Open**, **High**, **Low**, **Close** for that bucket.
- We never invent prices; we map Binance data directly into the chart’s candle shape.

## Where the numbers come from (Binance mapping)
- Binance REST klines return rows like: `[openTime, open, high, low, close, volume, ...]`.
  - `row[0]` = openTime (ms) → we convert to seconds for the chart `time` field.
  - `row[1]` = open, `row[2]` = high, `row[3]` = low, `row[4]` = close.
- In `services/binance.ts`, `toCandle(row)` maps to `{ time, open, high, low, close }` required by Lightweight Charts.

## Historical data flow (REST + pagination we built)
- Hook `useKlines` calls `fetchHistorical(sym, interval, preset, signal)`.
- REST endpoint: `https://fapi.binance.com/fapi/v1/klines`.
- Binance hard limit: **1500 candles per request**. We **paginate backward** using `endTime`, accumulating candles until we hit the requested range or a safety cap.
- Safety cap: **50,000 candles** (examples: 1m ≈ 34.7 days, 5m ≈ 173 days, 15m ≈ 520 days, 1h ≈ 5.7 years).
- Pagination is **our code**; the Lightweight Charts library itself does not paginate.
- Default load (per spec): **BTCUSDT**, **1m**, **last 500 candles (~8h)**.

## Live feed (WebSocket) and message format
- WS URL: `wss://fstream.binance.com/ws/{symbol}@kline_{interval}`.
- Each message has a `k` object (kline):
  - `k.t` (start time, ms), `k.o`/`k.h`/`k.l`/`k.c` (OHLC), `k.x` (isClosed boolean).
- Merge logic in `useKlines`:
  - If `candle.time === last.time`: update the forming candle (OHLC can change until close).
  - If `candle.time > last.time`: append a new candle (closed or next forming).
- Reconnect with exponential backoff (2s → 30s cap). Cached candles stay in memory so the chart doesn’t wipe on reconnect.

## TradingView Lightweight Charts: what we use
- Library: `lightweight-charts` (TradingView’s performant chart renderer for financial data).
- We create one chart and one candlestick series: `addSeries(CandlestickSeries, …)`.
- Rendering strategy:
  - `setData([...])` for full resets (symbol/range change, large gaps).
  - `update(lastCandle)` for live ticks (fast incremental path).
- Options we enable: dark layout colors, custom grid lines, price/time scale borders, `CrosshairMode.Normal`, auto-resize on window resize.
- No built-in pagination; the chart simply renders the array you pass. Pagination is handled before data reaches the chart.
- Error avoidance: we reset the series when the symbol changes to prevent mixed-symbol data and “Cannot update oldest data” errors.

## State management (React + custom hook)
- `useKlines` owns data lifecycle:
  - State: `candles`, `historyLoading`, `error`, `connection`, `nextRetrySec`, `lastUpdated`.
  - Refs: `wsRef` (WebSocket), `reconnectTimerRef` (backoff), `historyAbortRef` (cancel stale REST), `requestIdRef` (ignore stale responses).
  - Derived cap: `maxCandlesForPreset` ensures we never exceed 50k candles.
- AbortController cancels in-flight REST calls when symbol/interval/range changes.
- On symbol change: we clear candles and the chart series immediately to avoid mixing pairs.

## Flow summary (end-to-end)
1) On load (defaults: BTCUSDT / 1m / 500 candles):
   - Fetch REST klines with backward pagination as needed, sort oldest→newest, render with `setData()`.
2) Then connect WebSocket for the same symbol/interval:
   - Update forming candle when times match; append when new time arrives.
3) On symbol/interval/range change:
   - Clear candles, abort old REST request, fetch new history, then reconnect WS.
4) On disconnect:
   - Exponential backoff reconnect; candles stay cached so the chart resumes without wiping.

## Are we “creating” candles?
- No. We transform Binance-provided OHLC data into the Lightweight Charts format and render it. All prices come from Binance REST (history) and Binance WS (live).
