-- v87: opt-in, user-reported DBV tournament sharing. Target project:
-- yadexibmjmnjfmfabrug (Badminton), NEVER JohannasGartenwelt.
-- Public read is for tournament metadata ONLY. User-submitted links DO NOT
-- assert official participation and MUST be labelled accordingly in the app.
BEGIN;
ALTER TABLE public.user_tournament_links
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_tournament_links
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;
ALTER TABLE public.user_tournament_links
  ADD CONSTRAINT user_tournament_links_share_requires_player
  CHECK (NOT is_shared OR (player_dbv_id IS NOT NULL AND shared_at IS NOT NULL));
ALTER TABLE public.user_tournament_links
  ADD CONSTRAINT user_tournament_links_share_title_bounds
  CHECK (length(btrim(title)) BETWEEN 3 AND 120 AND title !~ '[[:cntrl:]]');
ALTER TABLE public.user_tournament_links
  ADD CONSTRAINT user_tournament_links_share_date_bounds
  CHECK (start_date IS NULL OR (start_date BETWEEN DATE '2020-01-01' AND DATE '2040-12-31'));
ALTER TABLE public.user_tournament_links
  ADD CONSTRAINT user_tournament_links_share_end_valid
  CHECK (end_date IS NULL OR (start_date IS NOT NULL AND end_date >= start_date));
ALTER TABLE public.user_tournament_links
  ADD CONSTRAINT user_tournament_links_share_known_player
  FOREIGN KEY (player_dbv_id) REFERENCES public.players(dbv_id)
  ON UPDATE CASCADE ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_tournament_links_one_per_person_event
  ON public.user_tournament_links (user_id, player_dbv_id, external_tournament_id);
CREATE INDEX IF NOT EXISTS user_tournament_links_shared_roster
  ON public.user_tournament_links (player_dbv_id, start_date)
  WHERE is_shared = true;

-- Public consumers can query only these event/link fields, never owner user IDs.
GRANT SELECT (player_dbv_id, external_tournament_id, title, start_date,
              end_date, updated_at, shared_at, is_shared)
  ON public.user_tournament_links TO anon;
-- The authenticated owner already has full CRUD permission under existing RLS.
DROP POLICY IF EXISTS "Public opt-in reported tournament hints" ON public.user_tournament_links;
CREATE POLICY "Public opt-in reported tournament hints"
  ON public.user_tournament_links FOR SELECT TO anon, authenticated
  USING (is_shared AND player_dbv_id IS NOT NULL
    AND (end_date >= CURRENT_DATE - INTERVAL '60 days'
      OR (end_date IS NULL AND start_date >= CURRENT_DATE - INTERVAL '60 days')
      OR (end_date IS NULL AND start_date IS NULL AND shared_at > now() - INTERVAL '90 days'))
    AND EXISTS (SELECT 1 FROM public.players p
      WHERE p.dbv_id = player_dbv_id AND p.verified_at IS NOT NULL));

-- Preserve existing ownership policies but enforce a valid public DBV identity
-- and publication timestamp for every shared insert/update, and bound spam.
DROP POLICY IF EXISTS "Bound public tournament publications on insert" ON public.user_tournament_links;
CREATE POLICY "Bound public tournament publications on insert"
  ON public.user_tournament_links AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT is_shared OR (
    player_dbv_id IS NOT NULL AND shared_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.dbv_id = player_dbv_id AND p.verified_at IS NOT NULL)
  ));
DROP POLICY IF EXISTS "Bound public tournament publications on update" ON public.user_tournament_links;
CREATE POLICY "Bound public tournament publications on update"
  ON public.user_tournament_links AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (NOT is_shared OR (
    player_dbv_id IS NOT NULL AND shared_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.players p WHERE p.dbv_id = player_dbv_id AND p.verified_at IS NOT NULL)
  ));

-- Per-device anonymous accounts cannot accumulate unbounded public records.
CREATE OR REPLACE FUNCTION public.limit_user_tournament_links_v87()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $body$
BEGIN
  IF (SELECT count(*) FROM public.user_tournament_links x
      WHERE x.user_id=NEW.user_id) >= 40 THEN
    RAISE EXCEPTION 'Maximum of 40 saved tournament links per account';
  END IF;
  RETURN NEW;
END;
$body$;
DROP TRIGGER IF EXISTS limit_user_tournament_links_v87 ON public.user_tournament_links;
CREATE TRIGGER limit_user_tournament_links_v87 BEFORE INSERT
 ON public.user_tournament_links FOR EACH ROW
 EXECUTE FUNCTION public.limit_user_tournament_links_v87();
COMMIT;