import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/styles.css',
  'src/lib/config.ts',
  'src/lib/supabase.ts',
  'public/favicon.svg',
  'public/robots.txt',
  'public/emergency.html',
  'public/emergency-links.json',
  'public/assets/sks-school-crest.webp',
  'public/assets/sks-original-logo.png',
  'supabase/config.toml',
  'supabase/migrations/202611200001_initial_schema.sql',
  'supabase/maintenance/expire-comments.sql',
  'supabase/functions/public-api/index.ts',
  'supabase/functions/verify-shared-gate/index.ts',
  'supabase/functions/member-api/index.ts',
  'scripts/bootstrap-members.mjs',
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Project verification failed. Missing required files:');
  for (const file of missing) console.error(` - ${file}`);
  process.exit(1);
}

let emergencyConfig;
try {
  emergencyConfig = JSON.parse(fs.readFileSync(path.join(root, 'public/emergency-links.json'), 'utf8'));
} catch {
  console.error('Project verification failed: public/emergency-links.json is not valid JSON.');
  process.exit(1);
}
for (const key of ['vimeoId', 'vimeoHash', 'vimeoUrl', 'mp4DownloadUrl']) {
  if (typeof emergencyConfig[key] !== 'string') {
    console.error(`Project verification failed: emergency-links.json field "${key}" must be a string.`);
    process.exit(1);
  }
}

const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const expectedMembers = [
  'Aman Alam',
  'Abhirup Baru',
  'Sandipan Mukherjee',
  'Khushi Rawani',
  'Neha Kumari',
  'Ananya Gope',
];
const missingMembers = expectedMembers.filter((name) => !app.includes(name));
if (missingMembers.length) {
  console.error(`Project verification failed: missing planned member names: ${missingMembers.join(', ')}`);
  process.exit(1);
}

// Protect the core QR visitor journey from accidental removal or reduced reading time.
const visitorJourneyChecks = [
  ['welcome-to-team manual navigation', /onClick=\{\(\) => setScreen\('members'\)\}[^>]*>MEET THE TEAM/],
  ['team-to-video manual navigation', /onClick=\{\(\) => setScreen\('video'\)\}[^>]*>WATCH PROJECT EXPLANATION/],
  ['four-second welcome reading window', /screen === 'welcome' \? 4000/],
  ['five-second team reading window', /screen === 'members' \? 5000/],
];
const missingJourneyFeatures = visitorJourneyChecks
  .filter(([, pattern]) => !pattern.test(app))
  .map(([label]) => label);
if (missingJourneyFeatures.length) {
  console.error(`Project verification failed: visitor journey checks missing: ${missingJourneyFeatures.join(', ')}`);
  process.exit(1);
}
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.credit-line\{opacity:1;transform:none/.test(styles)) {
  console.error('Project verification failed: reduced-motion styles must reveal all team names without staggered animation.');
  process.exit(1);
}

const secretFiles = ['.env.local', 'scripts/.env.admin.local', 'supabase/functions/.env'];
const presentSecrets = secretFiles.filter((file) => fs.existsSync(path.join(root, file)));
if (presentSecrets.length && process.env.CI === 'true') {
  console.error(`Project verification failed: local secret files must not be committed: ${presentSecrets.join(', ')}`);
  process.exit(1);
}

console.log(`Project verification passed: ${requiredFiles.length} required files, emergency configuration shape, six member names, QR visitor navigation, reading windows, and secret-file checks.`);
console.log('Note: this check does not replace TypeScript compilation, Supabase migration execution, or live service tests.');
