create table community_test.moderation_flags (
  content_id bigint primary key references community_test.content(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reasons text[] not null,
  status text not null default 'review' check (status in ('review','cleared','actioned')),
  created_at timestamptz not null default now(),
  constraint community_test_moderation_reasons_check check (
    cardinality(reasons) > 0 and reasons <@ array[
      'possible_threat','promotional_spam','possible_phone_number','excessive_caps','repeated_phrase'
    ]::text[]
  )
);
alter table community_test.moderation_flags enable row level security;
revoke all on community_test.moderation_flags from public, anon, authenticated;
grant select, insert, update, delete on community_test.moderation_flags to service_role;

create or replace function public.community_test_moderation_flag(
  p_uid uuid, p_action text, p_args jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_id bigint;
  v_reasons text[];
begin
  if current_user <> 'service_role' or p_uid is null or p_action <> 'flag' then
    raise exception 'Zabranjen pristup.' using errcode='42501';
  end if;
  v_id := (p_args->>'content_id')::bigint;
  if v_id is null then raise exception 'Nedostaje ID sadržaja.'; end if;
  if jsonb_typeof(p_args->'reasons') <> 'array' then
    raise exception 'Neispravni razlozi moderacije.';
  end if;
  select array_agg(distinct value order by value)
    into v_reasons
  from jsonb_array_elements_text(p_args->'reasons') as x(value)
  where value in ('possible_threat','promotional_spam','possible_phone_number','excessive_caps','repeated_phrase');
  if coalesce(cardinality(v_reasons),0) = 0 then return jsonb_build_object('flagged',false); end if;
  if not exists (
    select 1 from community_test.content
    where id=v_id and author_id=p_uid and kind in ('confession','comment','reply')
  ) then
    raise exception 'Sadržaj nije dostupan za označavanje.';
  end if;
  insert into community_test.moderation_flags(content_id,user_id,reasons)
  values(v_id,p_uid,v_reasons)
  on conflict(content_id) do nothing;
  return jsonb_build_object('flagged',true);
end
$function$;
revoke all on function public.community_test_moderation_flag(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.community_test_moderation_flag(uuid,text,jsonb) to service_role;

create or replace function public.community_test_admin_moderation(
  p_uid uuid, p_action text, p_args jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $function$
declare v_result jsonb;
begin
  if current_user <> 'service_role' or p_uid is null or p_action <> 'admin_moderation' then
    raise exception 'Zabranjen pristup.' using errcode='42501';
  end if;
  perform community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb)
    into v_result
  from (
    select c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,
      jsonb_build_object('status',f.status,'reasons',to_jsonb(f.reasons),'created_at',f.created_at) moderation
    from community_test.moderation_flags f
    join community_test.content c on c.id=f.content_id
    where f.status='review'
    order by f.created_at desc,f.content_id desc
    limit 100
  ) x;
  return jsonb_build_object('items',v_result);
end
$function$;
revoke all on function public.community_test_admin_moderation(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.community_test_admin_moderation(uuid,text,jsonb) to service_role;
