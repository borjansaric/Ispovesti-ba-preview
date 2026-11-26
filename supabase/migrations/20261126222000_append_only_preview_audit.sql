-- Ispovesti.ba Preview only: append-only guard for administrator audit tables.
create or replace function community_test.reject_audit_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'Audit evidencija je samo za dodavanje novih zapisa.'
    using errcode='42501';
end
$function$;

create or replace function chat_test.reject_audit_mutation()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  raise exception 'Audit evidencija je samo za dodavanje novih zapisa.'
    using errcode='42501';
end
$function$;

drop trigger if exists community_test_audit_no_update_delete on community_test.audit_log;
create trigger community_test_audit_no_update_delete
before update or delete on community_test.audit_log
for each row execute function community_test.reject_audit_mutation();

drop trigger if exists community_test_audit_no_truncate on community_test.audit_log;
create trigger community_test_audit_no_truncate
before truncate on community_test.audit_log
for each statement execute function community_test.reject_audit_mutation();

drop trigger if exists chat_test_audit_no_update_delete on chat_test.audit;
create trigger chat_test_audit_no_update_delete
before update or delete on chat_test.audit
for each row execute function chat_test.reject_audit_mutation();

drop trigger if exists chat_test_audit_no_truncate on chat_test.audit;
create trigger chat_test_audit_no_truncate
before truncate on chat_test.audit
for each statement execute function chat_test.reject_audit_mutation();

revoke update, delete, truncate on table community_test.audit_log from service_role;
revoke update, delete, truncate on table chat_test.audit from service_role;
