# PHYSICS DIGITAL HUB — V1.1.1

A React + TypeScript website for the S.K.S Public School Annual Exhibition hydraulic construction crane project.

## V1.1.1 update

This revision keeps the approved three-screen public journey and strengthens the planned member, analytics, video, and reliability features:

- Silent cinematic welcome screen (about 4 seconds) and six-member showcase (about 5 seconds), with automatic fail-forward and reduced-motion support.
- The approved S.K.S Public School crest and original supplied school logo are included in `public/assets/`.
- Minimal public video experience: one main Vimeo film, independent MP4 download, Like/Unlike, anonymous comments, and the small member-access icon. Project explanations belong in the video, not extra public sections.
- Comments open in a desktop side panel and a mobile slide-up panel.
- Vimeo supports both a numeric video ID and the privacy hash used for unlisted videos.
- Viewer / Project Member access choice, shared-password gate, six animated member cards, and an individual Supabase Auth login for each member.
- Six-member directory inside the private dashboard, with internal login aliases and CSV export. Passwords are never displayed or exported; no password-reset feature is provided.
- Aman Alam is enforced as the sole administrator by the database role/member-code constraint and server-side checks. The other five accounts remain members.
- All six members can view shared analytics and delete comments. Only Aman can change the active video, announcement, and exhibition information. These controls exist only in the private member area.
- Server-side SQL aggregation for the selected 7/30/90-day analytics range, recent activity, live-visitor estimate, chart data, and paginated CSV export with an explicit safety-limit warning.
- Admin-only manual JSON backup includes site settings, member directory, active comments, comment-deletion audit entries, hashed analytics identifiers, and hashed Like identifiers. It never exports passwords, access tokens, or Supabase secrets. Large exports report truncation flags.
- Atomic server-side Like toggling, server-side request limits, hashed visitor identifiers, and no invasive device fingerprinting.
- 72-hour comment expiry is enforced in public/member queries. A scheduled `pg_cron` job physically deletes expired comment rows even when no visitors are online.
- The Overview and Analytics dashboards quietly refresh every 60 seconds while visible, keeping recent activity and the estimated active-visitor metric fresher without requiring manual refresh.
- Scene-entry transitions, subtle crest illumination, and title sheen add cinematic polish; all are suppressed by reduced-motion preferences and remain silent.
- SEO metadata, social-preview metadata, a crawlable `robots.txt`, and a no-JavaScript fallback are included for public discovery and resilience.
- A pre-build verification script checks required assets, project files, emergency configuration shape, and the six member names. GitHub Actions runs the production build on pushes and pull requests.
- Supabase Edge Functions, database schema, secure local account bootstrap script, Render Static Site configuration, and emergency video fallback page.

## Important status

This is the **V1.1.1 source-code package**, not a deployed or production-verified website. The package still needs your Supabase project, six locally provisioned accounts, the shared password hash and server secrets, Vimeo video details, GitHub Release MP4 URL, Render environment variables, and live tests. No passwords, provider keys, Vimeo IDs, or personal account credentials are included.

The repository is intentionally **Public**, as confirmed by the project owner. Anyone can view and copy the source code, so do not commit `.env.local`, `scripts/.env.admin.local`, `supabase/functions/.env`, Supabase server keys, real passwords, or private tokens. `.gitignore` excludes these local secret files. Publicly displayed project-member names are part of the approved exhibition presentation; internal sign-in aliases in this demo bootstrap script are placeholders, not real email accounts.

## 1. Connect the services in this order

1. **GitHub:** Keep the source repository Public, as requested. Connect the repository to Render after the V1.1 source has been uploaded.
2. **Supabase:** Create the project, run the migration, provision the six accounts locally, set the Edge Function secrets, and deploy the three functions.
3. **Vimeo:** Upload the single explainer video; configure embedding/privacy; record the video ID and, for an unlisted video, its privacy hash.
4. **GitHub Releases:** Upload the separate MP4 file as a Release asset and copy its direct HTTPS download URL.
5. **Render:** Create a Static Site from the GitHub repository and add the frontend environment variables.
6. **Live testing:** Test all public flows, all six accounts, permissions, video, comments, Likes, analytics, backup, responsive layout, and fallback behaviour before generating the QR code.

The user's selected workflow is to connect the four services and test the deployed website directly. A local preview is optional for troubleshooting, but final acceptance testing must be performed against the live Render URL.

## 2. Render build settings

The included `render.yaml` defines a Static Site. Use:

- Build command: `npm install && npm run build`
- Publish directory: `dist`

The SPA rewrite routes the public paths to `index.html`. The static `/emergency.html` page and `/emergency-links.json` are copied to the published output.

Set these Render environment variables:

```dotenv
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_VIMEO_VIDEO_ID=YOUR_NUMERIC_VIDEO_ID
VITE_VIMEO_VIDEO_HASH=YOUR_UNLISTED_VIDEO_HASH_OR_BLANK
VITE_GITHUB_DOWNLOAD_URL=YOUR_GITHUB_RELEASE_ASSET_URL
```

Use only the Supabase publishable/anon key in the frontend. **Never** put the Supabase `service_role` key or a Supabase secret key in a `VITE_` variable.

## 3. Supabase database

In the Supabase SQL Editor, run the complete file:

```text
supabase/migrations/202611200001_initial_schema.sql
```

It creates:

- Six-member profile directory and single-admin enforcement.
- Video, announcement, and exhibition settings, including Vimeo privacy hash.
- Anonymous comments and deletion audit.
- Hashed analytics events, Like records, and request-rate buckets.
- Atomic Like toggle, rate-limit, and analytics-summary SQL functions.
- RLS on application tables and revoked direct access for browser roles. Application operations are routed through the Edge Functions.

In Supabase Authentication settings:

- Enable Email sign-in.
- Disable public new-user signups; only the six prepared project accounts should exist.
- No password-reset/recovery flow is included, per the project decision.
- The account bootstrap tool uses internal aliases ending in `.test`. If the Supabase Auth configuration rejects those aliases, stop and choose an email-alias domain you control before creating accounts. Do not substitute anyone's real email without permission.

## 4. Provision the six member accounts securely

After `npm install` on a trusted computer:

1. Copy `scripts/.env.admin.example` to `scripts/.env.admin.local`.
2. Add your Supabase URL and server-only service-role key locally.
3. Run `node scripts/bootstrap-members.mjs` from the project root.
4. Enter the shared website password and each member's individual password in the local terminal. Use unique passwords of at least 12 characters.
5. The script creates or updates the six Auth accounts and matching profile records. It writes only a PBKDF2 hash of the shared password and random server secrets to `supabase/functions/.env`.

The six fixed identities are:

| Code | Member | Role | Internal sign-in alias |
|---|---|---|---|
| 01 | Aman Alam | Sole administrator | `aman@physicsdigitalhub.test` |
| 02 | Abhirup Baru | Member | `abhirup@physicsdigitalhub.test` |
| 03 | Sandipan Mukherjee | Member | `sandipan@physicsdigitalhub.test` |
| 04 | Khushi Rawani | Member | `khushi@physicsdigitalhub.test` |
| 05 | Neha Kumari | Member | `neha@physicsdigitalhub.test` |
| 06 | Ananya Gope | Member | `ananya@physicsdigitalhub.test` |

Do not paste passwords into chat, GitHub, or source files. Keep `scripts/.env.admin.local` and `supabase/functions/.env` private; both are ignored by Git.

## 5. Deploy Supabase Edge Functions

Install/use the Supabase CLI through `npx`:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy public-api
npx supabase functions deploy verify-shared-gate
npx supabase functions deploy member-api
```

`public-api` and `verify-shared-gate` have JWT verification disabled because they serve public visitors and the shared-password gate. Both have server-side rate limiting. `member-api` keeps JWT verification enabled and additionally requires the valid shared-password gate token. All member actions verify the signed-in user's profile and role on the server.

## 6. Activate automatic comment deletion

The public and member APIs stop returning expired comments at their `expires_at` time and perform opportunistic cleanup. To physically delete comments without waiting for a visitor request:

1. Enable the `pg_cron` extension in the Supabase Dashboard under Database → Extensions.
2. Run `supabase/maintenance/expire-comments.sql` once in the SQL Editor.

The scheduled job runs every minute. Comments disappear from the app at 72 hours; physical row deletion follows on the next scheduled run (normally within about one minute).

## 7. Configure Vimeo and the MP4 download

- Upload the single main explainer video to Vimeo.
- Configure Vimeo's privacy and embed settings to allow the Render domain to embed the video.
- Enter the numeric Vimeo video ID in the admin dashboard. For an unlisted video, also enter its privacy hash.
- Upload the MP4 as a GitHub Release asset and use its direct HTTPS asset URL.
- In the admin dashboard, update the active video ID, privacy hash (if needed), MP4 URL, announcement, and exhibition information.
- Also update `public/emergency-links.json` in GitHub with the same public Vimeo ID/hash/page URL and GitHub MP4 URL, then redeploy. This static file is read before Supabase configuration so first-time visitors can still reach the video during a Supabase outage.

Do not stream the MP4 through Render. Render serves only the static website, Vimeo streams the video, and GitHub Releases provides the download.

## 8. Launch and test checklist

- [ ] Render production build succeeds and HTTPS URL opens.
- [ ] Welcome screen advances after about 4 seconds; no sound plays.
- [ ] Members showcase reveals the exact six names and advances after about 5 seconds.
- [ ] Reduced-motion mode does not leave the visitor stuck.
- [ ] Public QR/viewer route needs no login.
- [ ] Person icon offers Viewer and Project Member.
- [ ] Viewer returns to the public three-screen journey.
- [ ] Project Member must pass the shared-password gate before selecting a profile.
- [ ] Each of the six individual passwords opens only its matching account.
- [ ] Aman is the only administrator; five others remain members.
- [ ] All six can view the shared analytics and delete public comments.
- [ ] Only Aman can update/publish the active video and update website announcements/exhibition information.
- [ ] Vimeo playback works, including its privacy hash if the video is unlisted.
- [ ] GitHub Release MP4 downloads correctly.
- [ ] Likes toggle and counts remain consistent across browsers.
- [ ] Anonymous comments publish immediately and are hidden after 72 hours.
- [ ] `pg_cron` physically deletes expired comments.
- [ ] Analytics date ranges, daily charts, recent activity, visitor estimates, and CSV export work.
- [ ] Manual JSON backup downloads; no credentials or passwords appear in it.
- [ ] Simulate Supabase/API failures: the video remains independently accessible and comments/Like/analytics show graceful error handling.
- [ ] Simulate Vimeo embed failure: direct Vimeo and MP4 links are offered.
- [ ] Test mobile comments as a bottom drawer and desktop comments as a side panel.
- [ ] Test multiple phones, desktop browsers, Wi-Fi, and mobile data.
- [ ] Keep the QR code postponed until all above tests pass.

## Privacy and operational notes

- The visitor browser stores a random identifier; the server hashes it before storing analytics and Like state. This is not device fingerprinting and cannot prove one unique human being. Clearing browser data, private browsing, or using another device can change estimated uniqueness.
- Anonymous comment forms do not ask for names, emails, or phone numbers. Rate limiting also uses a salted hash of the request IP; this is a security measure, not a visitor identity profile.
- Analytics are retained until Aman manually clears the analytics event history. The public Like tally and active comments are separate records and remain unchanged when event history is cleared.
- Backup and analytics export have explicit safety caps and return truncation indicators if those caps are reached; very large projects may require a paginated export job.
- A Render-hosted `/emergency.html` fallback helps when the app's data services fail while Render remains available. It cannot guarantee access during a complete Render hosting outage; a true independent-host emergency page would need a second hosting provider.
- Provider free-plan limits, Vimeo embed privacy rules, and Supabase project inactivity policies must be checked before the exhibition. Do not assume free-plan quotas guarantee continuous availability.

## Project structure

```text
physics-digital-hub/
├── public/assets/                  # Approved WebP crest and original PNG logo
├── public/emergency.html           # Static fallback page
├── public/emergency-links.json     # Public video/download fallback URLs
├── src/                            # React + TypeScript frontend
├── supabase/migrations/            # Database schema, security and analytics RPC
├── supabase/functions/             # Public, shared-gate and member APIs
├── supabase/maintenance/           # Scheduled 72-hour comment cleanup
├── scripts/                        # Local secure six-account bootstrap and project verifier
├── .env.example                    # Frontend configuration template
├── .github/workflows/build.yml     # Production build verification
├── render.yaml                     # Render Static Site configuration
└── README.md
```
