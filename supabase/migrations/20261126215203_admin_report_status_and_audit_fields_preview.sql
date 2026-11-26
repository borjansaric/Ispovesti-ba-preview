-- Ispovesti.ba Preview only: report workflow states and audit context.
-- This migration does not touch community_live or chat_live.

alter table community_test.reports add column if not exists status text not null default 'new';
alter table community_test.reports drop constraint if exists community_test_reports_status_check;
alter table community_test.reports add constraint community_test_reports_status_check
  check (status in ('new','reviewed','resolved','dismissed'));

alter table chat_test.reports add column if not exists status text not null default 'new';
alter table chat_test.reports drop constraint if exists chat_test_reports_status_check;
alter table chat_test.reports add constraint chat_test_reports_status_check
  check (status in ('new','reviewed','resolved','dismissed'));

alter table community_test.audit_log add column if not exists details text;
alter table community_test.audit_log add column if not exists target text;
alter table community_test.audit_log alter column content_id drop not null;
alter table chat_test.audit add column if not exists details text;
