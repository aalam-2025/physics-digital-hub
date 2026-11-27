# PHYSICS DIGITAL HUB — Phase 3B
## Premium Solar Technology Visual Transformation

**Version:** V1.3.0  
**Base:** V1.2.0 · Phase 3A complete  
**Project:** Dual Axis Solar Tracker — 3D Working Model

## Objective

Create a premium, cinematic, solar-technology-inspired visual experience across the public visitor journey, Member Access, and the complete private dashboard. Phase 3B is a frontend design and interaction phase. It must preserve the working Phase 3A backend, data model, user accounts, permissions, and security.

## Implemented in this package

### Visual identity and design foundation
- Midnight navy, graphite, solar amber/gold, technical blue, and soft white palette.
- More deliberate heading hierarchy, solar-spectrum gradient treatment, illuminated borders, and glass-like surfaces.
- Consistent improvements to buttons, cards, navigation, forms, badges, modals, dashboard panels, metric cards, and charts.
- Cinematic scene transitions and restrained ambient highlights.

### Public experience
- Welcome screen: refined solar lighting, title treatment, orbit accents, and existing Solar Tracker illustration.
- Team Showcase: eight premium member cards, 3D pointer response, solar spotlight treatment, solar information marquee, and staged text-scramble reveals for the main heading and all eight names.
- The Team Showcase scramble effect resolves every name to its exact text; it does not continuously scramble or leave text distorted. Reduced-motion preference presents the final text immediately.
- Main video experience: enhanced public header, video frame, and Like/Comments/Download controls.

### Solar Spark click/tap interaction
- Lightweight canvas particle layer produces a small, randomized burst of warm gold, amber, white, and technical-blue particles at pointer activation points.
- Supports mouse, touch, and keyboard-triggered activation.
- Particles are short-lived, capped to a finite pool, and animated only while there are active particles.
- The canvas is pointer-transparent and does not intercept controls or typing.
- The effect is disabled when `prefers-reduced-motion: reduce` is enabled and cleared when the page becomes hidden.

### Member Access
- Refined access choices, member selection cards, login form surfaces, focus treatment, and modal presentation.
- Field-level friendly authentication feedback for shared-password and individual-password errors.
- Raw Supabase Edge Function transport messages are not intentionally displayed to members. The frontend reads the JSON error body from the Edge Function response when available and maps common failures to understandable messages.
- Wrong individual credentials, wrong shared password, rate limiting, expired shared session, and service/network failure receive distinct user-facing feedback.

### Private dashboard
- Updated dashboard header, identity/role badges, navigation, overview metrics, analytics cards/charts, comments panels, video/settings forms, and member directory.
- Card spotlights and restrained perspective response on suitable pointer devices.
- Existing tab names, content, controls, and permission-dependent visibility are retained.

### Motion, accessibility, and responsive behaviour
- Reduced-motion users receive static final text and no particle bursts; existing reduced-motion rules remain in place.
- Pointer-specific tilt/light effects do not apply on touch-only devices.
- Keyboard activation is supported; visible focus indicators remain.
- Desktop, tablet, and mobile layouts receive specific spacing and card-grid rules.
- No sound, hacker-style digital rain, fake system alerts, or custom cursor replacement has been added.

## Functionality and security explicitly preserved

- Exact eight-member roster and approved order/codes.
- Aman Alam remains the sole `admin`.
- Abhirup Baru remains a `member` in the database and receives only the Project Leader display designation.
- Shared-password gate, individual Supabase Auth accounts, signed gate token, and sign-out behaviour.
- Supabase schema/migrations, RLS, Edge Functions, analytics, comments, Likes, exports, and admin backup.
- Existing role enforcement in `member-api` and frontend role-based controls.
- Latest shared-gate limit from the live deployment: **20 attempts per 60-second window**.

## Files principally updated

- `src/App.tsx` — Solar Spark canvas, Team Showcase scramble effect, card pointer interactions, and field-level auth feedback.
- `src/styles.css` — Phase 3B design system, public/team/member/dashboard refinements, responsive rules, and motion preferences.
- `src/lib/supabase.ts` — safe JSON response parsing for Edge Function errors; generic transport messages are mapped to safe fallbacks.
- `supabase/functions/verify-shared-gate/index.ts` — carries forward the already-live 20/60 rate-limit setting so the source package does not restore 5/900.
- `scripts/verify-project.mjs` — checks Phase 3B features, auth error handling, rate limit, roster, project identity, and secrets exclusions.
- `package.json` — version updated to 1.3.0.
- `README.md` and `PROJECT_STATUS.md` — updated Phase 3B documentation.

## Validation instructions

From the project root, run:

```powershell
npm.cmd install
npm.cmd run verify
npm.cmd run typecheck
npm.cmd run build
```

The package's `prebuild` hook runs project verification before the Vite build. After uploading to GitHub `main`, confirm the CI build is green, wait for Render to deploy, and test the live site.

## Live acceptance checklist

- [ ] Welcome screen and project illustration render at desktop and mobile widths.
- [ ] Team Showcase shows all eight names in the approved order and Abhirup's badge.
- [ ] Team heading and member names resolve from scrambled glyphs to exact readable text.
- [ ] Scramble is immediate/static when reduced motion is enabled.
- [ ] Solar Spark bursts appear for pointer/touch/keyboard activations without blocking controls.
- [ ] No particle effect appears when reduced motion is enabled.
- [ ] Shared-password wrong entry displays friendly inline feedback, not raw Supabase transport text.
- [ ] Individual-password wrong entry displays friendly inline feedback, not raw Supabase transport text.
- [ ] Rate-limit and service-unavailable responses display appropriate friendly messages.
- [ ] All eight accounts still sign in and land on the correct profile.
- [ ] Administrator and Project Member controls/permissions remain unchanged.
- [ ] Public Likes, comments, downloads, Vimeo player and visitor journey still work.
- [ ] Dashboard Overview, Comments, Video & Updates, Analytics, and Members tabs work.
- [ ] Desktop, tablet, and mobile layouts have no clipping or horizontal overflow.
- [ ] `npm.cmd run verify`, `npm.cmd run typecheck`, and `npm.cmd run build` pass in the user environment.
- [ ] Render deployment and live acceptance testing pass.

## Scope boundary

Phase 3B does not implement the later administrator video-upload/storage work or the separate Members Portal feature expansion. Those remain subsequent roadmap items. This phase redesigns the visuals of the existing video settings and dashboard without introducing a new upload architecture.
