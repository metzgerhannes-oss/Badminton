-- v250 official DBV player-view monitoring, private and bounded.
CREATE TABLE IF NOT EXISTS public.dbv_matchday_targets (
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
 dbv_id text NOT NULL REFERENCES public.players(dbv_id) ON DELETE CASCADE,
 source_player_no integer NOT NULL CHECK (source_player_no BETWEEN 1 AND 999999),
 active_until date NOT NULL,
 last_checked_at timestamptz,
 last_success_at timestamptz,
 last_error_at timestamptz,
 error_code text,
 last_match_count integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tournament_id,dbv_id)
);
ALTER TABLE public.dbv_matchday_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dbv_matchday_targets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.dbv_matchday_targets TO service_role;
INSERT INTO public.dbv_matchday_targets(tournament_id,dbv_id,source_player_no,active_until)
SELECT t.id,p.dbv_id,500,t.end_date FROM public.tournaments t
JOIN public.players p ON p.dbv_id='05-067866' AND p.verified_at IS NOT NULL
WHERE t.provider='dbv.turnier.de'
 AND t.external_id='836C93F3-7635-420B-B314-DEDB60884AB2'::uuid
ON CONFLICT(tournament_id,dbv_id) DO UPDATE
SET source_player_no=EXCLUDED.source_player_no,active_until=EXCLUDED.active_until;

-- Retain source facts and relational IDs; stable source slots are not DBV-issued IDs.
UPDATE public.matches SET source_match_id=CASE source_match_id
 WHEN 'observed:player500:draw9:r16:20261107-0930' THEN 'pv:500:9:round-of-16:1'
 WHEN 'observed:player500:draw9:qf:20261107-1030' THEN 'pv:500:9:quarter-final:1'
 WHEN 'observed:player500:draw8:r16:20261107-1500' THEN 'pv:500:8:round-of-16:1'
 WHEN 'observed:player500:draw11:r16:20261108-1000' THEN 'pv:500:11:round-of-16:1'
 ELSE source_match_id END
WHERE source_match_id IN (
 'observed:player500:draw9:r16:20261107-0930',
 'observed:player500:draw9:qf:20261107-1030',
 'observed:player500:draw8:r16:20261107-1500',
 'observed:player500:draw11:r16:20261108-1000')
AND tournament_id IN(SELECT id FROM public.tournaments WHERE
 external_id='836C93F3-7635-420B-B314-DEDB60884AB2'::uuid
 AND provider='dbv.turnier.de');

-- Refresh happens ONLY on an authorized family member's visible Turniertag.
-- The browser throttles requests to one per followed player in five minutes;
-- the Edge service and DB reject out-of-window or too-frequent requests.
-- No scheduled job, Vault cron token, background polling or public endpoint.
