-- Semester Runway — seed
--
-- Reproduces src/data/mock/seed.ts's SEED_SNAPSHOT, but only the part STATE.md
-- §3 calls "facts about the term rather than choices": the lump (aid + summer
-- income) and the four standing bills. No people, no jobs, no funds, no
-- challenges, no expenses — a first run starts empty on purpose, and since
-- priorCategoryTotals/priorFreeSpend are now derived from `expenses` at read
-- time (STATE.md §4), an empty expenses table already reconciles to zero
-- without a separate constant to keep in sync.
--
-- Idempotent and user-agnostic: it seeds one semester for every auth user who
-- doesn't already have one, rather than a single hardcoded demo account,
-- because this is a real multi-tenant backend, not a single-user prototype.
-- supabaseApi.getSnapshot() does the same provisioning lazily for a user who
-- reaches the app before this script has run against their account; this
-- script exists so a fresh project (or a fresh test user, e.g. for
-- scripts/smoke.ts) already has data to read without opening the app first.

insert into semesters (
  user_id, label, start_date, end_date, today, last_paid_week,
  user_name, user_initial, observed_daily_pace, setup_complete
)
select
  u.id,
  'Fall 2026',
  date '2026-08-24',
  date '2026-12-12',
  date '2026-09-11',
  date '2026-11-13',
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  upper(left(coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), 1)),
  0,
  false
from auth.users u
where not exists (select 1 from semesters s where s.user_id = u.id);

-- The lump: aid refund + summer money, one row each, matching seed.ts's two
-- IncomeSource entries.
insert into income_sources (user_id, semester_id, kind, label, sublabel, amount, received_on)
select s.user_id, s.id, 'aid', 'Aid refund', 'grants after tuition', 3800, s.start_date
from semesters s
where not exists (
  select 1 from income_sources i where i.semester_id = s.id and i.kind = 'aid'
);

insert into income_sources (user_id, semester_id, kind, label, sublabel, amount, received_on)
select s.user_id, s.id, 'summer', 'Summer money', 'what''s left of it', 2440, s.start_date
from semesters s
where not exists (
  select 1 from income_sources i where i.semester_id = s.id and i.kind = 'summer'
);

-- The four standing bills from seed.ts, keyed off each user's own semester id
-- so ids stay unique per user (`bill-rent` etc. would collide across users
-- otherwise, since bills.id is a plain text primary key).
insert into bills (id, user_id, semester_id, label, envelope, amount, cadence, due_day, due_date, prepaid)
select s.id::text || '-bill-rent', s.user_id, s.id, 'Rent', 'rent', 520, 'monthly', 1, null, false
from semesters s
where not exists (select 1 from bills b where b.semester_id = s.id and b.label = 'Rent');

insert into bills (id, user_id, semester_id, label, envelope, amount, cadence, due_day, due_date, prepaid)
select s.id::text || '-bill-phone', s.user_id, s.id, 'Phone', 'fees', 45, 'monthly', 15, null, false
from semesters s
where not exists (select 1 from bills b where b.semester_id = s.id and b.label = 'Phone');

insert into bills (id, user_id, semester_id, label, envelope, amount, cadence, due_day, due_date, prepaid)
select s.id::text || '-bill-fees', s.user_id, s.id, 'Campus fees', 'fees', 195, 'once', null, date '2026-10-05', false
from semesters s
where not exists (select 1 from bills b where b.semester_id = s.id and b.label = 'Campus fees');

insert into bills (id, user_id, semester_id, label, envelope, amount, cadence, due_day, due_date, prepaid)
select s.id::text || '-bill-meal', s.user_id, s.id, 'Meal plan', 'fees', 0, 'once', null, null, true
from semesters s
where not exists (select 1 from bills b where b.semester_id = s.id and b.label = 'Meal plan');
