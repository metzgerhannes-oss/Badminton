-- v90: A published tournament MUST be authorized for its specific DBV player.
-- Target: yadexibmjmnjfmfabrug only. Public DBV verification is not ownership.
-- An administrator/club must verify guardian/player authority out of band,
-- then provision a grant using a trusted server/admin connection.
BEGIN;

CREATE TABLE IF NOT EXISTS public.player_publication_grants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_dbv_id text NOT NULL REFERENCES public.players(dbv_id) ON DELETE CASCADE,
  verification_method text NOT NULL CHECK
    (verification_method IN ('guardian_review','club_review','adult_player_review')),
  reviewed_by text NOT NULL CHECK (length(btrim(reviewed_by)) BETWEEN 3 AND 120),
  verified_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id,player_dbv_id)
);

-- This table is NOT a self-service ownership-claim endpoint.
ALTER TABLE public.player_publication_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_publication_grants FROM PUBLIC, anon, authenticated;
-- Users can check their own authorization without seeing review metadata.
GRANT SELECT (user_id,player_dbv_id,verified_at,revoked_at)
  ON public.player_publication_grants TO authenticated;
DROP POLICY IF EXISTS "Users can view only their own publication grants"
  ON public.player_publication_grants;
CREATE POLICY "Users can view only their own publication grants"
  ON public.player_publication_grants
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- RESTRICTIVE is vital: the existing 'Users add own tournament links'
-- permissive rule alone must never make a share publicly writable.
DROP POLICY IF EXISTS "Only verified managers can publish on insert"
  ON public.user_tournament_links;
CREATE POLICY "Only verified managers can publish on insert"
 ON public.user_tournament_links AS RESTRICTIVE
 FOR INSERT TO authenticated
 WITH CHECK (
   NOT is_shared OR EXISTS (
     SELECT 1 FROM public.player_publication_grants g
     WHERE g.user_id = (SELECT auth.uid())
       AND g.user_id = user_tournament_links.user_id
       AND g.player_dbv_id = user_tournament_links.player_dbv_id
       AND g.verified_at IS NOT NULL AND g.revoked_at IS NULL
   )
 );
DROP POLICY IF EXISTS "Only verified managers can publish on update"
  ON public.user_tournament_links;
CREATE POLICY "Only verified managers can publish on update"
 ON public.user_tournament_links AS RESTRICTIVE
 FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid()))
 WITH CHECK (
   NOT is_shared OR EXISTS (
     SELECT 1 FROM public.player_publication_grants g
     WHERE g.user_id = (SELECT auth.uid())
       AND g.user_id = user_tournament_links.user_id
       AND g.player_dbv_id = user_tournament_links.player_dbv_id
       AND g.verified_at IS NOT NULL AND g.revoked_at IS NULL
   )
 );

-- Only approved publishers may populate the public, owner-free projection.
CREATE OR REPLACE FUNCTION private.refresh_shared_tournament_hint_v88(
  _player text, _tournament uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $BODY$
BEGIN
  IF _player IS NULL OR _tournament IS NULL THEN RETURN; END IF;
  INSERT INTO public.shared_tournament_hints(
    player_dbv_id,external_tournament_id,title,start_date,end_date,updated_at,shared_at)
  SELECT u.player_dbv_id,u.external_tournament_id,u.title,u.start_date,u.end_date,
         u.updated_at,u.shared_at
  FROM public.user_tournament_links u
  JOIN public.players p ON p.dbv_id=u.player_dbv_id
  JOIN public.player_publication_grants g
    ON g.user_id=u.user_id AND g.player_dbv_id=u.player_dbv_id
      AND g.verified_at IS NOT NULL AND g.revoked_at IS NULL
  WHERE u.player_dbv_id=_player AND u.external_tournament_id=_tournament
    AND u.is_shared AND p.verified_at IS NOT NULL
    AND (u.end_date >= CURRENT_DATE - 60 OR
      (u.end_date IS NULL AND u.start_date >= CURRENT_DATE - 60) OR
      (u.end_date IS NULL AND u.start_date IS NULL AND u.shared_at >= now() - interval '90 days'))
  ORDER BY u.updated_at DESC,u.id DESC LIMIT 1
  ON CONFLICT (player_dbv_id,external_tournament_id)
  DO UPDATE SET title=EXCLUDED.title,start_date=EXCLUDED.start_date,
    end_date=EXCLUDED.end_date,updated_at=EXCLUDED.updated_at,
    shared_at=EXCLUDED.shared_at;
  IF NOT FOUND THEN
    DELETE FROM public.shared_tournament_hints h
      WHERE h.player_dbv_id=_player AND h.external_tournament_id=_tournament;
  END IF;
END;
$BODY$;
REVOKE ALL ON FUNCTION private.refresh_shared_tournament_hint_v88(text,uuid)
 FROM PUBLIC,anon,authenticated;

-- Revoking an approval must remove its hints immediately; if another
-- independently approved owner still shares that event, retain their hint.
CREATE OR REPLACE FUNCTION private.after_player_publication_grant_change_v90()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $BODY$
DECLARE item record;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    FOR item IN
      SELECT DISTINCT u.player_dbv_id,u.external_tournament_id
        FROM public.user_tournament_links u
       WHERE u.user_id=OLD.user_id AND u.player_dbv_id=OLD.player_dbv_id
    LOOP
      PERFORM private.refresh_shared_tournament_hint_v88(
        item.player_dbv_id,item.external_tournament_id);
    END LOOP;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    FOR item IN
      SELECT DISTINCT u.player_dbv_id,u.external_tournament_id
        FROM public.user_tournament_links u
       WHERE u.user_id=NEW.user_id AND u.player_dbv_id=NEW.player_dbv_id
    LOOP
      PERFORM private.refresh_shared_tournament_hint_v88(
        item.player_dbv_id,item.external_tournament_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$BODY$;
REVOKE ALL ON FUNCTION private.after_player_publication_grant_change_v90()
 FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS refresh_shared_tournament_on_grant_change_v90
 ON public.player_publication_grants;
CREATE TRIGGER refresh_shared_tournament_on_grant_change_v90
 AFTER INSERT OR UPDATE OR DELETE ON public.player_publication_grants
 FOR EACH ROW EXECUTE FUNCTION private.after_player_publication_grant_change_v90();

-- Purge any previously displayed hints no longer backed by an active grant.
DELETE FROM public.shared_tournament_hints h WHERE NOT EXISTS (
  SELECT 1 FROM public.user_tournament_links u
  JOIN public.players p ON p.dbv_id=u.player_dbv_id
  JOIN public.player_publication_grants g
    ON g.user_id=u.user_id AND g.player_dbv_id=u.player_dbv_id
       AND g.verified_at IS NOT NULL AND g.revoked_at IS NULL
  WHERE h.player_dbv_id=u.player_dbv_id
    AND h.external_tournament_id=u.external_tournament_id
    AND u.is_shared AND p.verified_at IS NOT NULL
    AND (u.end_date >= CURRENT_DATE - 60 OR
      (u.end_date IS NULL AND u.start_date >= CURRENT_DATE - 60) OR
      (u.end_date IS NULL AND u.start_date IS NULL AND u.shared_at >= now() - interval '90 days'))
);
COMMIT;
