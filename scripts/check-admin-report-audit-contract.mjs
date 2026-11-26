import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const admin=read('../admin/admin.mjs');
const chatGateway=read('../supabase/functions/chat-test-api/gateway.mjs');
const reportSchema=read('../supabase/migrations/20261126215203_admin_report_status_and_audit_fields_preview.sql');
const reportRpcs=read('../supabase/migrations/20261126221000_complete_admin_report_and_audit_rpcs.sql');
const auditGuard=read('../supabase/migrations/20261126222000_append_only_preview_audit.sql');

assert.ok(admin.includes('item.report_status'),'Main admin does not display report workflow status.');
assert.ok(admin.includes('admin_report_status'),'Main admin has no report status actions.');
assert.ok(admin.includes('askModeratorReason'),'Moderation reason prompt is missing.');
assert.ok(admin.includes('unbanForm.addEventListener'),'Chat unban form is not wired.');
assert.ok(chatGateway.includes('admin_report_status'),'Chat gateway does not allow report status updates.');
assert.ok(chatGateway.includes("admin_report_status:['message_id','reporter_id','status','reason']"),'Chat report status payload is not allowlisted.');

assert.match(reportSchema,/community_test\.reports[\s\S]*status text not null default 'new'/i);
assert.match(reportSchema,/chat_test\.reports[\s\S]*status text not null default 'new'/i);
assert.match(reportRpcs,/publisher_pause/);
assert.match(reportRpcs,/admin_report_status/);
assert.match(reportRpcs,/a\.details/);
assert.match(auditGuard,/before update or delete/i);
assert.match(auditGuard,/before truncate/i);
assert.match(auditGuard,/revoke update, delete, truncate/i);

for(const source of [reportSchema,reportRpcs,auditGuard]){
  const executableSql=source.replace(/^\s*--.*$/gm,'');
  assert.doesNotMatch(executableSql,/community_live\.|chat_live\./i,'Preview admin migration must not modify live schemas.');
}
console.log('Preview admin report/audit contract checks passed.');
