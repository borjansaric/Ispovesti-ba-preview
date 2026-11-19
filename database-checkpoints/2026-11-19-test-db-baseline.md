# Ispovesti.ba — test database baseline

Captured: 2026-11-19

- Supabase project: `roxajqagksffbsbzdrap`
- Schema: `community_test` (test only)
- Function: `public.community_test_dispatch_base(uuid, text, jsonb)`
- Submission sequence: insert into `community_test.content`, then call `community_test.rate(...)`.
- Duplicate check remains before insert and before rate counting.
- Comment/reply duplicate scope remains author + exact body + same confession; confession duplicate scope remains author + exact body + confession kind.
- Limits remain 3 confessions, 6 comments, and 6 replies per 10-minute window (comments and replies use separate action counters).
- Verification query on 2026-11-19 confirmed duplicate check preserved and `rate` occurs after insert (`rate_after_insert = true`).

This note documents the state of the TEST database at the checkpoint. It is not a migration or executable SQL. Production database was not modified.
