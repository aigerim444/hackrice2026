-- Semester Runway — real cross-user invites
--
-- STATE.md §4 documents invites as a stub: a fund/challenge member lands as
-- 'invited' and stays there forever, because there was no second real account
-- to accept it. Now that auth exists, this migration makes that transition
-- real: an invited user can see what they're invited to and flip their own
-- membership row to an accepted status — and only their own row, never
-- anyone else's, never any other column on it.
--
-- No new status values. fund_member_status / challenge_participant_status
-- (0001_init.sql) already match src/domain/types.ts exactly; this migration
-- only adds a way to reach the existing 'accepted' states, not new ones.

-- ---------------------------------------------------------------------------
-- fund_members / challenge_participants: a real link to an invited account
-- ---------------------------------------------------------------------------
--
-- member_id / participant_id were always a stand-in identity — the owner's
-- own auth id for their "You" row, or a row in the owner's own private
-- `people` table otherwise (see the comment on fund_members in
-- 0001_init.sql: "never a second Supabase account"). invited_user_id is that
-- second account, when there is one: null for the owner's own row and for a
-- people-only contact nobody has linked to a real sign-up, set to the real
-- auth.users id when an invite targets one.

alter table fund_members
  add column invited_user_id uuid references auth.users(id) on delete cascade;

alter table challenge_participants
  add column invited_user_id uuid references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Column-level self-update enforcement
-- ---------------------------------------------------------------------------
--
-- RLS policies can restrict which *rows* a role can touch, but not which
-- *columns* within an allowed row — that needs a trigger. An invited member
-- updating their own row may only move `status` (and, for a fund, how much
-- they've put in); every other column has to come back unchanged or the
-- write is rejected. The owner is exempt: it's their fund/challenge, and
-- inviting, removing or editing a member's pledge is already how
-- hydrateFund/addFund work today.

create function enforce_fund_member_self_update() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> old.user_id then
    if new.fund_id is distinct from old.fund_id
      or new.member_id is distinct from old.member_id
      or new.user_id is distinct from old.user_id
      or new.invited_user_id is distinct from old.invited_user_id
      or new.name is distinct from old.name
      or new.is_you is distinct from old.is_you
      or new.weekly_pledge is distinct from old.weekly_pledge
      or new.created_at is distinct from old.created_at
    then
      raise exception 'a fund member may only update their own status or contributed amount';
    end if;
  end if;
  return new;
end;
$$;

create trigger fund_members_enforce_self_update
  before update on fund_members
  for each row execute function enforce_fund_member_self_update();

create function enforce_challenge_participant_self_update() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> old.user_id then
    if new.challenge_id is distinct from old.challenge_id
      or new.participant_id is distinct from old.participant_id
      or new.user_id is distinct from old.user_id
      or new.invited_user_id is distinct from old.invited_user_id
      or new.name is distinct from old.name
      or new.is_you is distinct from old.is_you
      or new.streak_days is distinct from old.streak_days
      or new.created_at is distinct from old.created_at
    then
      raise exception 'a challenge participant may only update their own status';
    end if;
  end if;
  return new;
end;
$$;

create trigger challenge_participants_enforce_self_update
  before update on challenge_participants
  for each row execute function enforce_challenge_participant_self_update();

-- ---------------------------------------------------------------------------
-- RLS: replace select/update on the member tables
-- ---------------------------------------------------------------------------
--
-- insert/delete stay owner-only (unchanged from 0001_init.sql) — accepting an
-- invite never lets a member add or remove a row, only transition their own.

drop policy "fund_members_select" on fund_members;
drop policy "fund_members_update" on fund_members;

-- The owner sees every member of their own fund; an invited real user sees
-- (only) their own membership row, regardless of status — they have to see
-- what they're being invited to before deciding whether to accept it.
create policy "fund_members_select" on fund_members
  for select using (auth.uid() = user_id or auth.uid() = invited_user_id);

-- Row-level half of "own row only, and only if you're the owner or the
-- invited member"; enforce_fund_member_self_update (above) is the
-- column-level half for the non-owner case.
create policy "fund_members_update" on fund_members
  for update using (auth.uid() = user_id or auth.uid() = invited_user_id);

drop policy "challenge_participants_select" on challenge_participants;
drop policy "challenge_participants_update" on challenge_participants;

create policy "challenge_participants_select" on challenge_participants
  for select using (auth.uid() = user_id or auth.uid() = invited_user_id);

create policy "challenge_participants_update" on challenge_participants
  for update using (auth.uid() = user_id or auth.uid() = invited_user_id);

-- ---------------------------------------------------------------------------
-- RLS: funds / challenges — an invitee needs to read the parent row too
-- ---------------------------------------------------------------------------
--
-- The member row alone (label-less, no target/occasion) isn't enough to
-- render what someone's being invited to. This subquery is itself scoped by
-- fund_members'/challenge_participants' own select policy above, so it can
-- only ever confirm what the querying user could already see directly — it
-- doesn't widen access, it just lets the parent row follow the same grant.
-- Insert/update/delete stay owner-only: accepting a membership never lets a
-- member edit the fund/challenge itself.

drop policy "funds_select" on funds;
create policy "funds_select" on funds
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from fund_members
      where fund_members.fund_id = funds.id and fund_members.invited_user_id = auth.uid()
    )
  );

drop policy "challenges_select" on challenges;
create policy "challenges_select" on challenges
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from challenge_participants
      where challenge_participants.challenge_id = challenges.id
        and challenge_participants.invited_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- profiles — minimal public identity (id, name — never email)
-- ---------------------------------------------------------------------------
--
-- Backs the "Who's in?" picker and rendering another member's name once
-- they're a real account rather than a row in the inviter's own `people`
-- table. Deliberately thin: no email, no other auth.users column.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Any signed-in user can look up any name — that's the whole point of a
-- shared invite picker — but only a name, and only via this table, never a
-- grant against auth.users itself.
create policy "profiles_select_any_authenticated" on profiles
  for select
  to authenticated
  using (true);

-- Not exercised by the app yet, but there's no reason a user shouldn't be
-- able to keep their own display name in sync themselves.
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Backfill whoever already exists (test accounts from earlier sessions,
-- if any survive), then keep it in sync for every signup from here on.
insert into profiles (id, name)
select id, coalesce(raw_user_meta_data->>'name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

create function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
