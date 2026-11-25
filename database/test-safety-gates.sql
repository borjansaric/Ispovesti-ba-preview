-- ISPOVESTI.BA — TEST ONLY
-- Safety gates, chat underage report reason and admin activity dossier.
-- Target: roxajqagksffbsbzdrap / community_test + chat_test.
-- DO NOT run against community_live, chat_live or production.

begin;

create table if not exists public.isp_user_gates (
 user_id uuid primary key references auth.users(id) on delete cascade,
 age_status text not null default 'pending' check (age_status in ('pending','adult','underage')),
 age_band text check (age_band is null or age_band in ('18-24','25-34','35-44','45-54','55+')),
 site_rules_version text,
 chat_rules_version text,
 age_confirmed_at timestamptz,
 site_rules_accepted_at timestamptz,
 chat_rules_accepted_at timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.isp_user_gates enable row level security;
revoke all on public.isp_user_gates from anon, authenticated;
grant all on public.isp_user_gates to service_role;
drop policy if exists "service role manages installation gates" on public.isp_user_gates;
create policy "service role manages installation gates" on public.isp_user_gates
 for all to service_role using (true) with check (true);

drop table if exists community_test.user_gates;

-- Add the reported author's UID to the admin report rows, for a dossier link.
do $$
declare d text;
begin
 select pg_get_functiondef('public.community_test_admin_read(uuid,text,jsonb)'::regprocedure) into d;
 d:=replace(d,
  'r.created_at reported_at,r.user_id::text reporter_id,NULL::text details',
  'r.created_at reported_at,c.author_id::text target_author_uid,r.user_id::text reporter_id,NULL::text details');
 d:=replace(d,
  'r.created_at reported_at,r.user_id::text reporter_id,r.details',
  'r.created_at reported_at,m.user_id::text target_author_uid,r.user_id::text reporter_id,r.details');
 execute d;
end $$;

create or replace function public.community_test_admin_dossier(p_uid uuid,p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
set search_path to ''
as $function$
declare
 v_target uuid;
 v_profile jsonb;
 v_community jsonb;
 v_chat jsonb;
 v_community_reports jsonb;
 v_chat_reports jsonb;
 v_community_audit jsonb;
 v_chat_audit jsonb;
 v_community_flags jsonb;
 v_chat_flags jsonb;
 v_chat_bans jsonb;
begin
 if current_user not in ('service_role','postgres') or p_uid is null then
  raise exception 'Zabranjen pristup.' using errcode='42501';
 end if;
 perform community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
 if p_action<>'read' then raise exception 'Nepoznata radnja.'; end if;
 begin v_target:=(p_args->>'target_uid')::uuid; exception when others then raise exception 'Neispravan anonimni UID.'; end;
 if v_target is null then raise exception 'Nedostaje anonimni UID.'; end if;

 select to_jsonb(p) into v_profile from chat_test.profiles p where p.user_id=v_target;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_community
 from (select id,kind,confession_id,parent_id,body,nickname,state,created_at,published_at,removed_at
       from community_test.content where author_id=v_target) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_chat
 from (select m.id,m.body,m.created_at,m.removed,p.generated_nickname nickname
       from chat_test.messages m left join chat_test.profiles p on p.user_id=m.user_id
       where m.user_id=v_target) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_community_reports
 from (select r.content_id,c.kind,c.body,c.nickname,r.reason,r.created_at,r.user_id reporter_uid,
              (c.author_id=v_target) authored_by_target
       from community_test.reports r join community_test.content c on c.id=r.content_id
       where c.author_id=v_target or r.user_id=v_target) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_chat_reports
 from (select r.message_id,m.body,r.reason,r.details,r.created_at,r.user_id reporter_uid,
              (m.user_id=v_target) authored_by_target
       from chat_test.reports r join chat_test.messages m on m.id=r.message_id
       where m.user_id=v_target or r.user_id=v_target) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_community_audit
 from (select a.id,a.content_id,a.action,a.admin_id,a.created_at
       from community_test.audit_log a
       where a.content_id in (select id from community_test.content where author_id=v_target)) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_chat_audit
 from (select a.id,a.action,a.target,a.admin_id,a.created_at
       from chat_test.audit a
       where a.target in (select id::text from chat_test.messages where user_id=v_target)
          or a.target in (select 'chat:'||id::text from chat_test.messages where user_id=v_target)
          or a.target=v_target::text
          or a.target=(select public_id::text from chat_test.profiles where user_id=v_target)) x;
 select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc),'[]'::jsonb) into v_community_flags
 from community_test.moderation_flags f
 where f.content_id in (select id from community_test.content where author_id=v_target);
 select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc),'[]'::jsonb) into v_chat_flags
 from public.chat_test_moderation_flags f where f.user_id=v_target;
 select coalesce(jsonb_agg(to_jsonb(b) order by b.until_at desc),'[]'::jsonb) into v_chat_bans
 from chat_test.bans b where b.user_id=v_target;

 return jsonb_build_object('uid',v_target,'profile',coalesce(v_profile,'{}'::jsonb),
   'community_activity',v_community,'chat_activity',v_chat,
   'community_reports',v_community_reports,'chat_reports',v_chat_reports,
   'community_moderation',v_community_audit,'chat_moderation',v_chat_audit,
   'community_flags',v_community_flags,'chat_flags',v_chat_flags,'chat_bans',v_chat_bans);
end
$function$;
revoke all on function public.community_test_admin_dossier(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_test_admin_dossier(uuid,text,jsonb) to service_role;

-- Remove all anonymous-account recovery actions and add the 18- report reason.
do $$
declare d text; s integer; e integer;
begin
 select pg_get_functiondef('public.chat_test_dispatch(uuid,text,jsonb)'::regprocedure) into d;
 d:=replace(d,
  '''profile'',''history'',''send'',''block'',''unblock'',''report'',''recovery_set'',''recover'',''admin_status''',
  '''profile'',''history'',''send'',''block'',''unblock'',''report'',''admin_status''');
 d:=replace(d,',''has_recovery'',exists(select 1 from chat_test.recovery where user_id=p_uid)','');
 d:=replace(d,'''hate_speech'',''spam'',''other''','''hate_speech'',''spam'',''other'',''underage''');
 s:=position('if p_action=''recovery_set'' then' in d);
 e:=position('a=chat_test.assert_access(p_uid);' in d);
 if s>0 and e>s then d:=substr(d,1,s-1)||substr(d,e); end if;
 s:=position('if p_action=''recover'' then' in d);
 e:=position('if p_action=''profile'' then' in d);
 if s>0 and e>s then d:=substr(d,1,s-1)||substr(d,e); end if;
 execute d;

 select pg_get_functiondef('public.chat_test_dispatch_v2(uuid,text,jsonb,text)'::regprocedure) into d;
 if position('Oporavak naloga nije dostupan' in d)=0 then
  d:=replace(d,E'begin\n if current_user',
   E'begin\n if p_action in (''recover'',''recovery_set'') then raise exception ''Oporavak naloga nije dostupan.'' using errcode=''42501''; end if;\n if current_user');
 end if;
 s:=position('if p_action=''recover'' and exists' in d);
 if s>0 then
  e:=position(E'\n' in substr(d,s));
  if e>0 then d:=substr(d,1,s-1)||substr(d,s+e); end if;
 end if;
 execute d;
end $$;

drop table if exists chat_test.recovery;

commit;
