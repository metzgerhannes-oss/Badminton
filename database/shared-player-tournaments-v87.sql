-- Community tournament sharing v87. Prepared for the Badminton Supabase project ONLY.
-- IMPORTANT: Do not apply to JohannasGartenwelt. Requires a verified player-claim
-- process and production RLS review BEFORE enabling writes in the public app.
-- No private user profiles, email, location, follow graphs or match results
-- are stored here. Official match evidence remains in the existing DBV imports.
BEGIN;

CREATE TABLE IF NOT EXISTS public.dbv_player_sharing_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dbv_player_id text NOT NULL CHECK(dbv_player_id ~ '^[0-9]{2}-[0-9]{6}$'),
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dbv_player_id)
);
ALTER TABLE public.dbv_player_sharing_claims ENABLE ROW LEVEL SECURITY;
-- App clients may see their own claim status, never edit or create claims.
REVOKE ALL ON TABLE public.dbv_player_sharing_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.dbv_player_sharing_claims TO authenticated;
DROP POLICY IF EXISTS "Read own player sharing claims" ON public.dbv_player_sharing_claims;
CREATE POLICY "Read own player sharing claims"
  ON public.dbv_player_sharing_claims FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.shared_player_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dbv_player_id text NOT NULL CHECK(dbv_player_id ~ '^[0-9]{2}-[0-9]{6}$'),
  tournament_id uuid NOT NULL,
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 120),
  start_date date,
  end_date date,
  is_shared boolean NOT NULL DEFAULT false,
  reported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_player_tournaments_date_order CHECK (
    end_date IS NULL OR start_date IS NOT NULL AND end_date >= start_date),
  CONSTRAINT shared_player_tournaments_unique UNIQUE(owner_id, dbv_player_id, tournament_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_tournaments_public
  ON public.shared_player_tournaments (dbv_player_id, start_date)
  WHERE is_shared = true;

ALTER TABLE public.shared_player_tournaments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shared_player_tournaments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.shared_player_tournaments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.shared_player_tournaments TO authenticated;

-- Only a verified manager may publish a player's upcoming attendance.
-- Anonymous sign-in is NOT ownership proof: reject those JWTs as publishers.
-- Authenticated users may read their own drafts but the public sees only
-- explicitly published rows connected to a verified player claim.
DROP POLICY IF EXISTS "Read shared tournaments" ON public.shared_player_tournaments;
CREATE POLICY "Read shared tournaments" ON public.shared_player_tournaments
  FOR SELECT TO anon, authenticated
  USING (
    (is_shared AND EXISTS (
      SELECT 1 FROM public.dbv_player_sharing_claims c
      WHERE c.user_id = owner_id AND c.dbv_player_id = dbv_player_id
        AND c.verified_at IS NOT NULL
    ))
    OR (owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Publish tournament for verified player" ON public.shared_player_tournaments;
CREATE POLICY "Publish tournament for verified player" ON public.shared_player_tournaments
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND COALESCE((SELECT auth.jwt())->>'is_anonymous','true') = 'false'
    AND EXISTS (
      SELECT 1 FROM public.dbv_player_sharing_claims c
      WHERE c.user_id = owner_id AND c.dbv_player_id = dbv_player_id
        AND c.verified_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Update own verified tournament" ON public.shared_player_tournaments;
CREATE POLICY "Update own verified tournament" ON public.shared_player_tournaments
  FOR UPDATE TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    AND COALESCE((SELECT auth.jwt())->>'is_anonymous','true') = 'false'
    AND EXISTS (
      SELECT 1 FROM public.dbv_player_sharing_claims c
      WHERE c.user_id = owner_id AND c.dbv_player_id = dbv_player_id
        AND c.verified_at IS NOT NULL
    )
  )
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND COALESCE((SELECT auth.jwt())->>'is_anonymous','true') = 'false'
    AND EXISTS (
      SELECT 1 FROM public.dbv_player_sharing_claims c
      WHERE c.user_id = owner_id AND c.dbv_player_id = dbv_player_id
        AND c.verified_at IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Remove own verified tournament" ON public.shared_player_tournaments;
CREATE POLICY "Remove own verified tournament" ON public.shared_player_tournaments
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) AND
    COALESCE((SELECT auth.jwt())->>'is_anonymous','true') = 'false');

COMMIT;
