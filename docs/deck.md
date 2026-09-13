# Slide deck — content for the remaining slides

Slides 1–7 are yours and mostly done. **Delete slides 8–25** — they're the
untouched business template (personas, ROI, Gantt charts, projected revenue) and
none of it belongs in a hackathon deck. Replace with the nine below.

Each slide here is: what goes on it, then what you say over it. Keep the words
on the slide short — the speaker notes are for you, not the screen.

> ⚠️ **Name mismatch.** The deck says *Semester Limit*; the app, repo and README
> say *Semester Runway*. Pick one before you submit. Easiest is to keep
> "Semester Runway" everywhere, since it's already in the app icon, the splash
> screen, and your teammate's Supabase seed.

---

## Fix first — slide 1

Replace the placeholder legal line ("Use this space for legal copy…") with the
tagline. It's the first thing a judge reads:

> **Semester Runway**
> Rent comes every month. Student money arrives twice a year.
> HackRice 16 · Aigerim Zhadikbay & Wendy Jin

## Fix first — slide 2 (Agenda)

You have ten blank rows for a four-part talk. Cut to four:

> 1. The problem
> 2. Demo
> 3. How it works
> 4. Impact

---

# INTRO

## Slide A — The problem (put this before the goal slide)

> **Rent every month. Income twice a year.**
>
> - Moved off campus → first time paying rent, every single month
> - Money in: a summer internship, and a scholarship in August
> - Two big deposits, months apart, then nothing for the term
> - Every budgeting app assumes a monthly paycheck and resets on the 1st

**Say:** "I moved off campus this year, so I pay rent every month now. But my
money came in two chunks — a summer internship and a scholarship in August.
Every budgeting app I tried assumes I get paid monthly. None of them work for
this."

## Slide B — The question we actually needed answered

> ### "My friends want dinner tonight. Can I say yes?"
>
> Not *"am I over budget."*
>
> College spending is spontaneous — coffee runs, dessert, someone's birthday.
> We didn't want an app that says stop. We wanted one that says **how much**.

**Say:** "The question was never 'am I over budget.' It was: my friends want
dinner, can I say yes? Nobody plans a coffee run. Those hangouts are the point
of being here — I just needed to know how much I could spend on them without
being broke in November."

---

# DEMO

Slide 7 is your "Demo!" divider — keep it. See `docs/demo-script.md` for the
live run. If you're screen-recording instead, the video script is at the bottom
of this file.

---

# TECH

## Slide C — How it's built

> **Four layers, one direction**
>
> ```
> screens          expo-router, one file per screen
>   ↓
> one store        holds the snapshot, derives the projection
>   ↓
> one API seam     mock · Supabase · Gemini decorating either
>   ↓
> pure domain      no React, no I/O — the projection engine
> ```
>
> `project(snapshot)` is a pure function. Every number on every screen comes out
> of it.

**Say:** "Everything numeric in the app comes out of one pure function. Because
it has no side effects, the jobs slider, the coach and the confirmation sheets
all run it against a modified copy of the same data instead of re-implementing
the maths — so nothing in the app can disagree with anything else."

## Slide D — ★ The one we're proudest of

> # An LLM that cannot state a wrong number
>
> The obvious build: hand the model your financial data and hope.
> **A model that hallucinates a date is annoying. One that hallucinates your
> rent is harmful.**
>
> So we inverted it.

**Say:** Pause here. This is the slide that wins Technical Rigor — let it land
before you explain how.

## Slide E — How that works

> **Gemini gets the projection engine as tools — not the data**
>
> | Tool | Runs |
> |---|---|
> | `get_situation` | your current position |
> | `price_purchase` | a purchase, priced in days |
> | `simulate_hours` | change shifts, re-project |
> | `simulate_pledge` | change a savings pledge |
>
> Every value comes back **pre-formatted** — `"$36"`, `"Nov 15"`.
> The model may quote those strings **and nothing else.**
>
> → It picks *which* question. The engine decides what's **true**.

**Say:** "Gemini works out which what-if you're actually asking and says it like
a person. It has no calculator — it's only allowed to quote strings the engine
handed back. So it can be wrong about tone, and it cannot be wrong about money,
because it was never able to produce a number."

**If you have a screenshot with the trace chips, put it here.** Those grey chips
naming the tools that ran are the proof, and judges will look at them.

## Slide F — Gemini's second job

> **Point the camera at a receipt**
>
> - Photo → Gemini reads merchant, total, **line items**
> - Category constrained by enum to the six the app allows — an unparseable
>   answer is impossible, not just unlikely
> - Shows what the charge does to today *before* you confirm
> - No receipt? Manual entry lands the same charge in the same envelope

**Say:** "Most spending has no receipt — a vending machine, a Venmo split. The
scanner is the fast path, not the only one."

## Slide G — Everything degrades

> **Every AI path has a non-AI fallback**
>
> | | with keys | without |
> |---|---|---|
> | Receipts | Gemini vision | demo parse |
> | Coach | Gemini + tools | built-in heuristic, **same projections** |
> | Wrapped | Gemini script + ElevenLabs | written script + device voice |
>
> Verified end to end with **no API keys at all.**

**Say:** "A demo runs on venue wifi. An app that answers slightly worse offline
beats one showing a spinner." — *This is a strength, say it as one.*

## Slide H — The backend is real

> **Supabase, behind the same contract**
>
> - Postgres + row-level security
> - Email auth — magic link or a 6-digit code
> - **Real cross-user invites** — invite from one account, accept on another
> - `pg_cron` daily tick that advances streaks server-side
> - One env var switches the whole app between mock and live

**Say:** "Shared goals aren't faked. Two accounts, two phones — one person
invites, the other accepts, and both see the same pledge bar move."

## Slide I — How we tested it

> **43 tests, on plain Node**
>
> - The projection engine, pinned to exact figures — a change that moves the
>   run-out date by a day has to be a decision, not a surprise
> - The tool layer, pinned to the same numbers the engine gives the screens
> - The tool-calling loop, against a stubbed model — because every error path
>   falls back, a broken loop would otherwise look identical to a quiet one

**Say:** "We tested this the way you'd test a financial calculation, not the way
you'd test a chatbot."

---

# IMPACT

## Slide J — Who it's for

> **Every student on aid, a scholarship, or a summer job**
>
> - Lump-sum income is the norm in higher ed, not an edge case
> - The tools all assume a paycheck that doesn't exist
> - We're two of the users. We built the thing we needed in September.
>
> **What's next:** bank import · splitting a bill in the moment · Wrapped from
> your live semester · roommates, since rent is the biggest recurring cost and
> it's usually split

## Slide K — Close

> # Semester Runway
>
> One number for what today can cost.
> A date you run out — and why it moved.
>
> github.com/aigerim444/hackrice2026
> Aigerim Zhadikbay · Wendy Jin · Rice '28

---
---

# Video script — 2 minutes

Written for a screen recording with voiceover. Record the screen on your phone
(iOS: Control Centre → Screen Record), then talk over it.

**Before recording:** phone on Do Not Disturb, auto-lock **Never**, app already
past onboarding. Do one silent dry run to get the taps smooth — you'll edit out
nothing, so fumbles cost you.

---

**[0:00 — your face, or the title slide]**

> I moved off campus this year, so now I pay rent every month. But my money came
> in two chunks — a summer internship, and a scholarship in August. Two deposits,
> months apart, then nothing for the rest of the term.
>
> Every budgeting app assumes you get paid monthly. None of them work for this.

**[0:15 — Home screen]**

> So the question I actually have isn't "am I over budget." It's: my friends want
> dinner tonight, can I say yes?
>
> That's what today can cost, after rent and everything else already spoken for.
> And that's the day I run out at my current pace — November 19th. Term ends
> December 12th.

**[0:35 — tap the run-out date → Runway screen]**

> The date isn't a guess you have to trust. Everything that moved it is listed:
> dipped into rent, picked up shifts at work.

**[0:45 — + → Scan a receipt. Point at a real receipt.]**

> Point the camera at a receipt and Gemini reads the merchant, the total, and the
> line items — then guesses which envelope it belongs in.
>
> Before I confirm, it tells me what the charge does to today.

**[Tap Drop it in — land on Home]**

> And the date moves.

**[1:05 — + → What if I… Type the question.]**

> This is the part we care most about.
>
> Most AI money apps hand the model your data and hope. We didn't. Our projection
> engine is a pure function, and Gemini gets it as callable tools — it isn't
> allowed to do arithmetic at all.

**[Answer lands — zoom or point at the chips]**

> Those chips are what it actually ran. Every number in that sentence came out of
> the engine. It can be wrong about tone. It cannot be wrong about money, because
> it was never able to produce a number.

**[1:30 — You → Semester Wrapped → Sound on]**

*Let the narration play for one card, then thumb through two more.*

> At the end of term you get this. Gemini writes the script from your real
> ledger, ElevenLabs reads it out.

*Skip this beat entirely if the label says "Device voice" — that means
ElevenLabs isn't running.*

**[1:45 — close, on the Friends tab or the title slide]**

> Expo, Gemini, ElevenLabs and Supabase — real accounts, real shared goals
> between two phones. And every AI path falls back, so it still works with no
> network at all.
>
> Semester Runway. One number for what today can cost.

---

## Recording notes

- **Talk slower than feels natural.** Everyone rushes a demo video.
- **Don't narrate taps** — "now I'm tapping the plus button" is dead air. Say
  what it *means*.
- The two moments worth the most are **the receipt scan** and **the tool-trace
  chips**. If you're over time, cut Runway and Wrapped, never those two.
- Upload to YouTube unlisted and paste the link in Devpost's video field. It
  sits above your gallery images, so it's the first thing a judge sees.
