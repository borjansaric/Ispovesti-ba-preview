import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { savePendingSubmission, listPendingSubmissions, deletePendingSubmission } from '../submission-store.mjs';

const [app, migration] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261124170000_require_submission_request_id.sql', import.meta.url), 'utf8'),
]);

assert.match(app, /contentForm\('comment'/, 'comments must use the shared submission composer');
assert.match(app, /contentForm\('reply'/, 'replies must use the shared submission composer');
assert.match(app, /requestId=restored\?\.requestId\|\|null/, 'retry must restore the original request ID');
assert.match(app, /if\(fingerprint!==lastPayload\)\{requestId=crypto\.randomUUID\(\);lastPayload=fingerprint;\}/, 'only a changed payload may get a new request ID');
const persistAt = app.indexOf('await savePendingSubmission({requestId,kind,context:extra,payload');
const sendAt = app.indexOf("request('submit',{...payload,request_id:requestId}", persistAt);
assert.ok(persistAt >= 0 && sendAt > persistAt, 'pending record must be saved before network submission');
const catchAt = app.indexOf('}catch(err){if(optimisticShown)');
const finallyAt = app.indexOf('finally{sending=false', catchAt);
assert.ok(catchAt >= 0 && finallyAt > catchAt, 'submission failure handler must exist');
const failureHandler = app.slice(catchAt, finallyAt);
assert.match(failureHandler, /phase:'rollback'/, 'failed optimistic comments/replies must be rolled back in the UI');
assert.doesNotMatch(failureHandler, /deletePendingSubmission/, 'network failure must not delete the retry record');
assert.match(app, /phase:'confirmed',pendingId:optimistic\.id/, 'successful retry must replace the optimistic item');
assert.match(migration, /FROM community_test\.submission_receipts[\s\S]*?v_receipt\.payload<>v_payload[\s\S]*?jsonb_build_object\('replayed',true\)/, 'same request ID and payload must replay the stored server result');

const records = new Map();
const store = {
  put(value) { const request={}; queueMicrotask(()=>{records.set(value.requestId,structuredClone(value));request.onsuccess?.();}); return request; },
  getAll() { const request={}; queueMicrotask(()=>{request.result=[...records.values()].map(value=>structuredClone(value));request.onsuccess?.();}); return request; },
  delete(key) { const request={}; queueMicrotask(()=>{records.delete(key);request.onsuccess?.();}); return request; },
};
const db = {
  objectStoreNames:{contains:()=>true},
  transaction(){const tx={objectStore:()=>store};setTimeout(()=>tx.oncomplete?.(),0);return tx;},
};
globalThis.indexedDB={open(){const request={result:db};queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.();});return request;}};

const cases = [
  {kind:'comment',requestId:'123e4567-e89b-42d3-a456-426614174001',payload:{kind:'comment',body:'Probni komentar',nickname:'Anonimno',confession_id:'42',allow_duplicate:false}},
  {kind:'reply',requestId:'123e4567-e89b-42d3-a456-426614174002',payload:{kind:'reply',body:'Probni odgovor',nickname:'Anonimno',confession_id:'42',parent_id:'7',allow_duplicate:false}},
];
for (const test of cases) {
  await savePendingSubmission({requestId:test.requestId,kind:test.kind,context:{confession_id:'42',...(test.kind==='reply'?{parent_id:'7'}:{})},payload:test.payload,createdAt:100});
  const restored=(await listPendingSubmissions()).find(item=>item.requestId===test.requestId);
  assert.ok(restored, test.kind+' must survive interruption in local pending storage');
  assert.equal(restored.kind,test.kind);
  assert.equal(restored.requestId,test.requestId, test.kind+' must retain the same ID for retry');
  assert.deepEqual(restored.payload,test.payload);
  await deletePendingSubmission(test.requestId);
}
assert.equal((await listPendingSubmissions()).length,0);
console.log('Comment/reply retry checks passed: shared composer, same request ID, pending persistence, UI rollback, and server replay contract.');
