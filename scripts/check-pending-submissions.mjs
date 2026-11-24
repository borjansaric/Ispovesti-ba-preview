import assert from 'node:assert/strict';
import { savePendingSubmission, listPendingSubmissions, deletePendingSubmission } from '../submission-store.mjs';

const records=new Map();
const store={
 put(value){const request={};queueMicrotask(()=>{records.set(value.requestId,structuredClone(value));request.result=value.requestId;request.onsuccess?.();});return request;},
 getAll(){const request={};queueMicrotask(()=>{request.result=[...records.values()].map(value=>structuredClone(value));request.onsuccess?.();});return request;},
 delete(key){const request={};queueMicrotask(()=>{records.delete(key);request.result=undefined;request.onsuccess?.();});return request;}
};
const db={
 objectStoreNames:{contains:()=>true},
 transaction(){const tx={objectStore:()=>store};queueMicrotask(()=>tx.oncomplete?.());return tx;}
};
globalThis.indexedDB={open(){const request={result:db};queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.();});return request;}};

const requestId='123e4567-e89b-42d3-a456-426614174000';
const record={requestId,kind:'comment',context:{confession_id:'42'},payload:{kind:'comment',body:'Sačuvani komentar',nickname:'Anonimno',confession_id:'42',allow_duplicate:false},createdAt:100};
await savePendingSubmission(record);
let saved=await listPendingSubmissions();
assert.equal(saved.length,1);
assert.equal(saved[0].requestId,requestId);
assert.equal(saved[0].payload.body,'Sačuvani komentar');
assert.equal(saved[0].payload.confession_id,'42');
await deletePendingSubmission(requestId);
saved=await listPendingSubmissions();
assert.equal(saved.length,0);
await assert.rejects(()=>savePendingSubmission({...record,requestId:'not-a-uuid'}),/Neispravan ID/);
await assert.rejects(()=>savePendingSubmission({...record,kind:'reply',payload:{...record.payload,kind:'reply',parent_id:null}}),/glavni komentar/);
console.log('Pending submission IndexedDB checks passed: save, restore listing, delete and validation.');
