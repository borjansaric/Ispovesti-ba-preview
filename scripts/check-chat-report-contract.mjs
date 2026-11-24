import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const chatUi=read('../chat/ui.mjs');
const chatCss=read('../chat/chat.css');
const admin=read('../admin/admin.mjs');
const chatAdmin=read('../chat/admin.mjs');
const migration=read('../supabase/migrations/20261125100000_chat_report_parity.sql');
const gateway=read('../supabase/functions/chat-test-api/gateway.mjs');

assert.doesNotMatch(chatUi,/prompt\(/,'Chat report must not use a browser prompt.');
for(const reason of ['hate_speech','spam','other'])assert.ok(chatUi.includes(reason),'Missing chat report reason: '+reason);
assert.ok(chatUi.includes('Opiši razlog prijave…'),'Chat report description field is missing.');
assert.ok(chatUi.includes('already_reported'),'Duplicate report response is not handled.');
assert.match(chatCss,/\.chat-panel\[data-own-side="right"\] \.chat-message\.own \.chat-message-menu[\s\S]*?left:-7px/);
assert.ok(admin.includes('item.details'),'Main admin reports do not show additional details.');
assert.ok(chatAdmin.includes('report.details'),'Chat archive does not show additional details.');
assert.match(migration,/alter table chat_test\.reports[\s\S]*add column if not exists details text/i);
assert.doesNotMatch(migration,/chat_live\./i,'Preview migration must not touch the live chat schema.');
assert.match(gateway,/report:\['id','reason','details'\]/);
console.log('Chat report parity checks passed.');
