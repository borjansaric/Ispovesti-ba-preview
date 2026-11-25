-- Preview only: FIFO confession publishing every 20 minutes, 09:00–23:20 Europe/Sarajevo.
-- Remove the previously approved-for-removal link ban from Preview submissions.
CREATE OR REPLACE FUNCTION public.community_test_dispatch_base(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_id bigint; v_parent bigint; v_conf bigint; v_kind text; v_body text; v_nick text;
 v_row community_test.content; v_vote community_test.votes;
 v_result jsonb; v_ids jsonb; v_entry jsonb; v_duplicate boolean; v_value smallint; v_gate jsonb;
 v_offset integer := greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
 v_now timestamptz := clock_timestamp();
begin
 -- Caller must be service_role. Identity is verified by gateway, never accepted from body.
 if current_user not in ('service_role','postgres') then raise exception 'Zabranjeno.' using errcode='42501'; end if;
 if p_action='feed' then
  select coalesce(jsonb_agg(to_jsonb(x)-'rank'), '[]') into v_result from (
   select c.id::text id,c.body,c.nickname,c.published_at,
    (select count(*) from community_test.votes v where v.content_id=c.id) rank
   from community_test.content c where c.kind='confession' and c.state='published'
   order by
    case when p_args->>'sort'='popular' then (select count(*) from community_test.votes v where v.content_id=c.id) end desc,
    case when p_args->>'sort'='new' then c.published_at end desc,
    c.published_at asc,c.id asc limit 20 offset v_offset
  ) x;
  return jsonb_build_object('items',v_result);
 end if;
 if p_action='confession' then
  v_id=(p_args->>'id')::bigint;
  if not community_test.visible(v_id) then raise exception 'Sadržaj nije dostupan.'; end if;
  select jsonb_build_object('id',c.id::text,'body',c.body,'nickname',c.nickname,'published_at',c.published_at) into v_result from community_test.content c where c.id=v_id and c.kind='confession';
  if v_result is null then raise exception 'Ispovijest nije dostupna.'; end if;
  return jsonb_build_object('item',v_result);
 end if;
 if p_action='comments' then
  v_conf=(p_args->>'confession_id')::bigint; v_parent=(p_args->>'parent_id')::bigint;
  if not community_test.visible(v_conf) then raise exception 'Sadržaj nije dostupan.'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
   select c.id::text id,c.body,c.nickname,c.created_at,c.parent_id::text parent_id,
    exists(select 1 from community_test.content r where r.parent_id=c.id and r.state='published') has_replies
   from community_test.content c where c.confession_id=v_conf and c.parent_id is not distinct from v_parent
    and community_test.visible(c.id) order by c.created_at,c.id limit 20 offset v_offset
  ) x;
  return jsonb_build_object('items',v_result);
 end if;
 if p_uid is null then raise exception 'Potrebna je anonimna sesija.' using errcode='28000'; end if;
 if p_action in ('submit','vote','admin_remove') then perform pg_advisory_xact_lock(73142011); end if;
 if p_action like 'admin_%' then
  if not exists(select 1 from auth.sessions where id=(p_args->>'_session_id')::uuid and user_id=p_uid and (not_after is null or not_after>clock_timestamp())) then raise exception 'Administratorska sesija je istekla.' using errcode='42501'; end if;
  if not exists(select 1 from community_test.admins where user_id=p_uid) then raise exception 'Zabranjeno.' using errcode='42501'; end if;
  if p_action='admin_list' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,
      (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at)),'[]') from community_test.reports r where r.content_id=c.id) reports
    from community_test.content c where
     (p_args->>'view'='queue' and c.state='queued') or
     (p_args->>'view'='archive' and c.state='removed') or
     (p_args->>'view'='published' and c.state='published') or
     (p_args->>'view'='reports' and exists(select 1 from community_test.reports r where r.content_id=c.id))
    order by c.created_at,c.id limit 50 offset v_offset
   ) x;
   return jsonb_build_object('items',v_result);
  elsif p_action='admin_remove' then
   v_id=(p_args->>'id')::bigint;
   update community_test.content set state='removed',removed_at=v_now where id=v_id;
   if not found then raise exception 'Sadržaj nije dostupan.'; end if;
   insert into community_test.audit_log(admin_id,content_id,action) values(p_uid,v_id,'remove');
   return '{"success":true}';
  elsif p_action='admin_publisher' then
   -- No manual bulk publishing or reordering: only pause/resume FIFO scheduler.
   update community_test.publisher set paused=(p_args->>'paused')::boolean where singleton;
   return '{"success":true}';
  end if;
  raise exception 'Nepoznata administratorska radnja.';
 end if;
 if p_action='submit' then
  v_gate := public.community_test_submit_check(p_uid,'check','{}'::jsonb);
  if coalesce((v_gate->>'enabled')::boolean,false) and (
    coalesce((v_gate->>'configured')::boolean,false)=false
    or coalesce((v_gate->>'verified')::boolean,false)=false
  ) then
    raise exception 'Prvo završi sigurnosnu provjeru pri ulasku u aplikaciju.' using errcode='42501';
  end if;
  v_kind=p_args->>'kind'; v_body=community_test.trim_text(p_args->>'body'); v_nick=nullif(community_test.trim_text(p_args->>'nickname'),'');
  if v_kind is null or v_kind not in ('confession','comment','reply') or v_body is null or char_length(v_body)<(case when v_kind='confession' then 15 else 1 end)
   or char_length(v_body)>(case when v_kind='confession' then 5000 else 1000 end)
   or char_length(v_nick)>40 then raise exception 'Tekst nije dozvoljene dužine.'; end if;
  select exists(
    select 1 from community_test.content
    where author_id=p_uid
      and body=v_body
      and kind=v_kind
      and (v_kind='confession' or confession_id=(p_args->>'confession_id')::bigint)
  ) into v_duplicate;
  if v_duplicate and coalesce((p_args->>'allow_duplicate')::boolean,false)=false then return '{"duplicate":true}'; end if;
  if v_kind<>'confession' then
   v_conf=(p_args->>'confession_id')::bigint;
   select * into v_row from community_test.content where id=v_conf;
   if v_row.kind is distinct from 'confession' or not community_test.visible(v_conf) then raise exception 'Ispovijest nije dostupna.'; end if;
   if v_kind='reply' then
    v_parent=(p_args->>'parent_id')::bigint;
    select * into v_row from community_test.content where id=v_parent;
    if v_row.kind is distinct from 'comment' or v_row.confession_id is distinct from v_conf or not community_test.visible(v_parent) then raise exception 'Odgovarati možeš samo na glavni komentar.'; end if;
   end if;
  end if;
  insert into community_test.content(kind,author_id,body,nickname,confession_id,parent_id,state,published_at)
  values(v_kind,p_uid,v_body,v_nick,v_conf,v_parent,case when v_kind='confession' then 'queued' else 'published' end,case when v_kind<>'confession' then v_now end) returning id into v_id;
  perform community_test.rate(p_uid,'submit_'||v_kind,case when v_kind='confession' then 3 else 6 end);
  return jsonb_build_object('success',true,'id',v_id::text);
 end if;
 if p_action='cards' then
  v_ids=p_args->'ids';
  if jsonb_typeof(v_ids) is distinct from 'array' or jsonb_array_length(v_ids)>20 then raise exception 'Neispravna lista.'; end if;
  v_result='{}';
  for v_entry in select * from jsonb_array_elements(v_ids) loop
   v_id=(v_entry#>>'{}')::bigint;
   if community_test.visible(v_id) then
    v_result=v_result||jsonb_build_object(v_id::text,jsonb_build_object(
      'vote',public.community_test_dispatch(p_uid,'vote_status',jsonb_build_object('id',v_id::text)),
      'context',public.community_test_dispatch(p_uid,'context',jsonb_build_object('id',v_id::text))));
   end if;
  end loop;
  return v_result;
 end if;
 if p_action='list' then
  v_kind=p_args->>'list';
  if v_kind='my_comments' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.confession_id::text confession_id,c.body,c.nickname,c.created_at from community_test.content c
    where c.author_id=p_uid and c.kind<>'confession' and community_test.visible(c.id)
    order by c.created_at desc,c.id desc limit 20 offset v_offset) x;
  elsif v_kind in ('favorites','recently_read') then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (
    select c.id::text id,c.body,c.nickname,c.published_at from community_test.lists l join community_test.content c on c.id=l.content_id
    where l.user_id=p_uid and l.kind=v_kind and community_test.visible(c.id)
    order by l.touched_at desc,c.id desc limit 20 offset v_offset) x;
  else raise exception 'Nepoznata lista.'; end if;
  return jsonb_build_object('items',v_result);
 end if;
 v_id=(p_args->>'id')::bigint;
 if not coalesce(community_test.visible(v_id),false) then raise exception 'Sadržaj nije dostupan.'; end if;
 if p_action='vote' or p_action='vote_status' then
  if p_action='vote' then
   perform community_test.rate(p_uid,'vote',120);
   v_value=(p_args->>'value')::smallint;
   if v_value is null or v_value not in (-1,1) then raise exception 'Neispravan glas.'; end if;
   insert into community_test.votes(content_id,user_id,value) values(v_id,p_uid,v_value)
   on conflict(content_id,user_id) do update set value=excluded.value
   where clock_timestamp() < community_test.votes.first_voted_at + interval '10 minutes';
  end if;
  select * into v_vote from community_test.votes where content_id=v_id and user_id=p_uid;
  v_result=jsonb_build_object('my_vote',v_vote.value,'can_change',case when v_vote.user_id is null then true else not v_vote.change_used and clock_timestamp()<v_vote.first_voted_at+interval '10 minutes' end);
  if v_vote.first_voted_at + interval '10 minutes' <= clock_timestamp() then
   select v_result||jsonb_build_object('likes',count(*) filter(where value=1),'dislikes',count(*) filter(where value=-1)) into v_result from community_test.votes where content_id=v_id;
  end if;
  return v_result;
 elsif p_action='context' then
  select case when exists(select 1 from community_test.content where author_id=p_uid and confession_id=v_id) then
    (select count(*) from community_test.content c where c.confession_id=v_id and community_test.visible(c.id)) end into v_conf;
  return jsonb_build_object('comment_count',v_conf,'favorite',exists(select 1 from community_test.lists where user_id=p_uid and kind='favorites' and content_id=v_id));
 elsif p_action='favorite' or p_action='read' then
  select * into v_row from community_test.content where id=v_id;
  if v_row.kind<>'confession' then raise exception 'Očekivana je ispovijest.'; end if;
  perform community_test.rate(p_uid,'lists',240);
  v_kind=case when p_action='read' then 'recently_read' else 'favorites' end;
  if p_action='favorite' and (p_args->>'enabled')::boolean=false then
   delete from community_test.lists where user_id=p_uid and kind=v_kind and content_id=v_id;
  else
   insert into community_test.lists values(p_uid,v_kind,v_id,v_now) on conflict(user_id,kind,content_id) do update set touched_at=excluded.touched_at;
   if v_kind='recently_read' then
    delete from community_test.lists where user_id=p_uid and kind=v_kind and content_id in
     (select content_id from community_test.lists where user_id=p_uid and kind=v_kind order by touched_at desc,content_id desc offset 100);
   end if;
  end if;
  return '{"success":true}';
 elsif p_action='report' then
  if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','spam','other') then raise exception 'Neispravan razlog prijave.'; end if;
  perform community_test.rate(p_uid,'reports',20);
  insert into community_test.reports(content_id,user_id,reason) values(v_id,p_uid,p_args->>'reason') on conflict do nothing;
  return '{"success":true}';
 end if;
 raise exception 'Nepoznata radnja.';
end $function$
;

CREATE OR REPLACE FUNCTION community_test.publish_one()
RETURNS bigint
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  p community_test.publisher;
  v_id bigint;
  v_now timestamptz := clock_timestamp();
  v_local timestamp;
  v_hour integer;
  v_minute integer;
  v_slot_start timestamp;
BEGIN
  SELECT * INTO p FROM community_test.publisher WHERE singleton FOR UPDATE;
  IF NOT FOUND OR p.paused THEN RETURN NULL; END IF;

  v_local := v_now AT TIME ZONE 'Europe/Sarajevo';
  v_hour := EXTRACT(HOUR FROM v_local)::integer;
  v_minute := EXTRACT(MINUTE FROM v_local)::integer;

  IF v_hour < 9 OR v_hour > 23
     OR v_minute NOT IN (0, 20, 40)
     OR (v_hour = 23 AND v_minute = 40) THEN
    RETURN NULL;
  END IF;

  v_slot_start := date_trunc('hour', v_local)
    + make_interval(mins => (v_minute / 20) * 20);

  IF p.last_published_at IS NOT NULL
     AND (p.last_published_at AT TIME ZONE 'Europe/Sarajevo') >= v_slot_start
     AND (p.last_published_at AT TIME ZONE 'Europe/Sarajevo') < v_slot_start + interval '20 minutes' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM community_test.content
  WHERE state = 'queued' AND kind = 'confession'
  ORDER BY created_at, id
  LIMIT 1 FOR UPDATE;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  UPDATE community_test.content
  SET state = 'published', published_at = v_now
  WHERE id = v_id;

  UPDATE community_test.publisher
  SET last_published_at = v_now
  WHERE singleton;

  RETURN v_id;
END
$function$;

DO $block$
DECLARE v_job record;
BEGIN
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname = 'community-test-publish-hourly'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'community-test-publish-20min',
    '* * * * *',
    'select community_test.publish_one();'
  );
END
$block$;

COMMENT ON FUNCTION community_test.publish_one() IS
'Preview scheduler: at most one queued confession per Sarajevo-local slot (:00, :20, :40), 09:00–23:20, FIFO by created_at,id.';
