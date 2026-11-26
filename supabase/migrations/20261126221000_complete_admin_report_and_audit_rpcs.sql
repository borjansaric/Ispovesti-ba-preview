-- Ispovesti.ba Preview only: admin report status and audit coverage.
-- This is idempotent: already-updated function definitions are left unchanged.

do $migration$
declare v_definition text;
begin
  v_definition := pg_get_functiondef('public.community_test_dispatch_base(uuid,text,jsonb)'::regprocedure);
  if position('admin_report_status' in v_definition)=0 then
    v_definition := replace(v_definition,
      $decl$declare
 v_id bigint; v_parent bigint;$decl$,
      $decl2$declare
 v_id bigint; v_state text; v_parent bigint;$decl2$);
    v_definition := replace(v_definition,
      $old$elsif p_action='admin_remove' then
   v_id=(p_args->>'id')::bigint;
   update community_test.content set state='removed',removed_at=v_now where id=v_id;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   insert into community_test.audit_log(admin_id,content_id,action) values(p_uid,v_id,'remove');
   return '{"success":true}';
  elsif p_action='admin_publisher' then
   -- No manual bulk publishing or reordering: only pause/resume FIFO scheduler.
   update community_test.publisher set paused=(p_args->>'paused')::boolean where singleton;
   return '{"success":true}';$old$,
      $new$elsif p_action='admin_report_status' then
   v_id=(p_args->>'content_id')::bigint;
   v_state=p_args->>'status';
   if v_state not in ('new','reviewed','resolved','dismissed') then raise exception 'Nepoznat status prijave.'; end if;
   update community_test.reports set status=v_state
    where content_id=v_id and user_id=(p_args->>'reporter_id')::uuid;
   if not found then raise exception 'Prijava nije pronađena.'; end if;
   insert into community_test.audit_log(admin_id,content_id,action,target,details)
    values(p_uid,v_id,'report_status','report:'||v_id::text||':'||(p_args->>'reporter_id'),
      'Status: '||v_state||coalesce(' · Razlog: '||nullif(left(btrim(p_args->>'reason'),500),''),''));
   return '{"success":true}';
  elsif p_action='admin_remove' then
   v_id=(p_args->>'id')::bigint;
   update community_test.content set state='removed',removed_at=v_now where id=v_id;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   insert into community_test.audit_log(admin_id,content_id,action,details)
    values(p_uid,v_id,'remove',nullif(left(btrim(p_args->>'reason'),500),''));
   return '{"success":true}';
  elsif p_action='admin_publisher' then
   -- No manual bulk publishing or reordering: only pause/resume FIFO scheduler.
   update community_test.publisher
    set paused=(p_args->>'paused')::boolean
    where singleton and paused is distinct from (p_args->>'paused')::boolean
    returning paused into v_state;
   if found then
    insert into community_test.audit_log(admin_id,content_id,action,target,details)
    values(p_uid,null,case when v_state then 'publisher_pause' else 'publisher_resume' end,
      'publisher',nullif(left(btrim(p_args->>'reason'),500),''));
   end if;
   return '{"success":true}';$new$);
    if position('v_state text' in v_definition)=0 or position('publisher_pause' in v_definition)=0 then
      raise exception 'Community dispatcher nije bezbjedno ažuriran.';
    end if;
    execute v_definition;
  end if;

  v_definition := pg_get_functiondef('public.community_test_dispatch(uuid,text,jsonb)'::regprocedure);
  if position('nullif(left(btrim(p_args' in v_definition)=0 then
    v_definition := replace(v_definition,
      $old$INSERT INTO community_test.audit_log(admin_id,content_id,action)
      VALUES(p_uid,v_id,'restore');$old$,
      $new$INSERT INTO community_test.audit_log(admin_id,content_id,action,details)
      VALUES(p_uid,v_id,'restore',nullif(left(btrim(p_args->>'reason'),500),''));$new$);
    execute v_definition;
  end if;

  v_definition := pg_get_functiondef('public.community_test_admin_read(uuid,text,jsonb)'::regprocedure);
  if position('r.status report_status' in v_definition)=0 then
    v_definition := replace(v_definition,
      $old$r.content_id::text target_id,c.kind target_kind,c.body,c.nickname,c.state,r.reason,
          r.created_at reported_at$old$,
      $new$r.content_id::text target_id,c.kind target_kind,c.body,c.nickname,c.state,r.reason,r.status report_status,
          r.created_at reported_at$new$);
    v_definition := replace(v_definition,
      $old$r.message_id::text target_id,'chat_message' target_kind,m.body,p.generated_nickname nickname,
          case when m.removed then 'removed' else 'published' end state,r.reason,
          r.created_at reported_at$old$,
      $new$r.message_id::text target_id,'chat_message' target_kind,m.body,p.generated_nickname nickname,
          case when m.removed then 'removed' else 'published' end state,r.reason,r.status report_status,
          r.created_at reported_at$new$);
  end if;
  if position('a.details' in v_definition)=0 then
    v_definition := replace(v_definition,
      $old$a.action,('content:'||coalesce(a.content_id::text,'')) target,a.created_at$old$,
      $new$a.action,coalesce(a.target,'content:'||coalesce(a.content_id::text,'')) target,a.details,a.created_at$new$);
    v_definition := replace(v_definition,
      $old$a.action,('chat:'||coalesce(a.target,'')) target,a.created_at$old$,
      $new$a.action,('chat:'||coalesce(a.target,'')) target,a.details,a.created_at$new$);
  end if;
  if position('r.status report_status' in v_definition)=0 or position('a.details' in v_definition)=0 then
    raise exception 'Community admin read nije bezbjedno ažuriran.';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef('public.chat_test_dispatch(uuid,text,jsonb)'::regprocedure);
  if position('admin_report_status' in v_definition)=0 then
    v_definition := replace(v_definition,
      $old$if p_action not in ('profile','history','send','block','unblock','report','admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban') then$old$,
      $new$if p_action not in ('profile','history','send','block','unblock','report','admin_status','admin_profiles','admin_test_mode','admin_grant','admin_nickname','admin_avatar','admin_messages','admin_remove','admin_restore','admin_ban','admin_unban','admin_report_status') then$new$);
    v_definition := replace(v_definition,
      $old$insert into chat_test.audit(admin_id,action,target) values(p_uid,p_action,'settings');return '{"success":true}';$old$,
      $new$insert into chat_test.audit(admin_id,action,target,details)
    values(p_uid,p_action,'settings',nullif(left(btrim(p_args->>'reason'),500),''));return '{"success":true}';$new$);
    v_definition := replace(v_definition,
      $old$jsonb_build_object('reason',r.reason,'details',r.details,'created_at',r.created_at)$old$,
      $new$jsonb_build_object('reason',r.reason,'details',r.details,'status',r.status,'created_at',r.created_at)$new$);
    v_definition := replace(v_definition,
      $old$elsif p_action in ('admin_remove','admin_restore') then
   update chat_test.messages set removed=p_action='admin_remove' where id=(p_args->>'id')::bigint;$old$,
      $new$elsif p_action='admin_report_status' then
   v_id=(p_args->>'message_id')::bigint;
   v_target=(p_args->>'reporter_id')::uuid;
   if p_args->>'status' not in ('new','reviewed','resolved','dismissed') then raise exception 'Nepoznat status prijave.'; end if;
   update chat_test.reports set status=p_args->>'status'
    where message_id=v_id and user_id=v_target;
   if not found then raise exception 'Prijava nije pronađena.'; end if;
   insert into chat_test.audit(admin_id,action,target,details)
    values(p_uid,'report_status','report:'||v_id::text||':'||v_target::text,
      'Status: '||(p_args->>'status')||coalesce(' · Razlog: '||nullif(left(btrim(p_args->>'reason'),500),''),''));
   return '{"success":true}';
  elsif p_action in ('admin_remove','admin_restore') then
   update chat_test.messages set removed=p_action='admin_remove' where id=(p_args->>'id')::bigint;$new$);
    v_definition := replace(v_definition,
      $old$insert into chat_test.audit(admin_id,action,target) values(p_uid,p_action,p_args->>'target');$old$,
      $new$insert into chat_test.audit(admin_id,action,target,details)
   values(p_uid,p_action,p_args->>'target',nullif(left(btrim(p_args->>'reason'),500),''));$new$);
    v_definition := replace(v_definition,
      $old$insert into chat_test.audit(admin_id,action,target) values(p_uid,p_action,coalesce(p_args->>'id',p_args->>'target',''));$old$,
      $new$insert into chat_test.audit(admin_id,action,target,details)
   values(p_uid,p_action,coalesce(p_args->>'id',p_args->>'target',''),nullif(left(btrim(p_args->>'reason'),500),''));$new$);
    if position('r.status' in v_definition)=0 or position('chat_test.audit(admin_id,action,target,details)' in v_definition)=0 then
      raise exception 'Chat dispatcher nije bezbjedno ažuriran.';
    end if;
    execute v_definition;
  end if;
end
$migration$;
