-- v88: separate public projection from owners' private bookmark table.
-- No auth user ID, follow graph, or private profile data in public Data API.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.shared_tournament_hints(
  player_dbv_id text NOT NULL REFERENCES public.players(dbv_id),
  external_tournament_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 120),
  start_date date,
  end_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  shared_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(player_dbv_id, external_tournament_id)
);
CREATE INDEX IF NOT EXISTS shared_tournament_hints_date_idx
 ON public.shared_tournament_hints (start_date);
ALTER TABLE public.shared_tournament_hints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shared_tournament_hints FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shared_tournament_hints TO anon,authenticated;
DROP POLICY IF EXISTS "Public read community tournament hints" ON public.shared_tournament_hints;
CREATE POLICY "Public read community tournament hints"
 ON public.shared_tournament_hints FOR SELECT TO anon,authenticated USING (true);

-- Do not allow public reads from the owner-bound table, including the user_id
-- column exposed to Supabase Auth sessions under the old mixed SELECT policy.
DROP POLICY IF EXISTS "Public opt-in reported tournament hints"
 ON public.user_tournament_links;
REVOKE SELECT (player_dbv_id,external_tournament_id,title,start_date,
               end_date,updated_at,shared_at,is_shared)
 ON public.user_tournament_links FROM anon;
REVOKE SELECT ON public.user_tournament_links FROM anon;

-- Run only as trigger owner, never as a directly exposed RPC or PostgREST API.
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

CREATE OR REPLACE FUNCTION private.after_shared_tournament_change_v88()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $BODY$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM private.refresh_shared_tournament_hint_v88(
       OLD.player_dbv_id,OLD.external_tournament_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM private.refresh_shared_tournament_hint_v88(
       NEW.player_dbv_id,NEW.external_tournament_id);
  END IF;
  RETURN NULL;
END;
$BODY$;
REVOKE ALL ON FUNCTION private.after_shared_tournament_change_v88()
 FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS refresh_shared_tournament_hints_v88
 ON public.user_tournament_links;
CREATE TRIGGER refresh_shared_tournament_hints_v88
 AFTER INSERT OR UPDATE OR DELETE ON public.user_tournament_links
 FOR EACH ROW EXECUTE FUNCTION private.after_shared_tournament_change_v88();

-- Catch any pre-existing opt-ins without introducing family data into hints.
INSERT INTO public.shared_tournament_hints(
  player_dbv_id,external_tournament_id,title,start_date,end_date,updated_at,shared_at)
SELECT DISTINCT ON(u.player_dbv_id,u.external_tournament_id)
 u.player_dbv_id,u.external_tournament_id,u.title,u.start_date,u.end_date,
 u.updated_at,u.shared_at
FROM public.user_tournament_links u
JOIN public.players p ON p.dbv_id=u.player_dbv_id
WHERE u.is_shared AND p.verified_at IS NOT NULL AND
 (u.end_date >= CURRENT_DATE - 60 OR
  (u.end_date IS NULL AND u.start_date >= CURRENT_DATE - 60) OR
  (u.end_date IS NULL AND u.start_date IS NULL AND u.shared_at >= now()-interval '90 days'))
ORDER BY u.player_dbv_id,u.external_tournament_id,u.updated_at DESC,u.id DESC
ON CONFLICT(player_dbv_id,external_tournament_id) DO NOTHING;
COMMIT;
