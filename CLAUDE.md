# Semester Runway

Read STATE.md and mobile/AGENTS.md at the start of every session — they are
authoritative and more detailed than anything below. In particular: the four-layer
architecture (§2), the known-stub table (§4), the bugs list (§5), and the
do-not-touch list (§6).

## Do not touch
Everything in STATE.md §6, without exception. If a task seems to require touching
one of these, stop and report rather than proceeding. This includes: src/domain/*
(pure, no React/I/O imports, ever), the RunwayApi interface in src/data/api.ts,
mock/* (keep for demo mode, never delete), the pinned test figures in
runway.test.ts, the priorCategoryTotals/priorFreeSpend split in seed.ts, and all
existing visual design (TabBar, DateField, scale.ts, index.html).

## Wrapped stays out of scope
Wrapped stays on SEED_WRAPPED until its own explicit session. Don't wire it to
live data as a side effect of other work.

## Backend
httpApi.ts already defines the wire contract (15 endpoints, header comment). Build
Supabase to satisfy that contract exactly, not a schema designed independently.
Going straight to Supabase — not adding AsyncStorage as an interim persistence
step — since the target is a real backend.

## Supabase
Project already created. URL + anon key in .env.local (gitignored). Email auth
enabled. Do not create a project or change auth settings via CLI — ask in the
dashboard.

## Escape hatch
If a task requires changing src/domain/ or the RunwayApi interface, or contradicts
something STATE.md documents as intentional, STOP and report. Don't work around it
silently.

## Gates
npx tsc --noEmit --noUnusedLocals --noUnusedParameters · npm test (16 tests) ·
npx expo export --platform web — all green before every commit. Never commit red.
Conventional commit subjects, one unit of work per commit.