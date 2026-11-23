# Migration source reconciliation — 2026-11-23

> **Inventory only.** This document is not executable SQL and must not be used to replay, reset, or baseline the database.

## Observed state

- The Supabase migration registry reported **57 applied records**, from `20261024091501` through `20261123092904`.
- The preview repository's migration inventory records only one tracked SQL migration source in this repository: `supabase/migrations/20261122105812_reply_notifications_v1.sql`.
- The production repository contains a historical baseline source at `supabase/migrations/20261023212548_community_v2.sql`, referenced by `launch/prepare-live.sql`. The migration registry inspected in the audit begins later and does not list that baseline version as applied. Its presence in source control is not proof that it was applied.
- The registry includes `20261122105812_reply_notifications_v1` followed by `20261122220717_remove_test_reply_notifications`. Read-only inspection found no current `community_test.reply_notifications` table, `community_test.notify_reply_author()` function, or associated notification trigger.
- No migration was applied, rolled back, rewritten, or replayed during the audit.

See also: [Supabase migration inventory](./supabase-migration-inventory-2026-11-23.md).

## Reconciliation procedure

1. Preserve the live migration registry exactly as observed; do not edit it to make it resemble the files currently in Git.
2. Recover original migration SQL from trusted backups, earlier branches, deployment artifacts, or the original authoring history.
3. For every recovered file, record its source, version, checksum, and whether the version is present in the live registry.
4. Compare recovered SQL with the current schema and object definitions. Treat the current database as authoritative for what exists now, not as proof of how it was created.
5. Identify migrations whose effects were later reversed or superseded; retain both the original and follow-up history.
6. Only after source and schema reconciliation, propose a baseline or migration-history repair. Any such database operation requires a separate review and explicit approval.

## Prohibited shortcuts

- Do not recreate missing migration files from migration names alone.
- Do not replay the historical `community_v2.sql` baseline against an existing database.
- Do not mark migrations applied, delete registry rows, or execute reconstructed SQL to make the registry appear complete.
- Do not treat the preview repository's SQL folder as a complete record of production schema history.

## Status

- Applied registry count and range: **read-only inspected**
- Original source completeness: **not reconciled**
- Database modifications: **none**
- Safe next step: **source recovery and schema comparison only**
