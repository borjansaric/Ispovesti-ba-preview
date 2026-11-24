import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, api, gateway, store, migration] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/functions/community-test-api/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../submission-store.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261124170000_require_submission_request_id.sql', import.meta.url), 'utf8'),
]);

const uuidPattern = String.raw`[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}`;

assert.match(app, /requestId=restored\?\.requestId\|\|null/, 'recovery must retain the original request ID');
assert.match(app, /await savePendingSubmission\(\{requestId,kind,context:extra,payload/, 'pending data must be persisted before network submission');
assert.match(app, /request\('submit',\{\.\.\.payload,request_id:requestId\}/, 'the original request ID must be sent to the server');
assert.match(store, /keyPath:'requestId'/, 'pending submissions must be keyed by request ID');
assert.match(store, /Neispravan ID nedovršenog slanja/, 'local persistence must validate request IDs');

assert.match(api, /action==='submit'[\s\S]*?request_id[\s\S]*?Nedostaje ili je neispravan ID/, 'local mode must reject submissions without a valid ID');
assert.match(gateway, /const requestId=args\.request_id;[\s\S]*?requestId\)[\s\S]*?delete args\.captcha_token;/, 'the Edge Function gateway must validate request IDs');

const validationAt = migration.indexOf("Nedostaje ili je neispravan ID zahtjeva za slanje.");
const lookupAt = migration.indexOf('FROM community_test.submission_receipts');
const insertAt = migration.indexOf('INSERT INTO community_test.submission_receipts');
assert.ok(validationAt >= 0 && lookupAt > validationAt, 'database must reject a missing/malformed ID before receipt lookup');
assert.ok(insertAt > lookupAt, 'successful writes must persist their receipt in the same database function');
assert.match(migration, /v_receipt\.payload<>v_payload/, 'reusing an ID with changed content must be rejected');
assert.match(migration, /jsonb_build_object\('replayed',true\)/, 'same ID and same payload must return the stored result');
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_uid::text,73142012\)\)/, 'submissions must remain serialized per anonymous user');
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.community_test_dispatch/, 'the migration must update the test dispatcher');
assert.doesNotMatch(migration, /community_live\./, 'the migration must not touch the live schema');
assert.match(migration, new RegExp(uuidPattern), 'database must validate a UUID-shaped request ID');

console.log('Submission idempotency source-contract checks passed.');
