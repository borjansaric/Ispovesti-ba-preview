# Auth identity deletion review — 2026-11-23

> **Read-only finding and change gate.** No Auth user, database row, foreign key, function, or policy was changed as part of this review.

## Requirement under review

Decision ODL-021 says that published content must remain available when an anonymous Auth identity is deleted, and that a persistent `author_ref` must not be introduced to link a person's posts across time.

## Observed database constraint

The read-only audit found multiple foreign-key references to `auth.users` with `NO ACTION` behavior across `community_live`, `community_test`, `chat_live`, and `chat_test`. The known examples include:

- `community_live.content.author_id`
- `community_test.content.author_id`

With dependent rows present, deleting the referenced Auth identity may be rejected by PostgreSQL. This is not compatible with assuming that an Auth identity can always be deleted while its content remains.

The four application schemas and Auth are in one Supabase project. A destructive test against a test-schema row is **not** automatically isolated from live Auth identities.

## Required investigation before a schema proposal

1. Export the complete foreign-key inventory that references `auth.users`, including constraint names, source columns, delete/update actions, and whether each source column is nullable.
2. Identify all dependent content, chat, moderation, receipt, list, and audit rows, plus triggers/functions that rely on the Auth UID.
3. Confirm which references represent temporary request ownership, which are required for moderation/security, and which can safely become nullable.
4. Choose a design that preserves published content without introducing a cross-session persistent author identity. Evaluate `ON DELETE SET NULL` only where nullability and application behavior make it safe; do not assume it is universally appropriate.
5. Avoid `ON DELETE CASCADE` for published content.
6. Validate the chosen behavior in a separate disposable Supabase project/branch or isolated clone. Do not test Auth deletion in the shared live/test project without a separately approved isolation plan.

## Status

- Finding: **confirmed by read-only FK inspection**
- Schema remediation: **not designed or applied**
- Auth deletion test: **not performed**
- Production, database, and Edge Functions: **untouched**

A migration must not be drafted for execution until the full dependency inventory and the intended deletion semantics have been reviewed and separately approved.
