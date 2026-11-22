CREATE TABLE community_test.reply_notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_uid uuid NOT NULL,
  reply_id bigint NOT NULL,
  comment_id bigint NOT NULL,
  confession_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at timestamptz,
  CONSTRAINT reply_notifications_recipient_reply_key UNIQUE (recipient_uid, reply_id)
);

CREATE INDEX reply_notifications_recipient_created_idx
  ON community_test.reply_notifications (recipient_uid, created_at DESC, id DESC);

CREATE INDEX reply_notifications_unread_idx
  ON community_test.reply_notifications (recipient_uid, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE community_test.reply_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE community_test.reply_notifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE community_test.reply_notifications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE community_test.reply_notifications_id_seq TO service_role;

CREATE OR REPLACE FUNCTION community_test.notify_reply_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_recipient uuid;
  v_notification_id bigint;
BEGIN
  BEGIN
    IF NEW.kind <> 'reply' OR NEW.state <> 'published' OR NEW.author_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT c.author_id
      INTO v_recipient
    FROM community_test.content c
    WHERE c.id = NEW.parent_id
      AND c.kind = 'comment'
      AND community_test.visible(c.id);

    IF v_recipient IS NULL OR v_recipient = NEW.author_id THEN
      RETURN NEW;
    END IF;

    DELETE FROM community_test.reply_notifications
    WHERE created_at < clock_timestamp() - interval '30 days';

    INSERT INTO community_test.reply_notifications
      (recipient_uid, reply_id, comment_id, confession_id, created_at)
    VALUES
      (v_recipient, NEW.id, NEW.parent_id, NEW.confession_id, coalesce(NEW.published_at, NEW.created_at))
    ON CONFLICT (recipient_uid, reply_id) DO NOTHING
    RETURNING id INTO v_notification_id;

    IF v_notification_id IS NOT NULL THEN
      BEGIN
        PERFORM realtime.send(
          jsonb_build_object('notification_id', v_notification_id::text),
          'reply_notification',
          'notifications:' || v_recipient::text,
          true
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Reply notification broadcast failed (%).', SQLSTATE;
      END;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Reply notification creation failed (%).', SQLSTATE;
  END;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION community_test.notify_reply_author() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION community_test.notify_reply_author() TO service_role;

DROP TRIGGER IF EXISTS content_reply_notification_after_insert ON community_test.content;
CREATE TRIGGER content_reply_notification_after_insert
AFTER INSERT ON community_test.content
FOR EACH ROW
WHEN (NEW.kind = 'reply' AND NEW.state = 'published')
EXECUTE FUNCTION community_test.notify_reply_author();

CREATE OR REPLACE FUNCTION public.community_test_notifications(
  p_uid uuid,
  p_action text,
  p_args jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_items jsonb;
  v_unread bigint;
  v_id bigint;
  v_updated integer;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Zabranjen pristup.' USING errcode = '42501';
  END IF;

  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'Potrebna je anonimna sesija.' USING errcode = '28000';
  END IF;

  IF p_action = 'list' THEN
    DELETE FROM community_test.reply_notifications
    WHERE created_at < clock_timestamp() - interval '30 days';

    SELECT count(*)
      INTO v_unread
    FROM community_test.reply_notifications n
    WHERE n.recipient_uid = p_uid
      AND n.read_at IS NULL
      AND n.created_at >= clock_timestamp() - interval '30 days'
      AND community_test.visible(n.reply_id);

    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id::text,
          'reply_id', x.reply_id::text,
          'comment_id', x.comment_id::text,
          'confession_id', x.confession_id::text,
          'created_at', x.created_at,
          'read_at', x.read_at
        ) ORDER BY x.created_at DESC, x.id DESC
      ),
      '[]'::jsonb
    )
      INTO v_items
    FROM (
      SELECT n.id, n.reply_id, n.comment_id, n.confession_id, n.created_at, n.read_at
      FROM community_test.reply_notifications n
      WHERE n.recipient_uid = p_uid
        AND n.created_at >= clock_timestamp() - interval '30 days'
        AND community_test.visible(n.reply_id)
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 50
    ) x;

    RETURN jsonb_build_object(
      'items', v_items,
      'unread_count', v_unread,
      'retention_days', 30
    );

  ELSIF p_action = 'read' THEN
    IF coalesce(p_args->>'id', '') !~ '^[0-9]{1,18}$' THEN
      RAISE EXCEPTION 'Neispravno obavještenje.';
    END IF;
    v_id := (p_args->>'id')::bigint;

    UPDATE community_test.reply_notifications
    SET read_at = coalesce(read_at, clock_timestamp())
    WHERE id = v_id
      AND recipient_uid = p_uid;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'updated', v_updated);

  ELSIF p_action = 'read_all' THEN
    UPDATE community_test.reply_notifications
    SET read_at = clock_timestamp()
    WHERE recipient_uid = p_uid
      AND read_at IS NULL;

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'updated', v_updated);
  END IF;

  RAISE EXCEPTION 'Nepoznata radnja obavještenja.';
END;
$function$;

REVOKE ALL ON FUNCTION public.community_test_notifications(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_test_notifications(uuid, text, jsonb) TO service_role;

DROP POLICY IF EXISTS reply_notifications_receive_own ON realtime.messages;
CREATE POLICY reply_notifications_receive_own
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) = 'notifications:' || (SELECT auth.uid())::text
);

DO $schedule$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'community-test-reply-notifications-retention'
  ) THEN
    PERFORM cron.schedule(
      'community-test-reply-notifications-retention',
      '47 3 * * *',
      'DELETE FROM community_test.reply_notifications WHERE created_at < clock_timestamp() - interval ''30 days'';'
    );
  END IF;
END;
$schedule$;
