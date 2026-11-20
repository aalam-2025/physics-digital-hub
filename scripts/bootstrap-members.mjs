import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const envPath = path.join(root, 'scripts', '.env.admin.local');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing scripts/.env.admin.local. Copy scripts/.env.admin.example and add your Supabase URL and server key.');
  }
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    const separator = clean.indexOf('=');
    if (separator < 1) continue;
    values[clean.slice(0, separator).trim()] = clean.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function ask(promptText, hidden = false) {
  return new Promise((resolve, reject) => {
    const terminal = Boolean(process.stdin.isTTY && process.stdout.isTTY && typeof process.stdin.setRawMode === 'function');
    if (hidden && !terminal) {
      reject(new Error('Password entry must run in an interactive terminal that supports hidden input. Open Windows Terminal or the VS Code integrated terminal and run the command again.'));
      return;
    }
    if (!hidden) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(promptText, (answer) => { rl.close(); resolve(answer.trim()); });
      return;
    }

    process.stdout.write(promptText);
    let value = '';
    const stdin = process.stdin;
    const onData = (chunk) => {
      const text = chunk.toString('utf8');
      for (const character of text) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u0008' || character === '\u007f') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    function cleanup() {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256');
  return `pbkdf2$310000$${salt.toString('hex')}$${hash.toString('hex')}`;
}

const members = [
  { member_code: '01', display_name: 'Aman Alam', email_alias: 'aman@physicsdigitalhub.test', role: 'admin' },
  { member_code: '02', display_name: 'Abhirup Baru', email_alias: 'abhirup@physicsdigitalhub.test', role: 'member' },
  { member_code: '03', display_name: 'Sandipan Mukherjee', email_alias: 'sandipan@physicsdigitalhub.test', role: 'member' },
  { member_code: '04', display_name: 'Khushi Rawani', email_alias: 'khushi@physicsdigitalhub.test', role: 'member' },
  { member_code: '05', display_name: 'Neha Kumari', email_alias: 'neha@physicsdigitalhub.test', role: 'member' },
  { member_code: '06', display_name: 'Ananya Gope', email_alias: 'ananya@physicsdigitalhub.test', role: 'member' },
];

async function main() {
  const env = loadEnv(envPath);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both required in scripts/.env.admin.local.');
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('\nPHYSICS DIGITAL HUB — secure member-account setup');
  console.log('Passwords are entered locally and are not printed. Use unique passwords of at least 12 characters.\n');

  const sharedPassword = await ask('Shared website password (hidden): ', true);
  if (sharedPassword.length < 12) throw new Error('The shared website password must be at least 12 characters.');
  const memberPasswords = new Map();
  const usedPasswords = new Set([sharedPassword]);
  for (const member of members) {
    const password = await ask(`${member.display_name} individual password (hidden): `, true);
    if (password.length < 12) throw new Error(`${member.display_name}'s password must be at least 12 characters.`);
    if (usedPasswords.has(password)) throw new Error('Every member must have a different individual password, and individual passwords must differ from the shared website password.');
    usedPasswords.add(password);
    memberPasswords.set(member.email_alias, password);
  }

  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  const existingByEmail = new Map((listed.data.users ?? []).map((user) => [user.email, user]));

  for (const member of members) {
    const password = memberPasswords.get(member.email_alias);
    const existing = existingByEmail.get(member.email_alias);
    let userId;
    if (existing) {
      const updated = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { display_name: member.display_name, member_code: member.member_code },
      });
      if (updated.error) throw updated.error;
      userId = updated.data.user.id;
      console.log(`Updated account: ${member.display_name}`);
    } else {
      const created = await supabase.auth.admin.createUser({
        email: member.email_alias,
        password,
        email_confirm: true,
        user_metadata: { display_name: member.display_name, member_code: member.member_code },
      });
      if (created.error) throw created.error;
      userId = created.data.user.id;
      console.log(`Created account: ${member.display_name}`);
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      auth_user_id: userId,
      member_code: member.member_code,
      display_name: member.display_name,
      email_alias: member.email_alias,
      role: member.role,
    }, { onConflict: 'auth_user_id' });
    if (profileError) throw profileError;
  }

  const sharedHash = hashPassword(sharedPassword);
  const secrets = [
    `SHARED_PASSWORD_HASH=${sharedHash}`,
    `GATE_TOKEN_SECRET=${randomBytes(48).toString('hex')}`,
    `RATE_LIMIT_SALT=${randomBytes(32).toString('hex')}`,
  ].join('\n') + '\n';
  const secretsPath = path.join(root, 'supabase', 'functions', '.env');
  fs.writeFileSync(secretsPath, secrets, { mode: 0o600 });

  console.log('\nAll six accounts and their profile records are ready.');
  console.log('The shared-password hash and server-only signing/rate-limit secrets were written to:');
  console.log('  supabase/functions/.env');
  console.log('\nNext command to publish those secrets:');
  console.log('  npx supabase secrets set --env-file supabase/functions/.env');
  console.log('\nKeep scripts/.env.admin.local and supabase/functions/.env private. Never commit either file.');
}

main().catch((error) => {
  console.error('\nSetup failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
