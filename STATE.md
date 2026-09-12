# Semester Runway — state of the build

Written for whoever picks this up next, human or agent. Read this before touching
anything; it is the difference between a ten-minute change and an afternoon.

- **Branch:** `claude/semester-runway-app` (all work lives here; `main` has the raw
  design handoff only)
- **Last verified:** typecheck clean, 16/16 tests pass, web + iOS bundles export,
  the whole first-run flow driven in a browser
- **Nothing is deployed anywhere.** There is no backend, no account system, no
  data that survives a page reload.

---

## 1. Run it

```sh
cd mobile
npm install
npm start      # press i for the iOS simulator, or scan the QR with Expo Go
npm run web    # no simulator needed; renders phone-sized in the browser
```

Verify a change:

```sh
npx tsc --noEmit --noUnusedLocals --noUnusedParameters   # types
npm test                                                 # 16 domain tests, plain Node
npx expo export --platform web                           # web bundle → dist/
npx expo export --platform ios --output-dir /tmp/ios     # native bundle (see §6)
```

If a change doesn't show up on a device, it's almost always the cache: `npx expo
start -c`, and swipe-close Expo Go before rescanning.

---

## 2. How it's put together

Four layers, strictly one-directional. This is the single most important thing to
preserve.

```
app/*.tsx          screens (expo-router, file-based)
  ↓
src/state/         RunwayProvider — the one store; holds the snapshot,
                   derives the projection, exposes every mutation
  ↓
src/data/          api.ts (the interface) → client.ts (picks one)
                   mock/  in-memory, ships by default
                   http/  real client, waiting for a server
  ↓
src/domain/        pure TypeScript. No React, no imports from anywhere above.
                   runway.ts is the projection engine; everything numeric
                   on every screen comes out of it.
```

**`src/domain/` must stay pure.** It has no React and no I/O, which is why the
what-if screens can run the projection against a modified copy of the snapshot
and why the tests run on plain Node with no test runner. Adding a React import
there breaks both.

**Every mutation returns the whole `SemesterSnapshot`, not a patch.** Deliberate:
logging one $8.65 boba moves today's remainder, the run-out date, four category
bars and possibly a streak. Returning the new truth is simpler than reconciling
deltas and can't drift.

**`src/data/api.ts` is the only boundary.** Nothing except `client.ts` imports a
concrete implementation. Set `EXPO_PUBLIC_API_URL` and every screen is talking to
a server with no change above that line.

---

## 3. What actually works

Ten screens, all reachable, all wired to the store:

| Screen | File | State |
|---|---|---|
| Onboarding | `app/onboarding.tsx` | 5 steps, one topic each, back navigation, Android hardware back |
| Home | `app/index.tsx` | live daily number, heat strip, category bars, streak line |
| Runway | `app/runway.tsx` | run-out date + the ledger of what moved it |
| Spend | `app/spend.tsx` | envelopes and today's charges |
| Scan | `app/scan.tsx` | camera → parsed receipt → confirm → logged |
| Jobs what-if | `app/jobs.tsx` | drag hours, date moves under your thumb |
| Coach | `app/chat.tsx` | what-ifs priced in days of runway |
| Friends | `app/friends.tsx` | people, goals (money), challenges (streaks), invites |
| You | `app/you.tsx` | setup summary, reset, entry to Wrapped |
| Wrapped | `app/wrapped.tsx` | 7 story cards |

A first run starts **empty on purpose**: no people, no jobs, no goals, no
challenges. Only the lump and the standing bills, which are facts about the term
rather than choices. You add the rest. Invite controls only appear once there's
somebody to invite — that was a deliberate fix, don't reintroduce seeded friends.

---

## 4. Known stubs — things that are deliberately fake

None of these are bugs. They're the seams where a real implementation goes.

| Stub | Where | What a real version does |
|---|---|---|
| **The entire backend** | `src/data/mock/mockApi.ts` | In-memory, fake latency, resets on reload. `src/data/http/httpApi.ts` is a *working* client (not a placeholder) that defines the wire contract — 15 endpoints, bearer auth, snapshot-in-response, listed in its header comment. Point `EXPO_PUBLIC_API_URL` at a server implementing it. |
| **Receipt OCR** | `MockRunwayApi.scanReceipt` | Always returns "Tiger Sugar · Village, $8.65, Drinks" after a 1.1s beat. Real version posts the image multipart to `POST /receipts:scan`. The camera capture itself is real; the bytes are thrown away. |
| **The coach** | `src/domain/coach.ts` | Regex pulls a price out of your message, then arithmetic over the same projection the home screen uses. Kept pure so the coach can never quote a number the rest of the app disagrees with. When a model goes behind `RunwayApi.askCoach`, this stays as the fallback and as the source of the structured `routes` — a model should fill those, not write prose. |
| **Contacts** | `src/data/contacts.ts` | Six hardcoded names. Swap for `expo-contacts` or a server "people you know" list. Async and permissioned in reality, which is why it's a function, not a constant. |
| **Invites** | `mockApi.inviteToFund` / `inviteToChallenge` | People land as `status: 'invited'` and stay there forever. Nobody ever accepts, because there's no second device. |
| **Streaks** | `mockApi.logExpense` | Only ever *break*. A charge in a challenge's category resets it; nothing advances it, because "you didn't buy boba today" is the absence of evidence and needs a server-side daily tick. |
| **Semester Wrapped** | `src/data/mock/seed.ts` → `SEED_WRAPPED` | A fixed end-of-semester recap for a *completed* term. Not derived from your live snapshot — it's the design's demo of the retrospective. This is where Maya and Dev still appear, correctly, as people who were in that finished semester. |
| **Fund contributions** | `app/friends.tsx` | The "Put $20 in" button is a fixed `MOVE_AMOUNT = 20`. No amount picker yet. |
| **Prior spending** | `seed.ts` | `priorCategoryTotals` ($940, all envelopes) and `priorFreeSpend` ($880, free envelope only) are two independent constants. A real backend derives both from one transaction feed and they reconcile by construction. The header comment in `seed.ts` explains the split — read it before you "fix" the discrepancy. |
| **Auth** | `httpApi.ts` | `getToken` defaults to `() => null`. No login screen exists. |

---

## 5. Known bugs and rough edges

Honest list. None are blocking, none are hidden.

1. **No persistence.** Reload the browser or restart the app and you're back at
   onboarding. There is no `AsyncStorage`, no `localStorage`, nothing. This is the
   single biggest gap between the demo and something usable — and the easiest
   thing to add, since the whole state is one JSON-serializable snapshot.
2. **Bills entered in onboarding without an envelope default to `fees`**
   (`mockApi.completeSetup`). Fine for the four seeded bills; a user-entered
   "car insurance" also lands in fees, which is wrong but harmless to the maths.
3. **The coach's price regex takes the first number it sees.** "$18 sushi tonight"
   works; "split a $60 dinner 4 ways" reads as $60, not $15.
4. **`challengeCaption` ranks by streak length only.** With everyone at zero on a
   fresh account it just says "just you" or "N invited", which is correct but flat.
5. **The Jobs what-if stops earning at `semester.lastPaidWeek`** (Nov 13). Dragging
   hours past that point correctly earns nothing, but the UI doesn't say why.
6. **No empty state on the Runway screen** if you somehow reach it with no
   spending history. Unreachable today because the seed ships prior spending.
7. **Wrapped is always available** from the You tab, even in week 3. It's a demo
   card deck, not a gated end-of-term feature.

---

## 6. Do not touch (without reading this first)

Each of these looks wrong and is not. They cost real time to discover.

- **`MIN_LINE_HEIGHT = 1.25` in `src/theme/scale.ts`.** The design asks for line
  heights below `1em` on display type. In CSS a glyph simply overflows its line
  box; on iOS it *clips* — the tops come off the dollar signs. Baloo 2's descent
  is `0.524em` and the `$` glyph reaches `0.703em`, so `1.227em` is the true floor
  and 1.25 is that with a little air. Lowering this re-breaks every hero number.
- **`react-dom` is pinned to exactly `19.2.3`** — no caret. A caret lets it drift
  to 19.3.0, which conflicts with the React version Expo 57 wants and fails
  install.
- **`mobile/public/index.html` overrides Expo's web shell.** It frames the app at
  402×874 above 440px and goes full-bleed below. Because it overrides the
  template, it also has to carry react-native-web's reset itself — that's what the
  `#expo-reset` block is. Deleting it un-frames the web build; deleting only the
  reset breaks scrolling.
- **The custom `src/ui/TabBar.tsx`, driven by `router.replace`.** Expo Router 57
  dropped React Navigation, so there is no tab navigator to use. Each tab screen
  renders the bar itself; `replace` keeps the four tabs as peers instead of
  stacking history. This is the supported shape, not a workaround to clean up.
- **`src/ui/DateField.tsx` is a hand-rolled calendar.**
  `@react-native-community/datetimepicker` was installed, tried, and removed — it
  can't be styled into the design's idiom and looks like a system sheet dropped
  into a hand-drawn app. The custom one is Monday-first with square cells and
  honours a `min` date.
- **The figures in `src/domain/runway.test.ts` are pinned to the design.** $6,240
  lump, $1,890 reserved, $36/day, Nov 15, $34.79 left today. The arithmetic *is*
  the product; a change that moves the run-out date by a day should be a decision,
  not a surprise. The tests attach the design's Austin fund and a job themselves,
  because the seed ships neither — don't "fix" that by re-seeding them.
- **`expo export --platform ios` needs `--output-dir`.** Without it, it writes to
  `dist/` and silently clobbers the web build, which then serves a blank page.
- **`src/domain/` imports nothing from React or `src/ui`.** See §2.

---

## 7. Good first tasks

Roughly in order of value per hour:

1. **Persist the snapshot.** `AsyncStorage` in `RunwayProvider`, keyed by
   semester id. One JSON blob. Unblocks every other kind of testing.
   Superseded by `CLAUDE.md`: this project goes straight to Supabase, so treat
   AsyncStorage as intentionally skipped rather than a step still owed.
2. **Give bills a real envelope picker** in onboarding (fixes §5.2).
3. **Amount picker on fund contributions**, replacing the fixed $20.
4. **A daily tick that advances streaks**, so challenges can go up as well as
   down. Needs somewhere to run — this is the first thing that genuinely wants a
   server.
5. **Stand up the backend** against the contract in `httpApi.ts`. The client is
   already written; the endpoints are listed in its header comment.
6. **Derive Wrapped from the live snapshot** instead of `SEED_WRAPPED`.

---

## 8. Repo layout

```
mobile/            the Expo app — everything above is about this
project/           the original Claude Design HTML prototypes
chats/             the design conversation; where the intent lives
docs/screenshots/  the images in README.md
README.md          what the product is, for a reader who isn't building it
HANDOFF.md         the original design-bundle note (historical)
STATE.md           this file
```

`mobile/AGENTS.md` says, correctly, that Expo has changed and to read the
versioned docs at `https://docs.expo.dev/versions/v57.0.0/` before writing code.
Take it seriously — SDK 57 moved a lot, and answers you remember for older Expo
are usually wrong now.
