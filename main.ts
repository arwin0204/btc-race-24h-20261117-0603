// btc-race-24h-20261117-0603 — momentum bot v3.
// Dev result (grade-local, verified): see README.md.
//
// Lesson from the 20261115 race (v2 lost -$33.13 on 10 whipsaw trades,
// then sat flat through the final BTC rally while the winners rode it
// to +$13..+$17.53): be selective, let winners run, and catch a real
// move early. So this bot enters on FAST momentum (a 60 bps rise in 10
// minutes — the start of a move, not a stale breakout) AND only when
// the close is above the EMA(60) (a real uptrend, not a counter-trend
// bounce), then holds with a trailing stop and a LONG max hold so a
// real trend is ridden for hours, while a hard stop caps each failed
// trade. A full round trip costs ~26 bps, so entries must catch a move
// bigger than that.
//
// Why momentum, not a rolling-high breakout: on this dev window the
// close NEVER clears any rolling high by 60 bps (max excess 45 bps),
// so a breakout-confirm can never fire here. But the 10-bar return
// DOES reach 60 bps (20 bars) — a fast burst is the signal that
// actually exists in the data.
//
// Why the EMA(60) filter: without it the bot loses -$7.42 on the
// previous race's downtrend dev window (14 trades, buying every
// counter-trend bounce). With it the same window makes +$18.34
// (6 trades) — the filter blocks the losing bounces and keeps only
// entries in a real uptrend. On this race's flat dev window the
// filter changes nothing (+$3.76, 4 trades, identical action log).
//
// Strategy:
//   Entry (flat, after warmup, before cutoff, past cooldown):
//     (close - close[10 bars ago]) / close[10 bars ago] >= 60 bps
//     AND close > EMA(60).
//     Buy 100% of cash.
//   Exit (holding):
//     trailing stop: close <= peak * (1 - 60 bps) -> sell all.
//     hard stop:     close <= entry * (1 - 60 bps) -> sell all.
//     max hold:      720 bars (12 h) -> sell all.
//   After a sell: 5-bar cooldown before the next entry.
// Deterministic: no clock, no randomness, no network, no env; all state
// derives from hello / batch messages. Only float-free bigint math.
import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10000n;

// --- parameters ---
const MOM_N = 10; // momentum lookback (bars)
const MOM_BPS = 60n; // must rise this much over MOM_N bars to enter
const TRAIL_BPS = 60n; // trailing stop below the peak since entry
const STOP_BPS = 60n; // hard stop below the entry price
const MAX_HOLD = 720; // max bars to hold a position
const COOLDOWN = 5; // bars to wait after a sell before re-entering
const CUTOFF = 1350; // no new entries at/after this seq
const SLIP_BPS = 100; // max slippage on any order (bps from latest close)

// --- state (all derived from the batches) ---
const closes: bigint[] = []; // closes seen so far, oldest first
let ema: bigint | null = null; // EMA(60) of closes, for the trend filter
let entryPx: bigint = 0n; // close at which we entered
let peakPx: bigint = 0n; // highest close since entry
let holdBars = 0; // bars held in the current position
let cooldownUntil = -1; // no entries while seq < this

function belowBy(close: bigint, ref: bigint, bps: bigint): boolean {
  // true when close <= ref * (1 - bps/10000), exact bigint math.
  return close * BPS <= ref * (BPS - bps);
}

await runBars({
  onBatch(state, batch) {
    void batch;
    if (state.warmingUp) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);
    // EMA(60): ema = ema + (close - ema) / 60, integer math.
    if (ema === null) ema = close;
    else ema = ema + (close - ema) / 60n;

    const pos = state.positions.get(SYMBOL);
    const holding = pos !== undefined && pos.qty > 0n;

    if (holding) {
      holdBars += 1;
      if (close > peakPx) peakPx = close;
      // Exit: trailing stop, hard stop, or max hold.
      if (belowBy(close, peakPx, TRAIL_BPS)) {
        cooldownUntil = state.seq + COOLDOWN;
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: SLIP_BPS }];
      }
      if (belowBy(close, entryPx, STOP_BPS)) {
        cooldownUntil = state.seq + COOLDOWN;
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: SLIP_BPS }];
      }
      if (holdBars >= MAX_HOLD) {
        cooldownUntil = state.seq + COOLDOWN;
        return [{ side: 'sell', symbol: SYMBOL, qty: pos.qty, max_slippage_bps: SLIP_BPS }];
      }
      return [];
    }

    // Flat: look for fast upward momentum.
    if (state.seq >= CUTOFF) return [];
    if (state.seq < cooldownUntil) return [];
    if (closes.length <= MOM_N) return [];
    const ref = closes[closes.length - 1 - MOM_N];
    // Enter when the close rose >= MOM_BPS over the last MOM_N bars.
    if ((close - ref) * BPS < ref * MOM_BPS) return [];
    // Trend filter: only buy when the close is above the EMA(60).
    // In a downtrend this blocks counter-trend bounce entries (the
    // cross-window test showed the unfiltered bot loses -$7.42 on a
    // downtrend window by buying every bounce).
    if (ema === null || close <= ema) return [];
    const cash = state.cash;
    if (cash <= 0n) return [];
    const room = state.weightRoom(SYMBOL);
    const spend = cash < room ? cash : room;
    if (spend <= 0n) return [];
    entryPx = close;
    peakPx = close;
    holdBars = 0;
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: spend, max_slippage_bps: SLIP_BPS }];
  },
});
