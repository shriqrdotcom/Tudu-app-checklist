/**
 * TU DU — one-time owner account bootstrap (SERVER-SIDE ONLY).
 *
 * Creates the single owner account via the Supabase Admin API using the
 * service-role key. The account is created already email-confirmed.
 * The DB trigger `handle_new_user` (supabase/schema.sql) automatically
 * provisions the `profiles` and `user_settings` rows.
 *
 * Safe to run again: if the owner already exists it reports
 * "Owner account already exists." and never resets or reveals the password.
 *
 * Required environment variables (never committed):
 *   SUPABASE_URL              (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OWNER_EMAIL               — the single owner's login email
 *
 * Usage:
 *   OWNER_EMAIL=owner@example.com npm run create:owner
 *
 * The generated password is printed ONCE to stdout and never persisted.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

// Load .env.local (git-ignored) for local runs; real env vars take precedence.
loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: false });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';

function fail(message: string): never {
  console.error(`\n[x] ${message}\n`);
  process.exit(1);
}

if (!SUPABASE_URL) fail('SUPABASE_URL (or VITE_SUPABASE_URL) is required.');
if (!SERVICE_ROLE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY is required (server-side only).');
if (!OWNER_EMAIL) fail('OWNER_EMAIL is required. Re-run with OWNER_EMAIL=your@email.com');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OWNER_EMAIL)) {
  fail(`"${OWNER_EMAIL}" does not look like a valid email address.`);
}

/** Cryptographically random password (>= 20 chars, mixed case + digits + symbols). */
function generatePassword(length = 24): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+[]?';
  const all = upper + lower + digits + symbols;

  // Rejection sampling to avoid modulo bias
  const pick = (set: string): string => {
    // biome-ignore lint/suspicious/noConstantCondition: rejection loop
    while (true) {
      const b = randomBytes(1)[0];
      if (b < 256 - (256 % set.length)) return set[b % set.length];
    }
  };

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));

  // Fisher–Yates shuffle using crypto randomness
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\nTU DU owner bootstrap');
  console.log('---------------------');
  console.log(`Supabase: ${new URL(SUPABASE_URL).host}`);
  console.log(`Owner:    ${OWNER_EMAIL}`);

  // Idempotency check — never create a duplicate owner
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({ perPage: 500 });
  if (listError) fail(`Could not query existing users: ${listError.message}`);

  const users = (listData?.users ?? []) as Array<{ id: string; email?: string }>;
  const existing = users.find(
    (u) => (u.email || '').toLowerCase() === OWNER_EMAIL.toLowerCase()
  );

  if (existing) {
    console.log('\nOwner account already exists.');
    console.log(`Email: ${existing.email}`);
    console.log('The existing password is not known to this script — sign in with your stored credentials.');
    console.log('\nNo changes were made.\n');
    process.exit(0);
  }

  const password = generatePassword(24);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password,
    email_confirm: true, // already confirmed — owner signs in immediately
    user_metadata: { name: OWNER_EMAIL.split('@')[0] },
  });

  if (createError || !created?.user) {
    fail(`Could not create the owner account: ${createError?.message ?? 'unknown error'}`);
  }

  const userId = created.user.id;

  // Defensive: ensure profile/settings exist even if the DB trigger was removed
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ user_id: userId, name: OWNER_EMAIL.split('@')[0] }, { onConflict: 'user_id' });
  if (profileError) console.warn(`[!] Profile upsert warning: ${profileError.message}`);

  const { error: settingsError } = await admin
    .from('user_settings')
    .upsert({ user_id: userId, theme: 'light' }, { onConflict: 'user_id' });
  if (settingsError) console.warn(`[!] Settings upsert warning: ${settingsError.message}`);

  console.log('\n========================================');
  console.log('  TU DU OWNER ACCOUNT CREATED');
  console.log('========================================');
  console.log(`Email:\n  ${OWNER_EMAIL}`);
  console.log(`\nPassword:\n  ${password}`);
  console.log('========================================');
  console.log('Store these credentials in a password manager NOW.');
  console.log('This password is NOT saved anywhere and cannot be recovered.\n');
  console.log('Also recommended (Supabase Dashboard → Authentication):');
  console.log('  - Disable "Allow new users to sign up" to block registration server-side.\n');
}

main().catch((err) => fail(err?.message || 'Unexpected error.'));
