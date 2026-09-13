# Semester Runway Finance App

_Started 2026-09-12 02:45 UTC_

---

## User

Design a mobile app for this app idea: Semester Runway (Finance). Aid refunds and summer earnings land as one lump in August, and people are broke by November. Enter the lump plus known bills (rent, phone, meal plan), and it gives a daily safe-to-spend number that correctly shrinks to end-of-semester, with "at this pace you run out Nov 14" warnings. Budget apps assume a monthly paycheck; students don't have one.
Semester Runway
- internship earnings
- financial aid / scholarships awards
- on-campus job
- show categories of spending
- take photos of receipts and can figure out price and category
- on-campus job hours + rate + what-if
- handle what-if queries
    - if i buy this… what does it do
    - the ai can give alternate cheaper options, or say to wait until u work 2 more weeks in ur job or something
- semester-wrapped (like spotify wrapped)
- explain why the date moved up or back
- can add friends to set goals
    - make money
    - no eating out @ restaurants
    - no boba / drinks / matcha / coffee
    - no delivery
    - no new clothes
    - no new __

## Assistant



## Assistant

_[tool: ask_user]_

Waiting on your picks (visual direction, platform, priority screens, AI tone) — then I'll start building.

## User

Answered — Asked for follow-up questions; design_system: Picked a design system (now attached); platform: iOS; deliverable: Hi-fi screens + options; screens: Onboarding (lump + bills), Home: daily safe-to-spend, Runway date + why it moved, Receipt scan, What-if / AI chat, Job hours & what-if, Friends & goals, Semester Wrapped; ai_voice: Playful coach (encouraging, light humor); runway_metaphor: Calendar heat-strip to semester end; variations: 2–3 options; notes: professional ish bc its financey, but also make it a bit cutesy bc its for students

## Assistant



## Assistant

_[tool: ask_user]_

Round two is up — waiting on how the options should differ and where the cutesy lives.

## User

Answered — option_axis: Personality dial (professional ↔ cutesy); cutesy_how: A mascot / character, Rounded, bubbly type; friends_visibility: Shared pot: everyone's savings toward a goal; wrapped_format: Story cards (swipe); onboarding_depth: 3 quick steps; open_questions: 1. not a question, but make it Rice themed like the mascot can be an owl and the colros can be the school color navy

## Assistant

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: copy_starter_component]_

_[tool: grep]_

_[tool: copy_files]_

_[tool: dc_write]_

_[tool: dc_set_props]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Out for review. Three home-screen dial settings (1a strict Modernist → 1b campus → 1c full owl) plus the seven flow screens in 1b's style; the job-hours tweak moves the run-out date across every heat-strip. Tell me which dial setting to commit to and I'll re-skin the flow to match.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Fixed the clipped chips, the wrapping greeting, and the "for12h" spacing. The remaining flags are intentional horizontal chip scrollers and the receipt placeholder sitting behind the parsed sheet. Note 1c uses emoji deliberately as the cutesy pole — say if you'd rather keep it icon-only.

## User

this screeen is giving ai generated. might be the emojis and the overall feel

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: run_script]_

_[tool: ready_for_verification]_

Reworked 1c: emoji gone, speech bubble and pill-soup gone. It keeps Baloo 2 and the owl, but borrows Modernist's spine — flush-left type, 3px navy rules, a ruled category list — so the cute comes from the type and the mascot, not decoration. Also dropped the stray owl emoji in 1g.

## User

how does the pot "gain money"

## Assistant

A shared pot is a commitment ledger, not a bank account:

- **Skips add virtual money.** When you scan a receipt or tell the app "skipped a boba," it logs the price you *would* have paid (from your own history or the friend's average) and credits it to the pot. Nothing moves; it's a tally of avoided spend.
- **Caving subtracts.** Buying a goal-item (like the Tiger Sugar in 1f) deducts that price, so the pot is honest, not just a streak.
- **Earning counts too.** For "make money" goals, logged shifts credit real income (Dev's +$93).
- **Payoff is the destination.** Each pot has a target and a purpose ("$400 → Austin trip"). At the end, each person's tally is what they've kept in their own runway — the app can nudge "move your $88 to a savings pocket" or just show it as spendable on the trip.

Do you want it to stay a tally, or actually move money (e.g. auto-transfer skipped amounts into a shared/individual savings pocket)? The second is stronger but needs bank linking.

## User

i feel like saving up for a trip should feel like a more intentional thing. skipping boba is not equal to gaining money for a trip.

## Assistant

_[tool: grep]_

_[tool: run_script]_

_[tool: grep]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Agreed — split them in 1i:

- **Fund** (Austin trip): real money, each person pledges a weekly amount ($20/wk) that's carved out of their runway up front; "Set aside $20 now" is the intentional act. Progress shows who's on track.
- **Challenges** (no boba, no delivery, no new clothes): streaks with friends, no dollars attached. Their payoff is shown as runway days kept, not fund money.

Also updated the receipt-scan and 1c copy so caving breaks a streak instead of "losing pot money."

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

1c now fits the frame with the tab bar visible. The remaining flag is the receipt placeholder sitting behind the parsed sheet — intentional.

## User

how would you log a "skipped" boba, is this just a thought

## Assistant

Fair — a "skip" is a non-event, so it's only real if the app can detect it. Options, roughly from honest to hand-wavy:

- **Inferred from absence.** The app knows your pattern (boba ~3×/week, Tue/Thu after class). Days that pass in a challenge with no drink logged/charged count as the streak advancing. No tap needed — that's the streak model 1i now uses.
- **Moment of temptation.** When you ask "what if I get a boba?" in chat, or scan a price tag and back out, that's an explicit skip — the one case you can count.
- **Location nudge.** Phone's near Tiger Sugar for 5+ minutes, no charge follows → "Skip that?" one-tap confirm. Creepy for some; opt-in only.
- **Self-report.** A "skipped" button. Cheap, but people forget or fudge it.

So "41 skipped bobas" in Wrapped is a guess unless it's built from (a)+(b). Honest rewording: "11 weeks with fewer bobas than August" or "you asked 'what if' 41 times and walked away 29." Want me to change the Wrapped line to something the app can actually know?

## User

wait it doesnt make sense to have it as a gained +$ amount. it should just be "saved" or something. this is ok: "11 weeks with fewer bobas than August. yes to this: Wrapped line to something the app can actually know?

## Assistant

_[tool: grep]_

_[tool: run_script]_

_[tool: ready_for_verification]_

Wrapped now reads "What moved the date": earned $1,116 from shifts; saved ~$180 over 11 weeks with fewer bobas than August (vs. your August rate — knowable from transactions); saved ~$210 from zero delivery in October. "Earned" vs "saved" instead of a uniform +$.

## User

this looks messy, uneven, odd

## Assistant

_[tool: read_file]_

_[tool: run_script]_

_[tool: ready_for_verification]_

Wrapped card 1j is rebuilt: hero date, one 2px rule, then three equal-width stat cells (number on top, "earned/saved" + reason below) instead of the ragged two-column ledger; owl shrunk and moved down so it no longer collides with the text.

## User

what are the other design systems you have as an option and could i change it to one of htem

## Assistant



## Assistant

I can't list them from here — the design-system picker is in the form. Yes, you can switch: pick one below and I'll re-skin the screens to it (keeping Rice navy + owl as overrides where you want them).

_[tool: ask_user]_

Waiting on your pick.

## User

keep rounded type, and use this style. but not the yellow color it dosnet fit our product. use best judgement. we're not goign for rice specific, just college students

## User

keep rounded type, and use this style. but not the yellow color it dosnet fit our product. use best judgement. we're not goign for rice specific, just college students

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Turn 2 is at the top: all eight screens re-skinned neo-brutal (cream ground, 3px black borders, hard shadows, Baloo 2 throughout). Yellow is replaced by sky blue as the primary, mint for on-track, pink for run-out warnings; Rice navy and the owl are dropped. Turn 1 stays below for comparison.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: run_script]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

Toned down turn 2 in place: borders 3→2px, shadows shortened, fills desaturated (softer blue/mint/pink), most surfaces now white on cream with one colored hero block per screen, Wrapped moved off the full-blue ground. Baloo 2, square corners, and the hard-edge structure stay, so the student feel is intact. Also fixed the earlier overlaps (2a grid, 2c list, 2f button, Aug/Sep labels).

## User

can you explore and show us 3 best designs options. like different from this one. consider users, pain points, purpose, style, etc.

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Turn 3 is at the top with three genuinely different spines:

- **3a Countdown** — dark, calm; the run-out date is the hero and today's number is the fix. For the anxious planner who fears not seeing it coming.
- **3b Envelopes** — warm paper; the lump is shown pre-split into rent, fees, trip fund, spent, and the only "yours" envelope gives the daily number. For the first-time budgeter who treats the refund as free money.
- **3c Timeline** — light, cool; a vertical semester feed of paychecks, bills, and events with the run-out marker in-line, so cause and effect is visible. For the working student juggling shifts.

Tell me which spine to build the flow on, or which pieces to merge.

## User

Address these comments from my teammates:

**aigerim** (on `Semester Runway.dc.html` at `#\33 c .sc-host-x div [data-dc-tpl="139"]`):
<commented-element>react:    Semester Runway › IOSDevice
dom:      body › div#dc-root › div.sc-host › section#t3.dv-turn › div.dv-opts › div#3c.dv-opt › div.dv-card › div.sc-host-x › div › div › div › div › div[2/4]
text:     "11 Today · Fri $9.40 so far Tiger Sugar $8.65 · vending $0.…"
children: div, div
selector: #…</commented-element>
<teammate-comment>this timeline somehow moving down is unintuitive</teammate-comment>

**aigerim** (on `Semester Runway.dc.html` at `#\33 b >.dv-card`):
<commented-element>react:    Semester Runway
dom:      body › div#dc-root › div.sc-host › section#t3.dv-turn › div.dv-opts › div#3b.dv-opt › div.dv-card[2/2]
text:     "9:41 Your $6,240 Aug 24 → Dec 12 One lump, sorted into enve…"
children: div
selector: #\33 b &gt;.dv-card</commented-element>
<teammate-comment>everything about this look muted for some reason. can you fix it but dont add too much color where it will look like the neobrutalist one.</teammate-comment>

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Addressed both:

- **3c** — timeline now runs left→right along a horizontal axis (Aug → Dec) with today, paycheck, rent, run-out and finals as markers; upcoming events are cards you swipe through beneath it, plus a one-line "why −3 days" summary.
- **3b** — lifted contrast without going brutalist: envelopes are white with ink borders on a lighter cream, the trip fund gets a single sage fill, "already spent" is a dashed ghost, text darkened, and the free-to-spend block gets a soft paper shadow. Coral stays the only warning color.

## User

i like the feel of this page. apply to other important screens, basically redesign

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Turn 4 is at the top: the full flow rebuilt on 3b's envelope system (4a–4g). The envelope became the app's core metaphor — receipts drop into one, what-ifs and shifts refill Free-to-spend, the trip fund is a shared envelope, and Wrapped shows the envelopes emptied. 3b itself stays as the home screen.

## User

this doesnt really look like a chat interface, the white box / response takes up too much space?

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

4d is now a proper thread: a header with the coach avatar, a prior Tuesday exchange for history, day/time dividers, and the AirPods answer split into three short bubbles (verdict → routes → sign-off) instead of one big card, with quick replies and a camera-in-composer at the bottom.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Fixed 4d: bubbles no longer shrink (so nothing clips), dropped the Tuesday history so the thread fits, and shortened the header labels so they stay on one line.

## User

how about the case if someone has more than one on campus job

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Handled in the envelope flow:

- **4a onboarding** — jobs are a stacked group (Library desk, Rec center), each with its own rate, hours and pay cadence (biweekly vs monthly matters for when money lands), plus a combined "~$270/wk" total and "+ another job" row.
- **4e job what-if** — a job picker at the top; the slider applies to the selected job while the other stays fixed ("Rec center stays at 6 h"), and the summary shows all-jobs hours so the date reflects both.

Pay cadence also feeds the timeline/why-it-moved logic: two paychecks landing on different days is exactly what moves the date around.

## User

can you make the pages for the other stuff in the wrapped recap?

## Assistant

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

Turn 5 adds the other six Wrapped cards (5a–5f), alternating cream and ink: the lump → the forecast line that moved (Nov 14 → Dec 12) → [envelopes emptied, 4g] → top category with a ranked bar list → your week's rhythm (Friday, 2:41 AM receipt) → friends (trip funded, longest streaks) → a shareable poster with a "set up spring" hook. All stats are things the app can actually know.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Fixed: streak values no longer wrap in 5e, the step-chart labels in 5b sit clear of the lines, 5a/5b fill their frames (bigger heroes, an envelope summary row on 5a), and the 5f header/legend stay on one line.

## User

can you combine all of these things and create a clickable prototype for all these screens of the product

## Assistant

_[tool: dc_write]_

_[tool: ready_for_verification]_

New file **Semester Runway Prototype** — one live phone with a jump list beside it. Everything runs off one model, so actions ripple:

- Onboarding (editable lump + bills, fund slider) → envelopes home
- Tap Free-to-spend → runway "why it moved" → "Try it" → jobs what-if (per-job sliders move the date)
- Scan receipt → reads after a beat → pick envelope → "Drop it in" logs it, updates today/Spend, and breaks the boba streak if it's Drinks
- What-if chat: type any price (or use chips) and the coach answers with days-of-runway plus cheaper routes
- Friends: "Move $20 in" shifts money from Free to the trip fund and lowers the daily number
- You → Semester Wrapped, 7 tappable cards

Left panel has a Reset. Tweaks let you set the start screen.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Applied a single root-cause fix: every two-item space-between row now keeps its right-hand meta on one line and lets the left block take the remaining width, with explicit exceptions for the long-copy rows (the "two extra shifts" nudge and chat route labels) so they still wrap.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Selector fixed (it now matches the runtime's serialized style), and the three-label slider rows are pinned so they don't collapse.

## User

Found issues — fixing…

## Assistant

Root cause: the first-child rule applies to 3+-child label rows too. Scoping it to two-child rows only.

_[tool: run_script]_

_[tool: ready_for_verification]_

The row rule now only fires on two-child rows, so the multi-label axes (Aug 24 / today / Dec 12, month labels, legend) space evenly again.

## User

this is what a budgeting app i tried out to see looks like, with a home screen where you scroll down and see everything consolidated. i feel like its very intuitive to have it that way so is there a way we cna inclue that in semeseter runway

## User

this is what a budgeting app i tried out to see looks like, with a home screen where you scroll down and see everything consolidated. i feel like its very intuitive to have it that way so is there a way we cna inclue that in semeseter runway

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Root cause was a missing `box-sizing` reset in the prototype (the design file got it from the linked stylesheet), so every padded full-height screen ran 56–62px tall. Added the reset once; all screens now fit the frame with the tab bar inside.

## User

make the design less busy. therer is too many things going on at once even for someone who knows what its about. ask followups

## Assistant



## Assistant

_[tool: ask_user]_

Waiting on your picks — mainly which home cards survive and what the one hero number is.

## User

Answered — scope: Whole prototype; home_cards: Today (left to spend), Runway date, Income / paychecks, Spending by category, Trip fund + streaks; one_number: Left today ($27.60); visual_cuts: Fewer boxes — use whitespace + rules instead; nav: Keep 4 tabs; chat_role: Fold into + button; friends_role: Keep fund + streaks

## Assistant

_[tool: run_script]_

_[tool: run_script]_

_[tool: ready_for_verification]_

Simplified across the prototype:

- **Home**: one hero — "Left to spend today $27.60" — then four rule-separated sections (Runway, Next paychecks, Spending, Austin trip + streaks). No envelope bar, activity feed, summary, or calendar strip.
- **Fewer boxes everywhere**: list rows and controls are now separated by thin rules instead of bordered white cards; shadows removed; borders kept only for buttons, inputs and the one ink block per screen.
- **One "+" button** opens a sheet with Scan a receipt / What if I… / Move money — the floating What-if button is gone.
- 4 tabs and Friends (fund + streaks) unchanged.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Both job rows in onboarding are now a single borderless sage group, and the run-out dates are pinned to one line.

## User

in move money to the trip what is "Free to Spend"?

## Assistant

"Free to spend" is the app's name for the one envelope that's actually yours: your lump minus what's already set aside for rent, phone/fees, and the trip fund, minus what you've spent. The daily number ($35/day) is just that envelope divided by the days left. Moving money "to the trip" takes it out of Free to spend, so your daily number drops a little.

The label is jargon on that sheet, though — it's the first place a new user meets it without context. I'd change the sheet copy to "from your spending money ($35/day → $34.80)" and keep "Free to spend" as the envelope name on the runway screen where it's explained. Want me to make that change?

## User

can you make it describ eit in a way that makes snese

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

The sheet now reads "Put $20 toward the trip — comes out of your spending money — $35/day becomes $34.78", and the Friends button, note, and confirmation toast use the same plain language (spending money / daily number) instead of "Free to spend".

## User

can you make the options that show up at clicking the + to be a popup type rather than a tab how it is rn. just wanna see what would look best

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

The + now opens a popover anchored above the button (with a little pointer), the + rotates into an × to close, and the background dims lightly. Same three actions. Tap + on Home to compare with the old bottom sheet — say which reads better.

## User

Found issues — fixing…

## Assistant

_[tool: run_script]_

_[tool: ready_for_verification]_

Fixed: the close button stays a square (only the glyph rotates to ×, fully covering the +), and the popover is wider with text blocks filling the row so subtitles stay on one line.

