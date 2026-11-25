# PHYSICS DIGITAL HUB — Phase 3A Status

**Checkpoint:** V1.2.0 · Phase 3A — Dual Axis Solar Tracker identity and eight-member integration  
**Source baseline:** Uploaded `physics-digital-hub-main.zip`  
**Project:** Dual Axis Solar Tracker — 3D Working Model  
**Updated:** 25 November 2026

## Phase 3A scope completed in this source checkpoint

- Replaced the public project identity with **Dual Axis Solar Tracker — 3D Working Model** across the welcome experience, project labels, video title, metadata, emergency page, favicon, package description, and documentation.
- Replaced the earlier project illustration with a solar-tracker SVG scene using a photovoltaic panel, two-axis support, solar path/orbit accents, and a sun motif.
- Integrated the final eight-person roster in the approved order and codes:

| Code | Member | Role / designation |
|---|---|---|
| 01 | Aman Alam | Administrator |
| 02 | Abhirup Baru | Project Member · Project Leader |
| 03 | Anik Ghosh | Project Member |
| 04 | Saheb Mukherjee | Project Member |
| 05 | Sandipan Mukherjee | Project Member |
| 06 | Ananya Gope | Project Member |
| 07 | Neha Kumari | Project Member |
| 08 | Khushi Rawani | Project Member |

- Added a gold **PROJECT LEADER** badge beside Abhirup Baru wherever his name is displayed in the public team credits, member access selection, selected profile, dashboard identity, overview team list, member directory, and directory CSV designation column.
- Kept the leadership designation separate from database permissions: Aman remains the sole administrator, and Abhirup remains a normal `member` role.
- Updated local secure member-account provisioning to support all eight accounts.
- Updated the fresh-install profile-code constraint and added an upgrade migration that safely remaps the three existing members whose codes change, using temporary unique values before assigning their final codes.
- Updated the verifier to check the exact eight-member order, frontend/provisioning consistency, Project Leader display hooks, solar identity, schema migration, visitor journey, reduced-motion behaviour, emergency configuration, and secret-file exclusions.
- Removed the retired AI credit line and all superseded project identity text from source content and metadata.

## Important deployment steps still required

The ZIP updates source code only. It does **not** apply changes to a live Supabase or Render project.

1. Upload the extracted project files to the existing GitHub repository's `main` branch and commit them.
2. For an existing Supabase database, apply `supabase/migrations/202611250001_phase3a_eight_member_roster.sql` in the SQL Editor. For a new database, run the initial migration and then the Phase 3A migration.
3. On a trusted local computer, configure `scripts/.env.admin.local` and run `node scripts/bootstrap-members.mjs` to create/update the eight Auth accounts and profile rows. Enter passwords only in the local terminal. The script updates each named account's password as part of its existing secure setup process.
4. Confirm the eight profiles and their codes in Supabase, and verify that only Aman has the `admin` role.
5. Confirm Render's automatic deployment and test the public experience and member portal on real devices.
6. Upload/configure the new Dual Axis Solar Tracker explainer video separately. Video upload and redesign phases 3B–3D are not included in this checkpoint.

## Verification record

Checks run for this checkpoint:

- `npm run verify` — passed.
- `node --check scripts/bootstrap-members.mjs` — passed.
- `node --check scripts/verify-project.mjs` — passed.
- TypeScript/TSX syntax transpilation and CSS/HTML/SVG/JSON structure checks — performed.
- ZIP CRC/integrity verification — performed before delivery.

The TypeScript typecheck and Vite production build could not be completed in this environment: `npm install` timed out while npm could not resolve `registry.npmjs.org` (`EAI_AGAIN`). No dependencies are bundled in the ZIP. Run `npm install` and `npm run build` after downloading it in an environment with npm registry access.

A source-level check does not prove a live Supabase migration, successful account provisioning, Edge Function deployment, or Render deployment. Those operations must be confirmed against the actual connected services.

## Scope boundaries

- **3A:** Project identity, final eight-member roster, Project Leader badge, account provisioning support, schema upgrade, verification and documentation — included here.
- **3B:** Full visual transformation — separate future phase.
- **3C:** Administrator video upload and persistent storage — separate future phase.
- **3D:** Solar-themed Members Portal redesign — separate future phase.
- **3E:** Full live testing and acceptance — follows implementation and deployment.
