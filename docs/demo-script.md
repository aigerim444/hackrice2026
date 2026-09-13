# Demo script — 90 seconds

Ordered so the two things judges remember land in the middle, and the story
lands first. Times are generous; you'll run faster live.

**Before you start:** phone charged, `npx expo start -c` already running, app
already past onboarding and sitting on Home. Have a real paper receipt in your
pocket. Do **not** re-run onboarding live — it's five steps and it eats a third
of your time.

---

## 0:00 — the hook (10s)

> "I moved off campus this year, so now I pay rent every month. But my money
> came in two chunks — a summer internship and a scholarship in August. Every
> budgeting app assumes I get paid monthly. None of them work for this."

Say it as yourself. It's true, and it's the strongest thing you have.

## 0:10 — the number (15s)

*Show Home.*

> "So the question I actually have isn't 'am I over budget.' It's — my friends
> want dinner tonight, can I say yes?"

*Point at the big number.*

> "That's what today can cost, after rent and everything else already spoken
> for. And this" — *point at the run-out date* — "is the day I run out at my
> current pace. Right now, November 19th. Term ends December 12th."

## 0:25 — scan a real receipt (25s) ★

*Hand your phone to a judge, or pull out your own receipt.*

> "Point it at anything."

*Scan. Wait for the sheet.*

> "Gemini read the merchant, the total, and the line items — and guessed which
> envelope it belongs in. Before I confirm, it tells me what it does to today."

*Tap Drop it in. Land back on Home.*

> "And the date moved."

**Why this first:** it's interactive, it uses their receipt, and it proves the
app is real rather than a mockup. If the camera misbehaves, tap **No receipt →**
and type an amount — same charge, same maths, no dead air.

## 0:50 — the coach that can't do arithmetic (25s) ★★

*+ → What if I…*

> "Ask it anything."

*Type: `if i buy the AirPods Pro for $249 and pick up 5 more hours a week?`*

*While it thinks:*

> "Here's the thing we care most about. Most AI money apps hand the model your
> data and hope. We didn't. Our projection engine is a pure function, and Gemini
> gets it as callable tools — it's not allowed to do arithmetic at all."

*Answer lands. Point at the chips underneath.*

> "Those chips are what it actually ran. Every number in that sentence came out
> of the engine. It can be wrong about tone. It cannot be wrong about money,
> because it was never able to produce a number."

**This is your Technical Rigor mark.** Don't rush it. If a judge looks
skeptical, offer: *"ask it something it has no tool for — it'll tell you it
doesn't know rather than make something up."*

## 1:15 — Wrapped (15s)

*You → Semester Wrapped → tap **Sound**.*

Let it talk for one card, then thumb through two more.

> "End of term you get this. Gemini writes the script from your real ledger,
> ElevenLabs reads it. Every figure is something the app can actually prove."

**Only do this if the label reads `Sound ✓`.** If it says `Device voice`,
ElevenLabs isn't running — skip the sound and just swipe the cards, or skip
Wrapped entirely and spend the time on the coach.

## 1:30 — the close (5s)

> "Built on Expo, Gemini, ElevenLabs and Supabase — real auth, real shared
> goals between two phones. And every AI path falls back, so it still works
> with no network."

---

## If they ask questions

**"Is this actually working or is it hardcoded?"**
> "Scan your own receipt." — best possible answer, so keep one path interactive.

**"How do you stop it hallucinating?"**
> "It has no calculator. It picks which question to ask, the engine answers it,
> and it's only allowed to quote strings the engine handed back. 42 tests pin
> that."

**"What's not finished?"**
> Be straight: Wrapped uses a completed demo semester rather than your live one,
> and receipt OCR needs a real camera. Judges trust a team that knows its own
> gaps.

**"Why not just use a spreadsheet?"**
> "Because a spreadsheet doesn't tell me the date I run out, and it doesn't move
> when I pick up a shift. The whole point is the number changes as my life does."

---

## Failure drills — decide these *now*, not on stage

| If | Do |
|---|---|
| Camera won't focus | **No receipt →**, type it. Same charge, same maths |
| Coach answers with no chips | Gemini is down; it's the offline heuristic. Say "that's the fallback running — it still gets the number right, it's just less conversational" and move on. That's a *feature* |
| Wrapped says `Device voice` | Skip the sound. Don't mention ElevenLabs |
| Wifi dies completely | Keep going. Every path degrades. Point that out — it's the most impressive thing that can happen to you |
| App restarts mid-demo | It goes back to onboarding (no local persistence yet). Don't panic-click; say "one sec" and click through — or better, don't let the phone lock |

The last row is the real risk. **Set your phone's auto-lock to Never before you
walk up.**
