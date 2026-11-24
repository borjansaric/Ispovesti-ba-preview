-- Require a valid request_id for every community submission in the isolated test schema.
-- The existing (user_id, request_id) primary key and receipt lookup make retries idempotent.
-- This migration changes only community_test submission dispatch; live/production dispatch is untouched.

CREATE OR REPLACE FUNCTION public.community_test_dispatch(p_uid uuid, p_action text, p_args jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_item jsonb;
  v_result jsonb;
  v_id bigint;
  v_state text;
  v_previous text;
  v_kind text;
  v_at timestamptz;
  v_offset integer;
  v_request uuid;
  v_payload jsonb;
  v_receipt community_test.submission_receipts%rowtype;
BEGIN
  IF current_user NOT IN ('service_role','postgres') THEN
    RAISE EXCEPTION 'Zabranjeno.' USING errcode='42501';
  END IF;

  IF p_action='feed' THEN
    RETURN community_test.feed_sorted(p_args);
  END IF;

  IF p_action LIKE 'admin_%' THEN
    PERFORM community_test.assert_admin(p_uid,p_args->>'_session_id');
    IF p_action='admin_session' THEN
      RETURN '{"admin":true}';
    END IF;
    PERFORM community_test.assert_admin_access(p_uid,p_args->>'_session_id',p_args->>'_aal');
    IF p_action='admin_remove' THEN
      PERFORM pg_advisory_xact_lock(73142011);
      v_id=(p_args->>'id')::bigint;
      SELECT state INTO v_state FROM community_test.content WHERE id=v_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Sadržaj nije dostupan.'; END IF;
      IF v_state='removed' THEN RETURN '{"success":true}'; END IF;
      v_result=public.community_test_dispatch_base(p_uid,p_action,p_args);
      UPDATE community_test.content SET removal_previous_state=v_state WHERE id=v_id;
      RETURN v_result;
    ELSIF p_action='admin_restore' THEN
      PERFORM pg_advisory_xact_lock(73142011);
      v_id=(p_args->>'id')::bigint;
      SELECT state,removal_previous_state,kind,published_at
        INTO v_state,v_previous,v_kind,v_at
      FROM community_test.content WHERE id=v_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Sadržaj nije dostupan.'; END IF;
      IF v_state<>'removed' THEN RETURN '{"success":true}'; END IF;
      v_previous=coalesce(v_previous,CASE WHEN v_kind='confession' AND v_at IS NULL THEN 'queued' ELSE 'published' END);
      UPDATE community_test.content
      SET state=v_previous,removed_at=NULL,removal_previous_state=NULL
      WHERE id=v_id;
      INSERT INTO community_test.audit_log(admin_id,content_id,action)
      VALUES(p_uid,v_id,'restore');
      RETURN jsonb_build_object('success',true,'state',v_previous,'visible',community_test.visible(v_id));
    ELSIF p_action='admin_list' THEN
      v_offset=greatest(0,least(coalesce((p_args->>'offset')::integer,0),1000000));
      IF p_args->>'view' NOT IN ('queue','archive','published','reports') THEN
        RAISE EXCEPTION 'Nepoznat pregled.';
      END IF;
      SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO v_result
      FROM (
        SELECT
          c.id::text id,c.kind,c.body,c.nickname,c.state,c.created_at,c.removed_at,
          c.parent_id::text parent_id,c.confession_id::text confession_id,
          community_test.visible(c.id) AS publicly_visible,
          (SELECT coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'created_at',r.created_at) ORDER BY r.created_at),'[]'::jsonb)
           FROM community_test.reports r WHERE r.content_id=c.id) reports
        FROM community_test.content c
        WHERE
          (p_args->>'view'='queue' AND c.state='queued') OR
          (p_args->>'view'='archive' AND (c.state='removed' OR (c.state='published' AND NOT community_test.visible(c.id)))) OR
          (p_args->>'view'='published' AND community_test.visible(c.id)) OR
          (p_args->>'view'='reports' AND EXISTS(SELECT 1 FROM community_test.reports r WHERE r.content_id=c.id))
        ORDER BY c.created_at,c.id
        LIMIT 50 OFFSET v_offset
      ) x;
      RETURN jsonb_build_object('items',v_result);
    END IF;
  END IF;

  IF p_action IN ('reaction','reaction_status') THEN
    RETURN community_test.content_reaction(p_uid,p_action,p_args);
  END IF;

  IF p_action='daily_highlights' THEN
    RETURN community_test.daily_highlights(p_args->>'kind');
  END IF;

  IF p_action IN ('vote','vote_status') THEN
    v_result=public.community_test_dispatch_base(p_uid,p_action,p_args);
    SELECT v_result||jsonb_build_object(
      'likes',count(*) FILTER(WHERE value=1),
      'dislikes',count(*) FILTER(WHERE value=-1)
    ) INTO v_result
    FROM community_test.votes
    WHERE content_id=(p_args->>'id')::bigint;
    RETURN v_result;
  END IF;

  IF p_action='submit' THEN
    IF p_uid IS NULL THEN
      RAISE EXCEPTION 'Potrebna je anonimna sesija.' USING errcode='28000';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_uid::text,73142012));
    IF coalesce(p_args->>'request_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Nedostaje ili je neispravan ID zahtjeva za slanje.' USING errcode='22023';
    END IF;
    v_request=(p_args->>'request_id')::uuid;
    v_payload=p_args-'request_id'-'captcha_token';
    IF v_request IS NOT NULL THEN
      SELECT * INTO v_receipt
      FROM community_test.submission_receipts
      WHERE user_id=p_uid AND request_id=v_request;
      IF FOUND THEN
        IF v_receipt.payload<>v_payload THEN
          RAISE EXCEPTION 'Zahtjev za slanje je promijenjen. Pokušaj ponovo.';
        END IF;
        IF v_receipt.result ? 'item'
          AND NOT community_test.visible((v_receipt.result->>'id')::bigint) THEN
          RAISE EXCEPTION 'Sadržaj više nije dostupan.';
        END IF;
        v_result=v_receipt.result||jsonb_build_object('replayed',true);
        IF v_result ? 'context' THEN
          v_result=v_result||jsonb_build_object(
            'context',
            public.community_test_dispatch_base(
              p_uid,'context',jsonb_build_object('id',p_args->>'confession_id')
            )
          );
        END IF;
        RETURN v_result;
      END IF;
    END IF;
    v_result=public.community_test_dispatch_base(p_uid,p_action,p_args);
    IF (v_result->>'success')::boolean IS TRUE
      AND p_args->>'kind' IN ('comment','reply') THEN
      SELECT jsonb_build_object(
        'id',c.id::text,'body',c.body,'nickname',c.nickname,
        'created_at',c.created_at,'parent_id',c.parent_id::text,'has_replies',false
      ) INTO v_item
      FROM community_test.content c
      WHERE c.id=(v_result->>'id')::bigint
        AND c.author_id=p_uid
        AND c.state='published'
        AND community_test.visible(c.id);
      IF v_item IS NOT NULL THEN
        v_result=v_result||jsonb_build_object(
          'item',v_item,
          'context',public.community_test_dispatch_base(
            p_uid,'context',jsonb_build_object('id',p_args->>'confession_id')
          )
        );
      END IF;
    END IF;
    IF v_request IS NOT NULL AND (v_result->>'success')::boolean IS TRUE THEN
      INSERT INTO community_test.submission_receipts(user_id,request_id,payload,result)
      VALUES(p_uid,v_request,v_payload,v_result);
    END IF;
    RETURN v_result;
  END IF;

  RETURN public.community_test_dispatch_base(p_uid,p_action,p_args);
END
$function$
