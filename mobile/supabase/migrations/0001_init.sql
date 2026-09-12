-- Semester Runway — initial schema
--
-- Satisfies the wire contract in src/data/http/httpApi.ts exactly (15
-- endpoints, header comment). Every column here traces back to something that
-- contract or src/data/mock/seed.ts requires — nothing speculative.
--
-- One exception, called out where it happens: `priorCategoryTotals` and
-- `priorFreeSpend` on SemesterSnapshot are NOT stored. STATE.md §4 documents
-- them as two independent constants in the mock that a real backend should
-- derive from one transaction feed so they reconcile by construction. Here
-- that feed is `expenses`, and both fields are computed at read time in
-- supabaseApi.getSnapshot() instead of persisted.
--
-- Every table: user_id references auth.users(id) on delete cascade,
-- created_at timestamptz default now(), RLS enabled with select/insert/
-- update/delete policies scoped to auth.uid() = user_id.

-- ---------------------------------------------------------------------------
-- enums
-- ---------------------------------------------------------------------------

create type envelope_id as enum ('rent', 'fees', 'fund', 'free');

create type expense_category as enum (
  'Eating out', 'Groceries', 'Delivery', 'Books', 'Drinks', 'Other'
);

create type income_kind as enum ('aid', 'summer', 'other');

create type pay_cadence as enum ('weekly', 'biweekly', 'monthly');

create type bill_cadence as enum ('monthly', 'once');

create type fund_member_status as enum ('ahead', 'on track', 'behind', 'new', 'invited');

create type challenge_participant_status as enum ('joined', 'invited');

create type chat_role as enum ('user', 'coach');

-- ---------------------------------------------------------------------------
-- semesters — one "current" semester per user
-- ---------------------------------------------------------------------------

create table semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  today date not null,
  last_paid_week date not null,
  user_name text not null,
  user_initial text not null,
  observed_daily_pace numeric not null default 0,
  setup_complete boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table semesters enable row level security;

create policy "semesters_select" on semesters for select using (auth.uid() = user_id);
create policy "semesters_insert" on semesters for insert with check (auth.uid() = user_id);
create policy "semesters_update" on semesters for update using (auth.uid() = user_id);
create policy "semesters_delete" on semesters for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- income_sources — IncomeSource[]
-- ---------------------------------------------------------------------------

create table income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  kind income_kind not null,
  label text not null,
  sublabel text not null,
  amount numeric not null,
  received_on date not null,
  created_at timestamptz not null default now()
);

alter table income_sources enable row level security;

create policy "income_sources_select" on income_sources for select using (auth.uid() = user_id);
create policy "income_sources_insert" on income_sources for insert with check (auth.uid() = user_id);
create policy "income_sources_update" on income_sources for update using (auth.uid() = user_id);
create policy "income_sources_delete" on income_sources for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- jobs — Job[]
-- ---------------------------------------------------------------------------

create table jobs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  name text not null,
  hourly_rate numeric not null,
  hours_per_week numeric not null,
  baseline_hours_per_week numeric not null,
  pay_cadence pay_cadence not null,
  next_pay_date date not null,
  next_pay_amount numeric not null,
  created_at timestamptz not null default now()
);

alter table jobs enable row level security;

create policy "jobs_select" on jobs for select using (auth.uid() = user_id);
create policy "jobs_insert" on jobs for insert with check (auth.uid() = user_id);
create policy "jobs_update" on jobs for update using (auth.uid() = user_id);
create policy "jobs_delete" on jobs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- bills — Bill[]
-- ---------------------------------------------------------------------------

create table bills (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  label text not null,
  envelope envelope_id not null,
  amount numeric not null,
  cadence bill_cadence not null,
  due_day integer,
  due_date date,
  prepaid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table bills enable row level security;

create policy "bills_select" on bills for select using (auth.uid() = user_id);
create policy "bills_insert" on bills for insert with check (auth.uid() = user_id);
create policy "bills_update" on bills for update using (auth.uid() = user_id);
create policy "bills_delete" on bills for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- people — Person[], the invite-picker directory
-- ---------------------------------------------------------------------------

create table people (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  initial text not null,
  created_at timestamptz not null default now()
);

alter table people enable row level security;

create policy "people_select" on people for select using (auth.uid() = user_id);
create policy "people_insert" on people for insert with check (auth.uid() = user_id);
create policy "people_update" on people for update using (auth.uid() = user_id);
create policy "people_delete" on people for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- funds — Fund[], and their members
-- ---------------------------------------------------------------------------

create table funds (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  label text not null,
  shared boolean not null default false,
  occasion date not null,
  target_amount numeric not null,
  weekly_pledge numeric not null,
  extra_contributed numeric not null default 0,
  started_by text,
  created_at timestamptz not null default now()
);

alter table funds enable row level security;

create policy "funds_select" on funds for select using (auth.uid() = user_id);
create policy "funds_insert" on funds for insert with check (auth.uid() = user_id);
create policy "funds_update" on funds for update using (auth.uid() = user_id);
create policy "funds_delete" on funds for delete using (auth.uid() = user_id);

-- FundMember.id is either the owning user's id ("You") or a people.id — never a
-- second Supabase account (see STATE.md §4 on invites: nobody ever accepts,
-- there's no second device), so this stays scoped by the fund owner's user_id
-- like every other table, not by the member's own identity.
create table fund_members (
  fund_id text not null references funds(id) on delete cascade,
  member_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_you boolean not null default false,
  contributed numeric not null default 0,
  weekly_pledge numeric not null default 0,
  status fund_member_status not null,
  created_at timestamptz not null default now(),
  primary key (fund_id, member_id)
);

alter table fund_members enable row level security;

create policy "fund_members_select" on fund_members for select using (auth.uid() = user_id);
create policy "fund_members_insert" on fund_members for insert with check (auth.uid() = user_id);
create policy "fund_members_update" on fund_members for update using (auth.uid() = user_id);
create policy "fund_members_delete" on fund_members for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- challenges — Challenge[], and their participants
-- ---------------------------------------------------------------------------

create table challenges (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  label text not null,
  sublabel text,
  category expense_category,
  until_date date,
  you_streak_days integer not null default 0,
  broken boolean not null default false,
  created_at timestamptz not null default now()
);

alter table challenges enable row level security;

create policy "challenges_select" on challenges for select using (auth.uid() = user_id);
create policy "challenges_insert" on challenges for insert with check (auth.uid() = user_id);
create policy "challenges_update" on challenges for update using (auth.uid() = user_id);
create policy "challenges_delete" on challenges for delete using (auth.uid() = user_id);

create table challenge_participants (
  challenge_id text not null references challenges(id) on delete cascade,
  participant_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_you boolean not null default false,
  streak_days integer not null default 0,
  status challenge_participant_status not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, participant_id)
);

alter table challenge_participants enable row level security;

create policy "challenge_participants_select" on challenge_participants for select using (auth.uid() = user_id);
create policy "challenge_participants_insert" on challenge_participants for insert with check (auth.uid() = user_id);
create policy "challenge_participants_update" on challenge_participants for update using (auth.uid() = user_id);
create policy "challenge_participants_delete" on challenge_participants for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- expenses — the one transaction feed. Expense[] (today's slice) plus the
-- history priorCategoryTotals/priorFreeSpend are derived from, at read time.
-- ---------------------------------------------------------------------------

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  merchant text not null,
  amount numeric not null,
  category expense_category not null,
  envelope envelope_id not null,
  occurred_on date not null,
  created_at timestamptz not null default now()
);

create index expenses_semester_occurred_idx on expenses (semester_id, occurred_on);

alter table expenses enable row level security;

create policy "expenses_select" on expenses for select using (auth.uid() = user_id);
create policy "expenses_insert" on expenses for insert with check (auth.uid() = user_id);
create policy "expenses_update" on expenses for update using (auth.uid() = user_id);
create policy "expenses_delete" on expenses for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- moves — RunwayMove[], the "why it moved this week" ledger
-- ---------------------------------------------------------------------------

create table moves (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  delta_days integer not null,
  title text not null,
  sublabel text not null,
  positive boolean not null,
  created_at timestamptz not null default now()
);

alter table moves enable row level security;

create policy "moves_select" on moves for select using (auth.uid() = user_id);
create policy "moves_insert" on moves for insert with check (auth.uid() = user_id);
create policy "moves_update" on moves for update using (auth.uid() = user_id);
create policy "moves_delete" on moves for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chat_messages — ChatMessage[], the coach thread
-- ---------------------------------------------------------------------------

create table chat_messages (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  role chat_role not null,
  text text not null,
  routes jsonb,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "chat_messages_select" on chat_messages for select using (auth.uid() = user_id);
create policy "chat_messages_insert" on chat_messages for insert with check (auth.uid() = user_id);
create policy "chat_messages_update" on chat_messages for update using (auth.uid() = user_id);
create policy "chat_messages_delete" on chat_messages for delete using (auth.uid() = user_id);
