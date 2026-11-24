-- Match anonymous chat reports to the confession-report experience.
-- This migration is deliberately limited to the preview/test schemas.

alter table chat_test.reports
  add column if not exists details text;

update chat_test.reports
set reason='hate_speech'
where reason in ('abuse','threat');

alter table chat_test.reports
  drop constraint if exists reports_reason_check;

alter table chat_test.reports
  add constraint reports_reason_check
  check (reason in ('hate_speech','spam','other'));

alter table chat_test.reports
  add constraint reports_details_length_check
  check (details is null or char_length(details)<=500);

do $migration$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.chat_test_dispatch(uuid,text,jsonb)'::regprocedure);

  v_definition := replace(
    v_definition,
    $old$declare
 v_profile chat_test.profiles;$old$,
    $new$declare
 v_inserted integer;
 v_details text;
 v_profile chat_test.profiles;$new$
  );

  v_definition := replace(
    v_definition,
    $old$if p_args->>'reason' is null or p_args->>'reason' not in ('abuse','threat','spam','other') then raise exception 'Neispravan razlog prijave.';end if;$old$,
    $new$if p_args->>'reason' is null or p_args->>'reason' not in ('hate_speech','spam','other') then raise exception 'Neispravan razlog prijave.';end if;
  if p_args->>'details' is not null and char_length(btrim(p_args->>'details'))>500 then raise exception 'Opis prijave može imati najviše 500 znakova.';end if;
  v_details=nullif(btrim(p_args->>'details'),'');$new$
  );

  v_definition := replace(
    v_definition,
    $old$insert into chat_test.reports(message_id,user_id,reason) values(v_id,p_uid,p_args->>'reason') on conflict do nothing;return '{"success":true}';$old$,
    $new$insert into chat_test.reports(message_id,user_id,reason,details)
  values(v_id,p_uid,p_args->>'reason',v_details)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('success',true,'already_reported',v_inserted=0);$new$
  );

  v_definition := replace(
    v_definition,
    $old$jsonb_build_object('reason',r.reason,'created_at',r.created_at)$old$,
    $new$jsonb_build_object('reason',r.reason,'details',r.details,'created_at',r.created_at)$new$
  );

  if position('v_inserted integer' in v_definition)=0
     or position('already_reported' in v_definition)=0
     or position('details',r.details' in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno ažurirati chat_test_dispatch; očekivani dijelovi nisu pronađeni.';
  end if;

  execute v_definition;

  v_definition := pg_get_functiondef('public.community_test_admin_read(uuid,text,jsonb)'::regprocedure);

  v_definition := replace(
    v_definition,
    $old$r.created_at reported_at,r.user_id::text reporter_id
        from community_test.reports r$old$,
    $new$r.created_at reported_at,r.user_id::text reporter_id,NULL::text details
        from community_test.reports r$new$
  );

  v_definition := replace(
    v_definition,
    $old$r.created_at reported_at,r.user_id::text reporter_id
        from chat_test.reports r$old$,
    $new$r.created_at reported_at,r.user_id::text reporter_id,r.details
        from chat_test.reports r$new$
  );

  if position('NULL::text details' in v_definition)=0
     or position('r.details' in v_definition)=0 then
    raise exception 'Nije moguće bezbjedno ažurirati administratorski pregled prijava.';
  end if;

  execute v_definition;
end
$migration$;
