import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';

import { SupabaseRunwayApi } from '../src/data/supabase/supabaseApi';

/**
 * End-to-end smoke test against the live Supabase project.
 *
 * Not a unit test — it hits the real network. Requires:
 *   - mobile/.env.local with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   - SUPABASE_SECRET_KEY in the environment (never committed) — used only to
 *     create/delete two throwaway test users via the Auth Admin API, so the
 *     test doesn't depend on email confirmation being off.
 *
 * Run with:
 *   npx tsc --project tsconfig.scripts.json
 *   SUPABASE_SECRET_KEY=... node build-scripts/scripts/smoke.js
 */

function loadEnvLocal() {
  const file = path.join(process.cwd(), '.env.local');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  console.log(`  ✓ ${message}`);
}

async function main() {
  loadEnvLocal();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !anonKey) throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing from .env.local');
  if (!secretKey) throw new Error('SUPABASE_SECRET_KEY env var required (pass it inline, never commit it)');

  const admin = createClient(url, secretKey, { auth: { persistSession: false } });
  const stamp = Date.now();
  const userA = { email: `smoke-a-${stamp}@example.com`, password: 'Sm0keTest!A1' };
  const userB = { email: `smoke-b-${stamp}@example.com`, password: 'Sm0keTest!B1' };

  console.log('=== setup: creating two throwaway test users ===');
  const { data: createdA, error: createAErr } = await admin.auth.admin.createUser({
    email: userA.email,
    password: userA.password,
    email_confirm: true,
  });
  if (createAErr) throw createAErr;
  const { data: createdB, error: createBErr } = await admin.auth.admin.createUser({
    email: userB.email,
    password: userB.password,
    email_confirm: true,
  });
  if (createBErr) throw createBErr;
  console.log(`  created ${userA.email} (${createdA.user.id})`);
  console.log(`  created ${userB.email} (${createdB.user.id})`);

  try {
    const clientA = createClient(url, anonKey, { auth: { persistSession: false } });
    const clientB = createClient(url, anonKey, { auth: { persistSession: false } });

    console.log('\n=== 1. sign in as test user A ===');
    const { error: signInAErr } = await clientA.auth.signInWithPassword(userA);
    if (signInAErr) throw signInAErr;
    console.log(`  signed in as ${userA.email}`);

    const apiA = new SupabaseRunwayApi(clientA);

    console.log('\n=== 2. write one row of every table via supabaseApi ===');
    let snapshot = await apiA.getSnapshot();
    console.log(
      `  getSnapshot() provisioned semester ${snapshot.semester.id} — ` +
        `semesters, income_sources(${snapshot.income.length}), bills(${snapshot.bills.length})`,
    );

    snapshot = await apiA.addPerson('Maya');
    const person = snapshot.people[snapshot.people.length - 1];
    console.log(`  addPerson -> people: ${person.name} (${person.id})`);

    const jobId = `smoke-job-${stamp}`;
    const billId = `smoke-bill-${stamp}`;
    const fundId = `smoke-fund-${stamp}`;
    const challengeId = `smoke-ch-${stamp}`;

    snapshot = await apiA.completeSetup({
      aidAmount: 4000,
      summerAmount: 2500,
      jobs: [{ id: jobId, name: 'Campus IT', hourlyRate: 15, hoursPerWeek: 10, payCadence: 'biweekly' }],
      bills: [{ id: billId, label: 'Internet', envelope: 'fees', amount: 30, cadence: 'monthly', dueDay: 5 }],
      funds: [
        {
          id: fundId,
          label: 'Austin trip',
          occasion: '2026-11-01',
          targetAmount: 600,
          weeklyPledge: 20,
          extraContributed: 0,
          inviteIds: [person.id],
        },
      ],
    });
    console.log(
      `  completeSetup -> income_sources updated, jobs(${snapshot.jobs.length}), ` +
        `bills(${snapshot.bills.length}), funds(${snapshot.funds.length}), fund_members(${snapshot.funds[0]?.members.length})`,
    );

    snapshot = await apiA.addChallenge({ id: challengeId, label: 'No boba', category: 'Drinks', inviteIds: [person.id] });
    console.log(
      `  addChallenge -> challenges, challenge_participants(${snapshot.challenges[0]?.participants.length})`,
    );

    snapshot = await apiA.logExpense({ merchant: 'Smoke Test Cafe', amount: 4.5, category: 'Drinks', envelope: 'free' });
    console.log(`  logExpense -> expenses(${snapshot.todayExpenses.length})`);

    const { snapshot: afterChat, reply } = await apiA.askCoach('a $12 concert?');
    snapshot = afterChat;
    console.log(`  askCoach -> chat_messages(${snapshot.chat.length}), reply: "${reply.text}"`);

    snapshot = await apiA.contributeToFund(fundId, 10);
    console.log(`  contributeToFund -> funds.extra_contributed=${snapshot.funds[0]?.extraContributed}`);

    snapshot = await apiA.setJobHours(jobId, 12);
    console.log(`  setJobHours -> jobs.hours_per_week=${snapshot.jobs[0]?.hoursPerWeek}`);

    console.log(
      '  (moves has no write path in the 15-endpoint contract — mockApi never appends to it either, ' +
        'it is seed-only content, so there is nothing for supabaseApi to write there)',
    );

    console.log('\n=== 3. read back and assert ===');
    const finalA = await apiA.getSnapshot();
    assert(finalA.people.length === 1 && finalA.people[0].name === 'Maya', 'person "Maya" persisted');
    assert(finalA.income.find((i) => i.kind === 'aid')?.amount === 4000, 'aid income updated to 4000');
    assert(finalA.income.find((i) => i.kind === 'summer')?.amount === 2500, 'summer income updated to 2500');
    assert(finalA.jobs.length === 1 && finalA.jobs[0].hoursPerWeek === 12, 'job persisted with updated hours');
    assert(finalA.bills.length === 1 && finalA.bills[0].label === 'Internet', 'setup replaced bills with just "Internet"');
    const fund = finalA.funds.find((f) => f.id === fundId);
    assert(!!fund && fund.extraContributed === 10, 'fund contribution persisted');
    assert(!!fund && fund.members.some((m) => m.name === 'Maya' && m.status === 'invited'), 'invited fund member persisted');
    const challenge = finalA.challenges.find((c) => c.id === challengeId);
    assert(!!challenge && challenge.broken === true, 'challenge broken by the matching Drinks expense');
    assert(finalA.todayExpenses.some((e) => e.merchant === 'Smoke Test Cafe' && e.amount === 4.5), 'expense persisted');
    assert(
      finalA.chat.some((m) => m.role === 'coach' && m.text === reply.text),
      'coach reply persisted in chat_messages',
    );

    console.log('\n=== 4. sign in as test user B, assert isolation from A ===');
    const { error: signInBErr } = await clientB.auth.signInWithPassword(userB);
    if (signInBErr) throw signInBErr;
    const apiB = new SupabaseRunwayApi(clientB);
    const snapshotB = await apiB.getSnapshot();
    assert(snapshotB.semester.id !== finalA.semester.id, "B's semester is not A's semester");
    assert(snapshotB.people.length === 0, 'B sees no people (not "Maya")');
    assert(snapshotB.jobs.length === 0, 'B sees no jobs (not "Campus IT")');
    assert(!snapshotB.bills.some((b) => b.label === 'Internet'), 'B does not see A\'s "Internet" bill');
    assert(snapshotB.funds.length === 0, 'B sees no funds ("Austin trip" not visible)');
    assert(snapshotB.challenges.length === 0, 'B sees no challenges ("No boba" not visible)');
    assert(snapshotB.todayExpenses.length === 0, 'B sees no expenses ("Smoke Test Cafe" not visible)');
    assert(snapshotB.chat.length === 0, "B sees no chat (A's coach reply not visible)");

    console.log('\n=== 5. delete test data ===');
    const { error: deleteAErr } = await admin.auth.admin.deleteUser(createdA.user.id);
    if (deleteAErr) throw deleteAErr;
    const { error: deleteBErr } = await admin.auth.admin.deleteUser(createdB.user.id);
    if (deleteBErr) throw deleteBErr;
    console.log('  deleted both auth users');

    // Prove the cascade actually removed rows, not just that the users are gone.
    const { data: leftoverBills, error: leftoverError } = await admin
      .from('bills')
      .select('id')
      .in('user_id', [createdA.user.id, createdB.user.id]);
    if (leftoverError) throw leftoverError;
    assert(leftoverBills?.length === 0, 'on delete cascade removed every row for both test users');

    console.log('\nSMOKE TEST PASSED');
  } catch (err) {
    console.error('\ncleaning up test users after failure...');
    await admin.auth.admin.deleteUser(createdA.user.id).catch(() => {});
    await admin.auth.admin.deleteUser(createdB.user.id).catch(() => {});
    throw err;
  }
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
