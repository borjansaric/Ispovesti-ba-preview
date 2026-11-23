# Archived Supabase Edge Function: chat-test-api

- Function: `chat-test-api`
- Deployed version at capture: `6`
- Status at capture: `ACTIVE`
- JWT verification: disabled (`verify_jwt=false`)
- Deployed source SHA-256: `aa1580f23211643f25f58cc60d3313281e53fed01e5dcf26cfb0c189c37d2eb4`
- Captured: 2026-11-23
- Entrypoint: `index.ts`
- Supporting module: `gateway.mjs`

This archive preserves the deployed test-chat API source as captured from Supabase. It configures the gateway for the test environment and gates trial/admin test actions behind server-side configuration and SQL checks. The gateway validates the bearer session, allowlists actions and argument keys, applies request-size limits, and dispatches to `chat_test_dispatch_v2`.

This is a source archive for review and recovery only. It does not change or redeploy the Supabase function or database, and it does not modify the production website.