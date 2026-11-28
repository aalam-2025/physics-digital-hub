import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const requiredFiles = [
  'index.html',
  'package.json',
  'README.md',
  'PROJECT_STATUS.md',
  'PHASE_3B_PLAN.md',
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
  'supabase/migrations/202611250001_phase3a_eight_member_roster.sql',
  'supabase/maintenance/expire-comments.sql',
  'supabase/functions/public-api/index.ts',
  'supabase/functions/verify-shared-gate/index.ts',
  'supabase/functions/member-api/index.ts',
  'scripts/bootstrap-members.mjs',
];

function fail(message) {
  console.error(`Project verification failed: ${message}`);
  process.exit(1);
}

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) fail(`missing required files: ${missing.join(', ')}`);

let emergencyConfig;
try {
  emergencyConfig = JSON.parse(fs.readFileSync(path.join(root, 'public/emergency-links.json'), 'utf8'));
} catch {
  fail('public/emergency-links.json is not valid JSON');
}
for (const key of ['vimeoId', 'vimeoHash', 'vimeoUrl', 'mp4DownloadUrl']) {
  if (typeof emergencyConfig[key] !== 'string') fail(`emergency-links.json field "${key}" must be a string`);
}

const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const bootstrap = fs.readFileSync(path.join(root, 'scripts/bootstrap-members.mjs'), 'utf8');
const initialSchema = fs.readFileSync(path.join(root, 'supabase/migrations/202611200001_initial_schema.sql'), 'utf8');
const rosterMigration = fs.readFileSync(path.join(root, 'supabase/migrations/202611250001_phase3a_eight_member_roster.sql'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const expectedMembers = [
  { code: '01', name: 'Aman Alam', email: 'aman@physicsdigitalhub.test', role: 'admin' },
  { code: '02', name: 'Abhirup Baru', email: 'abhirup@physicsdigitalhub.test', role: 'member' },
  { code: '03', name: 'Anik Ghosh', email: 'anik@physicsdigitalhub.test', role: 'member' },
  { code: '04', name: 'Saheb Mukherjee', email: 'saheb@physicsdigitalhub.test', role: 'member' },
  { code: '05', name: 'Sandipan Mukherjee', email: 'sandipan@physicsdigitalhub.test', role: 'member' },
  { code: '06', name: 'Ananya Gope', email: 'ananya@physicsdigitalhub.test', role: 'member' },
  { code: '07', name: 'Neha Kumari', email: 'neha@physicsdigitalhub.test', role: 'member' },
  { code: '08', name: 'Khushi Rawani', email: 'khushi@physicsdigitalhub.test', role: 'member' },
];

function extractRoster(source, marker, endMarker, label) {
  const start = source.indexOf(marker);
  if (start < 0) fail(`${label} roster declaration is missing`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) fail(`${label} roster declaration is unterminated`);
  return source.slice(start, end);
}

const frontendRoster = extractRoster(app, 'const MEMBERS: Member[] = [', '\n];', 'frontend');
const bootstrapRoster = extractRoster(bootstrap, 'const members = [', '\n];', 'bootstrap');

for (const [label, block, shape] of [
  ['frontend', frontendRoster, { codeKey: 'code', nameKey: 'name', emailKey: 'emailAlias' }],
  ['bootstrap', bootstrapRoster, { codeKey: 'member_code', nameKey: 'display_name', emailKey: 'email_alias' }],
]) {
  let previousIndex = -1;
  for (const member of expectedMembers) {
    const line = label === 'frontend'
      ? `{ code: '${member.code}', name: '${member.name}', emailAlias: '${member.email}', role: '${member.role}' }`
      : `{ member_code: '${member.code}', display_name: '${member.name}', email_alias: '${member.email}', role: '${member.role}' }`;
    const currentIndex = block.indexOf(line);
    if (currentIndex < 0) fail(`${label} roster is missing or has incorrect details for ${member.code} ${member.name}`);
    if (currentIndex <= previousIndex) fail(`${label} roster is not in the approved eight-member order`);
    previousIndex = currentIndex;
  }
  const rosterLines = block.split('\n').filter((line) => /\{\s*(?:code|member_code):/.test(line));
  if (rosterLines.length !== 8) fail(`${label} roster must contain exactly eight entries (found ${rosterLines.length})`);
}

if (!app.includes("const PROJECT_LEADER_NAME = 'Abhirup Baru'")) fail('Abhirup Baru Project Leader identity constant is missing');
if (!app.includes('function ProjectLeaderBadge()') || !styles.includes('.project-leader-badge')) fail('Project Leader badge component or styling is missing');
if (!app.includes("role: 'member' }")) fail('Project Leader must remain a normal member, not an administrator');
for (const surface of [
  '<MemberName name={member.name}',
  '<MemberName name={member.display_name}/>',
  '<MemberName name={dashboard.profile.display_name}/>',
  '<MemberName name={selectedMember.name}/>',
  "'PROJECT LEADER' : ''",
]) {
  if (!app.includes(surface)) fail(`Project Leader badge is not wired into the expected name/export surface: ${surface}`);
}
if (!app.includes('selectedMember && <MemberName name={selectedMember.name}/>')) fail('Selected-profile confirmation does not show the Project Leader badge');
if (!app.includes('isProjectLeader(dashboard.profile.display_name) && <> <ProjectLeaderBadge/>')) fail('Dashboard welcome heading does not show the Project Leader badge');

// Protect manual-only visitor navigation across all presentation screens and the 5-second visual Welcome guidance cloud.
const visitorJourneyChecks = [
  ['welcome-to-team manual navigation component', /<WelcomeTeamButton3D\b[^>]*onActivate=\{handleMeetTeamClick\}/],
  ['welcome manual-only transition guard', /resolveNextScreenOnAction\(current,\s*'manual-meet-team'\)/],
  ['team-to-video manual navigation', /onClick=\{\(\) => setScreen\('video'\)\}[^>]*>WATCH PROJECT EXPLANATION/],
  ['five-second visual-only guidance cloud scheduler', /createWelcomeGuidanceScheduler\([\s\S]*WELCOME_GUIDANCE_DELAY_MS/],
  ['staggered team reveals complete early enough to read', /animationDelay: `\$\{index \* 300\}ms`/],
];
const forbiddenAutoAdvancePatterns = [
  ['obsolete 4s/5s auto-advance timer', /screen === 'welcome' \? 4000|screen === 'members' \? 5000/],
  ['forbidden video ended screen switch', /\.on\(\s*['"]ended['"]/],
];
const missingJourneyFeatures = visitorJourneyChecks.filter(([, pattern]) => !pattern.test(app)).map(([label]) => label);
if (missingJourneyFeatures.length) fail(`visitor journey checks missing: ${missingJourneyFeatures.join(', ')}`);
const forbiddenHits = forbiddenAutoAdvancePatterns.filter(([, pattern]) => pattern.test(app)).map(([label]) => label);
if (forbiddenHits.length) fail(`forbidden automatic screen transition detected: ${forbiddenHits.join(', ')}`);
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.credit-line\{opacity:1;transform:none/.test(styles)) {
  fail('reduced-motion styles must reveal all team names without staggered animation');
}

if (!app.includes('function SolarTrackerBlueprint()') || !styles.includes('.solar-tracker-blueprint')) fail('solar tracker artwork or its stylesheet class is missing');
if (!app.includes('ScrambleText text="BUILT BY"') || !app.includes('ScrambleText text="EIGHT."') || !app.includes('EIGHT MEMBERS. ONE VISION.')) fail('public team page is missing the Solar Signal Resolve heading and eight-member label');
if (!app.includes('function ScrambleText(') || !app.includes('prefers-reduced-motion: reduce')) fail('Team Showcase text-scramble component or reduced-motion handling is missing');
if (!app.includes('function SolarParticleCanvas()') || !app.includes("window.addEventListener('pointerdown', burst") || !app.includes("window.addEventListener('click', keyboardActivation")) fail('Solar Spark particle interaction is missing pointer or keyboard activation support');
if (!styles.includes('.solar-particle-canvas') || !styles.includes('.team-solar-marquee') || !styles.includes('.credit-line:hover')) fail('Phase 3B solar particle, team marquee, or premium team-card styles are missing');
if (!app.includes('handleCardPointerMove') || !app.includes('perspective(900px)')) fail('pointer-responsive spotlight/3D card interaction is missing');
if (!app.includes('auth-feedback') || !app.includes('friendlyAuthenticationMessage')) fail('friendly inline authentication feedback is missing');
const supabaseClient = fs.readFileSync(path.join(root, 'src/lib/supabase.ts'), 'utf8');
if (!supabaseClient.includes('context.clone().json()') || !supabaseClient.includes('safeFunctionError')) fail('Supabase Edge Function response bodies are not parsed for friendly errors');
const gateFunction = fs.readFileSync(path.join(root, 'supabase/functions/verify-shared-gate/index.ts'), 'utf8');
if (!gateFunction.includes("enforceLimit(admin, request, 'shared-gate', 20, 60)")) fail('latest live shared-gate rate-limit setting 20/60 was not preserved');
if (!app.includes('Eight individual accounts') || !app.includes('All eight members can delete them.')) fail('member counts in dashboard copy are not updated');
if (!app.includes('DUAL AXIS SOLAR TRACKER') || !app.includes('Dual Axis Solar Tracker project video') || !app.includes('FOLLOW THE SUN.') || !app.includes('ACROSS TWO AXES.')) fail('public project identity/video title is incomplete');

const allowedCodes = "member_code in ('01','02','03','04','05','06','07','08')";
if (!initialSchema.includes(allowedCodes)) fail('fresh-install schema does not allow member codes 01–08');
if (!rosterMigration.includes('drop constraint if exists profiles_member_code_check') || !rosterMigration.includes('MIG-')) fail('upgrade migration does not safely release existing unique codes before remapping');
for (const [email, code] of [
  ['sandipan@physicsdigitalhub.test', "then '05'"],
  ['neha@physicsdigitalhub.test', "then '07'"],
  ['khushi@physicsdigitalhub.test', "then '08'"],
]) {
  if (!rosterMigration.includes(email) || !rosterMigration.includes(code)) fail(`database migration does not map ${email} to its approved new code`);
}
if (!rosterMigration.includes(allowedCodes)) fail('upgrade migration does not finish with the eight-code constraint');
if (packageJson.version !== '1.3.0') fail('package version must be 1.3.0 for the Phase 3B checkpoint');

const identityFiles = [
  'src/App.tsx', 'src/styles.css', 'README.md', 'PROJECT_STATUS.md', 'index.html',
  'public/emergency.html', 'public/favicon.svg', 'package.json',
];
const retiredIdentity = /hydraulic|crane|pascal's law|powered by aman alam ai/i;
for (const file of identityFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (retiredIdentity.test(content)) fail(`superseded project identity remains in ${file}`);
}

const secretFiles = ['.env.local', 'scripts/.env.admin.local', 'supabase/functions/.env'];
const presentSecrets = secretFiles.filter((file) => fs.existsSync(path.join(root, file)));
if (presentSecrets.length && process.env.CI === 'true') fail(`local secret files must not be committed: ${presentSecrets.join(', ')}`);

console.log(`Project verification passed: ${requiredFiles.length} required files, exact eight-member order/codes, Project Leader UI/export, solar identity, Phase 3B particle and scramble effects, friendly authentication feedback, 20/60 shared-gate limit, responsive/reduced-motion styles, database upgrade path, QR navigation, emergency configuration, and secret-file checks.`);
console.log('Note: this check does not replace TypeScript compilation, Supabase migration execution, secure account provisioning, Edge Function deployment, or live service tests.');
