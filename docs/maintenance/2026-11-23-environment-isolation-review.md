# Environment isolation review — 2026-11-23

> **Preview-only code change.** This change does not modify production configuration, Supabase Auth settings, database schemas, or Edge Functions.

## Preview environment verified

The preview repository is configured with:

- `mode: "live-test"`
- `chatEnvironment: "test"`
- Community requests routed through `community-test-api`
- CAPTCHA configuration retrieved through `community-test-api`
- Chat requests routed through `chat-test-api`
- Test data stored in `community_test` and `chat_test`

The test and live schemas are in the same Supabase project, and Auth is shared at project level. Schema/function separation therefore does not mean separate Auth infrastructure.

## Change made in this preview branch

The preview frontend now uses dedicated browser Auth storage keys:

- `ispovesti-preview-user-session`
- `ispovesti-preview-admin-session`

Previously it used generic `ispovesti-test-*` keys. The dedicated names prevent the preview app from reading or overwriting a session under the generic keys when applications share a browser origin (for example, path-based GitHub Pages sites).

The old browser keys are not automatically deleted. This avoids clearing a session that another app may still be using. A visitor or administrator may need to sign in again in the preview after this change.

The preview continues to use test endpoints. It must not be switched to live endpoints.

## Production-side follow-up — not changed here

The separate production repository was found to contain a related mismatch: its live-mode client used generic test Auth storage key names, and its CAPTCHA configuration request used `community-test-api` while community requests used `community-live-api`.

The correct production-side change should be prepared in the production repository as a separate, explicitly authorized preview/review task:

- use dedicated `ispovesti-live-user-session` and `ispovesti-live-admin-session` keys;
- retrieve live CAPTCHA configuration through `community-live-api`;
- ensure no live page or client calls `community-test-api` for live configuration.

No production file was edited in this workstream.

## Regression checks added

`scripts/check-preview-isolation.mjs` verifies that preview configuration stays in test mode, uses the dedicated preview Auth keys, and selects test community/CAPTCHA/chat endpoints.

A new `.github/workflows/preview-checks.yml` runs syntax checks, the isolation assertions, and a preview build on pull requests. It does **not** deploy Pages. The existing Pages workflow also runs the isolation assertions before building.

## Status

- Preview Auth storage namespace: **changed in this branch**
- Preview API environment: **remains test-only**
- Production code: **not changed**
- Supabase Auth/database/Edge Functions: **not changed**
- Browser end-to-end test: **not performed**
