# Semester Runway

An iOS app for students living off one lump sum. Aid refunds and summer earnings
land in August; budget apps assume a monthly paycheck you don't have. This one
sorts the lump into envelopes, gives you a daily safe-to-spend number that
correctly shrinks toward the end of term, and tells you the date you run out —
and why that date moved.

Built from the Claude Design handoff in [`../project`](../project); the primary
source is `Semester Runway Prototype.dc.html` and the conversation in
[`../chats`](../chats).

## Running it

```sh
npm install
npm start          # then press i for the iOS simulator, or scan with Expo Go
npm test           # the projection engine's contract — 14 assertions, plain Node
npm run typecheck
```

Requires the Expo SDK 57 toolchain (React Native 0.86, React 19.2). The camera
needs a real device; in the simulator the receipt scanner falls back to the
placeholder viewfinder and still parses.

## The screens

| Route | What it is |
| --- | --- |
| `/onboarding` | Three steps: the problem, what landed in August, what you're saving for. |
| `/` | Home — one hero number, then Runway / Paychecks / Spending / Trip, rule-separated. |
| `/runway` | The Free-to-spend envelope, its run-out date, and the ledger of what moved it. |
| `/jobs` | Per-job hours sliders. The date moves as you drag. |
| `/scan` | Camera → parsed receipt → pick an envelope → drop it in. |
| `/chat` | The what-if coach. Every answer priced in days of runway. |
| `/spend` | Categories, today's receipts, and one pattern worth acting on. |
| `/friends` | The shared **fund** (real money) and **challenges** (streaks, no dollars). |
| `/you` | The setup behind the numbers, and the way into Wrapped. |
| `/wrapped` | Seven story cards, alternating cream and ink. |

Everything runs off one model, so actions ripple: logging a boba moves today's
remainder, the category bars and the no-boba streak; dragging library hours moves
the run-out date on every heat strip; moving $20 into the trip lowers the daily
number.

## How it's put together

```
app/                    Routes (expo-router). One file per screen.
src/
  domain/               Pure logic. No React, no React Native, no I/O.
    runway.ts             project() — the projection engine
    coach.ts              the what-if answers
    dates.ts              semester calendar arithmetic
    selectors.ts          category bars, fund progress
    runway.test.ts        the contract, pinned to the design's numbers
  data/
    api.ts                RunwayApi — the one boundary
    mock/                 in-memory implementation + the demo semester
    http/                 the real-backend client (wire contract, not yet wired)
    client.ts             picks one
  state/                  RunwayProvider — snapshot in, projection out
  theme/                  tokens and the Baloo 2 text component
  ui/                     the design system's primitives
```

**The projection engine is the product.** `project(snapshot)` is a pure function:
lump − bills still owed − fund pledged − spent, spread over the days remaining.
That purity is what makes the what-if screens possible — the jobs slider and the
coach both run it against a modified copy of the snapshot and compare dates,
rather than reimplementing the arithmetic. Nothing can quote a number the rest of
the app disagrees with.

**One API seam.** Every screen goes through `RunwayApi`; only `client.ts` knows
which implementation it gets. Today that's `MockRunwayApi`, holding the demo
semester in memory with realistic latency. Set `EXPO_PUBLIC_API_URL` and it's
`HttpRunwayApi` instead, with no change above the boundary. `http/httpApi.ts`
documents the endpoints a backend has to serve.

Mutations return the whole snapshot rather than a patch, because every mutation
here ripples; returning the new truth is simpler and less prone to drift than
reconciling deltas client-side. The two places the design demands immediacy —
the hours slider and the chat composer — update optimistically and let the
server's response win.

## Fidelity notes

- Values are copied from the design unchanged. `src/theme/tokens.ts` is the only
  place a hex or a gutter width is written down.
- React Native has no cascade, so type styling can't live on a container. The `T`
  component carries it, converting the design's unitless `line-height` and em
  `letter-spacing` into the px React Native needs, so the numbers can be copied
  across as-is.
- The design's diagonal hatching was a repeating linear gradient; React Native
  has none, so the run-out zone is an SVG pattern at the same 3-on-4-off rhythm.
- The design reserved 62px above content for the status bar; on device that's the
  safe-area inset plus the same 3px of air.
- **The demo seed carries two independently seeded spend figures**:
  `priorCategoryTotals` ($940, across every envelope) and `priorFreeSpend` ($880,
  the part charged to Free-to-spend that moves the daily number). The design's
  screens show both. A real backend derives them from one transaction feed and
  they reconcile by construction; in `src/data/mock/seed.ts` they're two
  constants, which is noted there.

## Known gaps

These are stubs behind a real surface, not missing screens:

- **Share** on the Wrapped cards renders but does nothing — no `expo-sharing`
  target yet.
- **`+ Add a bill` / `+ Another goal` / `+ Add` job / `+` friend** are drawn as
  the design drew them; the flows behind them weren't designed.
- **Receipt OCR** is server-side by design. The camera captures and uploads, but
  `MockRunwayApi.scanReceipt` returns a fixed result after a beat.
- **Auth** — `HttpRunwayApi` takes a token getter; nothing supplies one.
