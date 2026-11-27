# PHYSICS DIGITAL HUB — V1.3.0 · Phase 3B

**Project:** Dual Axis Solar Tracker — 3D Working Model  
**Base checkpoint:** V1.2.0 · Phase 3A completed and live-tested by the project owner  
**Phase:** 3B — Premium Solar Technology Visual Transformation  
**Package status:** Source implementation prepared for owner upload and deployment

## Phase 3B implementation included

### Visual system
- Introduced a coherent solar-technology visual treatment: midnight navy, graphite, warm amber/gold, technical blue, and soft white.
- Refined the welcome, public video, Member Access, and private dashboard surfaces with more cinematic typography, soft lighting, polished borders, glass-like panels, and consistent component treatments.
- Improved the five dashboard sections: Overview, Comments, Video & Updates, Analytics, and Members.
- Improved public header, project film frame, action controls, access modal, member-selection cards, input focus treatment, dashboard navigation, metrics, analytics panels, comments cards, and directory cards.

### Required special effects
- **Solar Spark:** canvas-based gold/amber/white/blue particle bursts on pointer clicks/taps and keyboard activation. The canvas does not intercept input. The active particle count is capped; animation only runs while particles are alive; hidden-page particles are cleared; reduced-motion users do not receive particle movement.
- **Solar Signal Resolve:** Team Showcase heading and all eight public member names animate from short-lived technical glyphs into their exact final text. The animation is staged and does not continuously scramble text. Reduced-motion users immediately see the final wording.
- **Pointer spotlight and 3D response:** team cards, member-selection cards, dashboard metric cards, and dashboard panels use pointer-relative light and subtle perspective movement on suitable pointer devices.
- **Solar marquee:** restrained technical-topic strip added to the Team Showcase.

### Authentication error handling
- `src/lib/supabase.ts` inspects the Edge Function HTTP response body (when available) and extracts its JSON error message rather than blindly exposing the generic Supabase transport message.
- `src/App.tsx` maps authentication failures to safe, field-level feedback for wrong shared password, wrong individual password, rate limiting, expired shared session, and service/network failure.
- The individual Supabase Auth invalid-credential condition is explicitly translated into a user-facing message. Other Auth service failures use a neutral availability message.
- Error messages do not reveal raw Supabase/Edge Function transport strings or stack traces in the password forms.

### Phase 3A preservation
- The eight approved members, names, codes, and order are unchanged.
- Aman Alam remains the sole database administrator.
- Abhirup Baru remains a normal database `member` with the Project Leader display badge.
- Existing authentication, database schema/migrations, RLS, Edge Functions, analytics, comments, Likes, export/backup operations, and dashboard role checks are preserved.
- The current deployed shared gate setting **20 attempts / 60 seconds** has been carried into this source package. This prevents a future deployment from restoring the older 5/900 setting.

## Main files changed

- `src/App.tsx`
- `src/styles.css`
- `src/lib/supabase.ts`
- `supabase/functions/verify-shared-gate/index.ts` (carry-forward of current live 20/60 setting)
- `scripts/verify-project.mjs`
- `package.json` (version `1.3.0`)
- `README.md`
- `PROJECT_STATUS.md`
- `PHASE_3B_PLAN.md` (implementation specification and acceptance checklist)

## Checks and known limitations

- `node scripts/verify-project.mjs` is part of the package checks and is intended to validate the roster, project identity, Phase 3B features, friendly authentication path, rate-limit carry-forward, and local-secret exclusions.
- TypeScript syntax is checked separately below. A full typecheck and Vite production build require installed package dependencies.
- In this execution environment the npm registry was previously unreachable (`EAI_AGAIN`), so a dependency-backed `npm install`, `npm run typecheck`, and `npm run build` may not be available here. Do not interpret source verification as a successful production build.
- After extracting the ZIP on the owner's Windows machine, run `npm.cmd install`, `npm.cmd run verify`, `npm.cmd run typecheck`, and `npm.cmd run build`. Resolve any failures before uploading to GitHub.
- The ZIP does not include `node_modules`, `dist`, local `.env` files, Supabase server secrets, personal credentials, or passwords.

## Owner deployment workflow

1. Keep a copy of the current working project as a rollback point.
2. Extract this package and upload its project contents to the existing GitHub repository on `main`.
3. Commit with a message such as `feat: implement Phase 3B premium solar visual transformation`.
4. Check the GitHub build workflow.
5. Wait for Render's automatic deploy to succeed.
6. Supabase Edge Function source has no behavioral changes in this phase except preserving the already-live `20 / 60` rate-limit setting in the source. The verify-shared-gate function does not require redeployment if the live function already has that setting. Redeploy only if the function source is actually changed during review.
7. Perform the Phase 3B live acceptance checks in `PHASE_3B_PLAN.md`.

## Phase 3B acceptance checks

- [ ] Desktop and mobile welcome screen visuals.
- [ ] Team Showcase shows all eight members in the approved order.
- [ ] Abhirup Baru's Project Leader badge remains correct.
- [ ] Team heading and member names resolve from the scramble effect into exact text.
- [ ] Reduced-motion setting immediately shows final readable text.
- [ ] Solar Spark particle bursts appear on click/tap/keyboard activation without blocking interaction.
- [ ] Reduced-motion setting disables particle movement.
- [ ] Shared wrong-password attempt displays friendly inline text.
- [ ] Individual wrong-password attempt displays friendly inline text.
- [ ] Rate-limit and service failures display friendly non-technical feedback.
- [ ] All eight individual accounts work.
- [ ] Administrator-only and Project Member permissions remain correct.
- [ ] Public video, Like, comments, visitor journey, and MP4 link remain functional.
- [ ] All five dashboard tabs work and are visually consistent.
- [ ] Responsive layout has no unintended clipping or horizontal overflow.
- [ ] GitHub build is green and Render deploy succeeds.
- [ ] Live visual and functional checks pass.

## Scope boundaries

Phase 3B is a visual and frontend-interaction upgrade. It does not introduce the separately planned later video upload/storage capability or other new backend product features. Those remain future phases.
