# Devpost submission — copy/paste

Everything below is ready to paste. **Check each claim is still true at
submission time** — especially the ElevenLabs one, which depends on your key
working.

---

## Elevator pitch (one line, ~200 chars)

> Aid money lands as one lump in August and students are broke by November.
> Semester Runway gives you one number for what today can cost, and a run-out
> date that explains itself.

Alternates if you want shorter:

- `One lump in August. 111 days to make it last. One number for what today can cost.`
- `Budget apps assume a monthly paycheck. Students get one pile in August — this is built for that.`

---

## About the project (paste as Markdown)

## The problem nobody builds for

Financial aid refunds and summer earnings arrive as **one lump sum in August**.
Then nothing comes in for four months.

Every budgeting app on the market assumes a monthly paycheck. They ask you to
set a monthly budget and reset it on the 1st — which is exactly wrong when your
income already happened and can never happen again. So students do the only
thing the tools allow: they eyeball it, feel fine in September, and are broke by
November.

We wanted to build the app for that specific shape of money.

## What it does

**One number, not a budget.** *Left to spend today* is your free envelope
divided by the days remaining. It shrinks correctly as the term goes on, because
the denominator is real.

**A run-out date that explains itself.** "Nov 15" on its own is just an
accusation, so every movement is attributed: dipped into rent (−2 days), picked
up 14 hours at the library (+2 days).

**Envelopes first.** Rent, fees and anything you're saving for are carved out
*before* the daily number exists. The trip fund never competes with boba,
because it was never in the same pot.

**Point the camera at a receipt.** Gemini reads the merchant, the total and the
line items, guesses the envelope, and shows you what the charge does to today
before you confirm it. No receipt — a vending machine, a Venmo split — and
manual entry lands the same charge in the same envelope.

**A coach that can't do arithmetic.** More on this below; it's the part we're
proudest of.

**Funds vs. challenges, kept honest.** A shared fund is real money everyone
pledges weekly. A challenge is a streak with no dollars attached. Skipping a
boba doesn't pay for a trip, and the app never pretends it does.

**Semester Wrapped.** Seven story cards where every figure is something the
ledger can actually prove — narrated aloud, with the script written from your
real numbers.

## The part we're proudest of: an LLM that cannot state a wrong number

The obvious way to build an AI money coach is to hand the model your financial
data and let it answer. We think that's unshippable. A model that hallucinates a
date is annoying; one that hallucinates *your rent* is harmful.

So we inverted it.

`src/domain/runway.ts` is a **pure projection engine** — no React, no I/O, no
network. Every number on every screen comes out of it. We exposed it to Gemini
as four callable tools:

| Tool | What it runs |
|---|---|
| `get_situation` | your current position |
| `price_purchase` | a one-off, priced in days of runway |
| `simulate_hours` | change shift hours, re-project |
| `simulate_pledge` | change a weekly savings pledge, re-project |

Every value those tools return is **pre-formatted** — `"$36"`, `"Nov 15"`, never
`36.02` or an ISO date. The system instruction is that the model may quote those
strings verbatim and nothing else. It works out *which* question you're really
asking and says the answer like a person. The engine decides what's true.

The result: **the coach can be wrong about tone, but it cannot quote a number
the home screen disagrees with, because it was never given the ability to
produce one.** Chips under each reply name the what-ifs it actually ran
(`ran priced $249`), so the reasoning is auditable rather than asserted.

We tested this the way you'd test a financial calculation, not the way you'd
test a chatbot: 13 tests pin the tool layer to the same figures as the engine,
and 7 more drive the tool-calling loop against a stubbed model.

## Everything degrades

Every AI path has a non-AI fallback, and we verified the app end to end with no
API keys at all:

- Receipt scanning falls back to a demo parse
- The coach falls back to a built-in heuristic that runs the *same projections*
  — a worse sentence, never a wrong number
- Wrapped narration falls back from ElevenLabs to the device's own voice, and
  from a Gemini-written script to a hand-written one

This isn't defensive programming for its own sake. A demo runs on venue wifi, and
an app that answers slightly worse offline beats one showing a spinner.

## How we built it

- **Expo SDK 57 / React Native 0.86 / React 19** — iOS, Android and web from one
  codebase
- **Four strictly one-directional layers**: screens → one store → one API
  boundary → a pure domain. Nothing above `src/data/api.ts` knows which
  implementation it's talking to
- **Supabase** — Postgres with row-level security, email auth (magic link or
  6-digit code), real cross-user invites, and a `pg_cron` daily tick that
  advances streaks server-side, because "you didn't buy boba today" is an
  absence of evidence a client cannot prove
- **Gemini** — multimodal receipt reading with a constrained response schema, and
  the grounded tool-calling coach
- **ElevenLabs** — Wrapped narration, with generated audio cached per line
- **42 tests** on plain Node, no test runner, because the domain layer is pure

## Challenges we ran into

**Expo Router 57 dropped React Navigation.** No tab navigator exists any more, so
we built the tab bar as a component each screen renders itself, driven by
`router.replace`.

**Type was clipping on device but not in the browser.** The design called for
line heights below 1em on display type. In CSS a glyph overflows its line box; on
iOS it *clips*. We measured Baloo 2's actual glyph metrics — descent `0.524em`,
`$` reaching `0.703em` — and set a `1.25` floor.

**A 26-cent lie.** The confirm sheet said "$13.56 left" and the home screen then
showed "$13.30". Subtracting a charge from today's remainder misses that charging
*today* also shrinks the daily allowance. Both sheets now preview through the
engine, and a test pins the preview to the post-confirm value.

**Silent degradation is a double-edged sword.** Our fallbacks are good enough
that a dead API key sounds exactly like a working one — we lost an hour to a
Wrapped narration that was quietly using the phone's voice. Fixed by labelling
which one is running, and by writing `doctor` scripts that check each key, its
model id, and remaining quota in one command.

**Model ids rot fast.** Mid-hackathon, Google retired our Gemini model for new
keys. Everything silently fell back. That's exactly why the doctor scripts exist.

## What we learned

The interesting constraint in an AI product usually isn't *what can the model
do* — it's *what should the model be allowed to decide*. Splitting "which
question is this" from "what's the answer" gave us a coach that's both
conversational and provably correct, and it made the whole thing easier to test.

Also: pure functions pay for themselves. Because the projection engine has no
side effects, the jobs slider, the coach and the confirmation sheets all run it
against a modified copy of the same snapshot rather than reimplementing the
arithmetic — so nothing in the app can disagree with anything else.

## What's next

- Bank/card import, so the ledger fills itself
- Wrapped derived from your live semester rather than a completed one
- A shared household version — the same envelope model works for roommates

---

## Built with (tags)

```
react-native
expo
typescript
gemini
elevenlabs
supabase
postgresql
expo-router
react
expo-camera
expo-audio
node.js
plpgsql
pg-cron
```

---

## Try it out links

- **GitHub:** https://github.com/aigerim444/hackrice2026 (branch:
  `claude/semester-runway-app`)
- Add an Expo Go / QR link if you publish one

---

## Sponsor / special prizes to tick

- **[TRACK] Finance**
- **[CHALLENGE] Capital One Best Financial Hack**
- **[MLH] Best Use of Gemini API**
- **[CHALLENGE] Best Project Built with ElevenLabs** — only if your key works
- **[MLH] Best Use of ElevenLabs** — same caveat

Skip the rest; nothing else is an honest fit.

---

## Which AI tools did you use this weekend?

Tick: **Gemini**, **ElevenLabs**, **Anthropic**.

(Anthropic because Claude Code wrote a lot of this repo with you. It's asked
openly and answering it costs you nothing.)

---

## Did you implement a generative AI model or API?

> Yes — Gemini, in two places, plus ElevenLabs for speech.
>
> **Receipt understanding.** The camera capture goes to Gemini as inline base64
> with a constrained response schema, returning merchant, total, line items and a
> spending category restricted by enum to the six our domain model allows. An
> unparseable category is impossible rather than merely unlikely.
>
> **A coach that isn't allowed to do arithmetic.** This is the part we designed
> hardest. Our projection engine is a pure function, and we expose it to Gemini as
> four callable tools (price a purchase, change shift hours, change a savings
> pledge, read the current position). Every figure a tool returns is pre-formatted
> as a string, and the system instruction permits the model to quote those strings
> and nothing else. Gemini decides *which* what-if the student is really asking
> about; the engine decides what's true. So the coach can be wrong about tone and
> cannot be wrong about money — it was never given the ability to produce a
> number. The UI shows chips naming the tools that ran, so any figure is
> traceable.
>
> We chose this because a budgeting app that hallucinates a number is worse than
> no budgeting app. Grounding the model in a tested pure function let us keep the
> conversational interface without betting a student's rent on the model's
> arithmetic.
>
> **Gemini also writes the Semester Wrapped narration** from real ledger figures,
> which ElevenLabs then speaks — same discipline, the numbers come from the
> ledger and the model only supplies the words around them.
>
> Every AI path falls back to a non-AI one (a heuristic coach running the same
> projections, a written script, the device's own voice), so the app is fully
> usable with no keys at all.

---

## Gemini Project Number

You have to fetch this yourself: **AI Studio → Get API Key → click the Project
Number for your key → copy.**

---

## Tech feedback (optional but easy points)

> **Gemini:** structured output with a response schema was the single most useful
> feature — constraining a category to an enum turned "parse the model's answer"
> into a non-problem. Function calling worked cleanly for grounding. One rough
> edge: our model id was retired mid-hackathon for new keys, and the 404 named the
> replacement, which was genuinely helpful — but it meant a stale constant looked
> exactly like a missing key.
>
> **ElevenLabs:** the TTS API is a single POST returning audio bytes, which is
> refreshingly simple. Worth documenting more loudly that a key scoped only to
> Text to Speech gets a 401 from `/v1/voices` — we lost time thinking the key was
> dead when it was correctly scoped.
>
> **Supabase:** row-level security made real multi-user invites tractable in
> hours rather than days, and `pg_cron` let us put a daily job in the database
> instead of standing up a worker.

---

## Schools

Rice University (adjust for your team).
