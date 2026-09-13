-- Semester Runway — the daily streak tick
--
-- STATE.md §4: streaks only ever *break* — logExpense resets streak_days
-- when a charge matches a challenge's category. Nothing advances them,
-- because "no purchase today" is an absence of evidence a client can't
-- prove; it needs a server-side check that runs once a day, for real.
--
-- No rule to import from src/domain — mockApi.logExpense and
-- SupabaseRunwayApi.logExpense both just compare categories directly
-- (`c.category === input.category` / `.eq('category', input.category)`),
-- against the same expense_category enum this function compares against.
-- There's no pure function to reuse; this is the same comparison, done once
-- more, not a second rule invented in SQL.

-- ---------------------------------------------------------------------------
-- Idempotency marker
-- ---------------------------------------------------------------------------
--
-- semesters.today is a frozen constant (every semester is provisioned with
-- the literal '2026-09-11' in ensureSemester and nothing ever advances it).
-- pg_cron fires on the real calendar, though, so without a marker of "have I
-- already ticked this participant for this semester-day" a daily cron would
-- increment every single real day forever against the same simulated date.
-- This column makes the tick a no-op once it's already run for a given day,
-- and stays correct if `today` is ever advanced for real later.

alter table challenge_participants
  add column streak_last_ticked_on date;

-- ---------------------------------------------------------------------------
-- tick_challenge_streaks()
-- ---------------------------------------------------------------------------
--
-- security definer, owned by postgres (same as enforce_fund_member_self_update
-- / handle_new_user in 0002_invites.sql) — postgres owns these tables and
-- isn't subject to their RLS, which this needs: a cron job has no auth.uid(),
-- so the ordinary owner-only policies would otherwise hide every row from it.
--
-- Eligible: status = 'joined' (an 'invited' row hasn't accepted yet — nothing
-- to advance), the challenge isn't broken (nothing un-breaks it today, so
-- advancing a broken challenge would contradict the UI's permanent "you broke
-- yours" state), not past its own until_date, not already ticked for this
-- semester's today, and resolvable to a real account (is_you -> the owner's
-- own user_id; otherwise invited_user_id — a people-only stub with neither
-- has no expenses to check and is skipped, since there's no account to prove
-- an absence of evidence against).
create function tick_challenge_streaks() returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with eligible as (
    select
      cp.challenge_id,
      cp.participant_id,
      cp.is_you,
      case when cp.is_you then cp.user_id else cp.invited_user_id end as real_user_id,
      c.category,
      s.today
    from challenge_participants cp
    join challenges c on c.id = cp.challenge_id
    join semesters s on s.id = c.semester_id
    where cp.status = 'joined'
      and c.broken = false
      and (c.until_date is null or c.until_date >= s.today)
      and cp.streak_last_ticked_on is distinct from s.today
  ),
  resolvable as (
    select * from eligible where real_user_id is not null
  ),
  advancing as (
    select e.*
    from resolvable e
    where not exists (
      select 1 from expenses x
      where x.user_id = e.real_user_id
        and x.category = e.category
        and x.occurred_on = e.today
    )
  ),
  -- Both updates have to live in one statement: a CTE only exists for the
  -- statement it's defined in, so a second top-level `update` further down
  -- can't see `advancing` — chaining it as a data-modifying CTE with
  -- `returning` is what keeps it in scope for the challenges update below.
  bump_participants as (
    update challenge_participants cp
    set streak_days = cp.streak_days + 1,
        streak_last_ticked_on = a.today
    from advancing a
    where cp.challenge_id = a.challenge_id
      and cp.participant_id = a.participant_id
    returning cp.challenge_id, a.is_you
  )
  update challenges c
  set you_streak_days = c.you_streak_days + 1
  from bump_participants bp
  where c.id = bp.challenge_id
    and bp.is_you;
end;
$$;

-- A maintenance job, not something any signed-in user should be able to
-- trigger for everyone via .rpc() — only the service role (what pg_cron and
-- the smoke test both use) may call it.
revoke execute on function tick_challenge_streaks() from public, anon, authenticated;
grant execute on function tick_challenge_streaks() to service_role;

-- ---------------------------------------------------------------------------
-- Schedule it
-- ---------------------------------------------------------------------------
--
-- Supabase preloads pg_cron, so this should apply directly. If it doesn't
-- (project config blocks the extension), enable pg_cron via Database ->
-- Extensions in the dashboard and re-run this migration.

create extension if not exists pg_cron;

select cron.schedule('daily-streak-tick', '0 6 * * *', $$select public.tick_challenge_streaks();$$);
