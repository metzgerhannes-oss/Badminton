-- Official match reads only for a valid invited family JWT.
-- No anonymous Data API access, no member writes, no user-profile metadata.
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.matches, public.match_participants,
  public.match_games, public.players FROM anon, authenticated;

-- Select only fields required by the exact /matches?select=... embed query.
GRANT SELECT (id, tournament_id, event_id, status, court, scheduled_at,
  source_url, last_synced_at) ON public.matches TO authenticated;
GRANT SELECT (match_id, side, player_position, player_id, participant_name)
  ON public.match_participants TO authenticated;
GRANT SELECT (match_id, game_number, side1_points, side2_points, finished)
  ON public.match_games TO authenticated;
GRANT SELECT (id, dbv_id, name) ON public.players TO authenticated;

DROP POLICY IF EXISTS v248_private_family_match_read ON public.matches;
CREATE POLICY v248_private_family_match_read ON public.matches
  FOR SELECT TO authenticated
  USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS v248_private_family_match_participants_read ON public.match_participants;
CREATE POLICY v248_private_family_match_participants_read ON public.match_participants
  FOR SELECT TO authenticated
  USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS v248_private_family_match_games_read ON public.match_games;
CREATE POLICY v248_private_family_match_games_read ON public.match_games
  FOR SELECT TO authenticated
  USING ((SELECT public.app_access_is_member()));
DROP POLICY IF EXISTS v248_private_family_match_players_read ON public.players;
CREATE POLICY v248_private_family_match_players_read ON public.players
  FOR SELECT TO authenticated
  USING ((SELECT public.app_access_is_member()));
