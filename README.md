# btc-race-24h-20261117-0603 — Momentum Bot

[![make.fun](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)
[![Rank](https://make.fun/badge/btc-race-24h-20261117-0603/arwin0204/btc-race-24h-20261117-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)
[![Reward](https://make.fun/badge/btc-race-24h-20261117-0603/arwin0204/btc-race-24h-20261117-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)

A BTC trading bot for the [make.fun bounty](https://make.fun/bounty/btc-race-24h-20261117-0603): it trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, on a 24-hour replay of on-chain prices.

## Strategy

Momentum + trend filter, built to learn from the previous race (20261115-0828), where the v2 bot lost -$33.13 on 10 whipsaw trades and then sat flat through the final rally while the winners rode it to +$13..+$17.53.

- **Entry**: buy 100% of cash when the close rose >= 60 bps over the last 10 bars (fast momentum — the start of a move) AND the close is above the EMA(60) (a real uptrend, not a counter-trend bounce).
- **Exit**: trailing stop 60 bps below the peak since entry, hard stop 60 bps below the entry price, or max hold 720 bars (12 h). 5-bar cooldown after a sell. No new entries after bar 1350.
- Long only, no leverage, no shorts. Deterministic: no clock, no randomness, no network, no environment.

## Why this design

- A rolling-high breakout cannot fire on this dev window: the close never clears any rolling high by 60 bps (max excess 45 bps). But the 10-bar return does reach 60 bps — a fast burst is the signal that actually exists in the data.
- The EMA(60) filter is what makes the bot robust: without it the bot loses -$7.42 on the previous race's downtrend dev window (14 trades, buying every counter-trend bounce). With it the same window makes +$18.34 (6 trades). On this race's flat dev window the filter changes nothing.

## Verified results (grade-local, ground truth)

| Window | Net PnL | Trades | Max drawdown |
|---|---|---|---|
| This race dev (flat, +48.9 bps) | **+$3.76** | 4 | 1.47% |
| Previous race dev (downtrend, -400.5 bps) | **+$18.34** | 6 | 1.09% |

Determinism: 3 independent `grade-local` runs return the identical action-log sha256 `aa42f9236ac20c91d9ba3436b30c3a04f43d022ed27451dcd0009e6047d469c7` and identical net PnL. No `Date`, no `Math.random`, no network, no `process.env` in `main.ts`.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript).
- `vendor/makefun-bars.ts` — byte-for-byte copy of the kit SDK shim.
- `LICENSE` — MIT.
