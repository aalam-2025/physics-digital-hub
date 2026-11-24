# PHYSICS DIGITAL HUB — Project Status

**Baseline:** V1.1.1 source package  
**Last checked:** 24 November 2026
**Current development checkpoint:** Phase 2 — visitor journey usability improvement  
**Working copy:** Extracted from `physics-digital-hub-main.zip`; the uploaded archive remains unchanged.

## Project objective

The public site supports the physical S.K.S Public School hydraulic construction crane exhibition. A visitor scans a QR code printed on the model and sees the welcome screen, the six-member team showcase, and then an approximately 100-second AI-generated video explaining the model. The private member dashboard remains a separate management feature.

## Baseline findings

| Area | Current evidence | Status |
|---|---|---|
| Source archive | ZIP integrity check passed; 51 archive entries extracted | Passed |
| Required project files | Project verifier found all 19 required files | Passed |
| Six team names | Verifier confirms all six expected names | Passed |
| Public visitor sequence | Welcome → six-member showcase → video; manual Continue controls added alongside automatic transitions | Implemented and locally verified |
| Intro reading accessibility | Reduced-motion no longer shortens the reading windows; 4-second welcome and 5-second team timing retained | Implemented and locally verified |
| Welcome/team timing | About 4 seconds and 5 seconds; reduced-motion alternatives exist | Implemented in source |
| Explainer video | Vimeo player integration exists, but the archive has no configured video ID/hash or MP4 URL | Pending external media/configuration |
| QR code | No permanent production URL is available in this source package | Pending deployment |
| Supabase | Migration and three Edge Function sources exist; no live project verification performed | Pending configuration and live tests |
| Six member accounts | Local provisioning script exists; credentials/accounts are not included | Pending secure provisioning |
| Render hosting | Static-site configuration exists; live deployment not verified | Pending deployment |
| Production build | Could not run because dependencies are absent and npm registry access failed with DNS `EAI_AGAIN` during installation | Blocked by environment/network |

## Phase 2 verification notes — 24 November 2026

- `npm run verify` passes with the new checks for the QR visitor navigation, full reading windows, and reduced-motion team-name visibility.
- Node.js syntax checks pass for both local `.mjs` scripts.
- TypeScript transpilation syntax checks pass for the eight frontend and Supabase `.ts`/`.tsx` source files. This checks syntax only, not full project type correctness.
- A network-backed dependency installation attempt timed out. An offline installation check confirmed the npm cache does not contain the Supabase package metadata, so dependencies and a reproducible lockfile cannot yet be restored in this environment.
- The full `tsc -b` typecheck and Vite production build remain unverified until dependencies can be installed.

## Immediate development sequence

1. Restore dependency installation and generate a reproducible lockfile; run TypeScript and Vite production build.
2. Complete a code-level review of frontend, SQL migration, and all Edge Functions; fix verified defects without rewriting working features.
3. Confirm the intended Supabase project and environment values, then apply migration and deploy/test backend functions.
4. Provision all six accounts securely using the local script; verify administrator/member permissions.
5. Produce and approve the approximately 100-second AI-generated project explainer; configure Vimeo and the independent MP4 fallback.
6. Deploy to the permanent HTTPS Render URL and run the full public, mobile, member, analytics, backup, and fallback acceptance tests.
7. Generate the QR code from the final URL, scan it from more than one phone/network, then print and attach it to the physical model.

## Release gates

- Do not print the QR code before the permanent production URL is final.
- Do not mark the video complete until the actual approximately 100-second explainer is uploaded and playback is tested on mobile data and Wi-Fi.
- Do not mark the application production-ready based only on the project verification script; TypeScript/Vite build and live Supabase tests are required.
- Never place Supabase service-role/secret keys or member passwords in frontend environment variables, chat, or the public repository.

## Current modifications

- Added a visible **Meet the Team** control on the welcome screen and a **Watch Project Explanation** control on the team screen. Visitors can now move forward without waiting for the automatic timers.
- Fixed reduced-motion timing so accessibility preferences remove animation effects without cutting the time available to read the six team names.
- Extended `scripts/verify-project.mjs` to protect the manual visitor navigation and the 4/5-second reading windows.
- Updated this status tracker and the README to document the visitor navigation behaviour.

No credentials, database schema, secrets, or live deployment settings were changed. The final video and its external links remain pending.
