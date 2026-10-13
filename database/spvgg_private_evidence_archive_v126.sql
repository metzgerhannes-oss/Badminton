-- v126: Private, source-backed hard archive for all currently known SpVgg. Mössingen players.
-- No public JSON, Data API grant, anonymous RPC, new registration or invented results.
-- Empty coverage means "not yet documented", NEVER "no sports results".
-- Run in the Badminton project yadexibmjmnjfmfabrug only.
BEGIN;

CREATE TABLE IF NOT EXISTS private_content.spvgg_archive_players (
 dbv_id text PRIMARY KEY REFERENCES public.players(dbv_id)
   ON UPDATE CASCADE ON DELETE CASCADE,
 club_at_capture text NOT NULL CHECK (club_at_capture='SpVgg. Mössingen'),
 first_captured_at timestamptz NOT NULL DEFAULT now(),
 -- Deliberately not called complete: the DBV/Badhub record may be incomplete.
 coverage_status text NOT NULL DEFAULT 'not_exhaustively_verified'
   CHECK (coverage_status='not_exhaustively_verified')
);
CREATE TABLE IF NOT EXISTS private_content.spvgg_archive_evidence (
 dbv_id text NOT NULL REFERENCES private_content.spvgg_archive_players(dbv_id)
   ON UPDATE CASCADE ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('placement','match_card')),
 source_key text NOT NULL CHECK (length(source_key) BETWEEN 1 AND 460),
 payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object'),
 source_observed_at timestamptz,
 archived_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (dbv_id,kind,source_key)
);
CREATE INDEX IF NOT EXISTS spvgg_archive_evidence_kind_idx
 ON private_content.spvgg_archive_evidence(kind,dbv_id);

ALTER TABLE private_content.spvgg_archive_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_content.spvgg_archive_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private_content.spvgg_archive_players FROM PUBLIC,anon,authenticated;
REVOKE ALL ON private_content.spvgg_archive_evidence FROM PUBLIC,anon,authenticated;
-- No SELECT/INSERT/UPDATE/DELETE RLS policies: browser users cannot touch either table.
COMMENT ON TABLE private_content.spvgg_archive_players IS
 'Private roster/coverage marker; never infer zero trophies or matches from missing source material.';
COMMENT ON TABLE private_content.spvgg_archive_evidence IS
 'Private hard archive of source-backed placement and match cards; inaccessible to public browser roles. Access needs separately reviewed player-scoped permission.';

CREATE OR REPLACE FUNCTION private_content.refresh_spvgg_evidence_archive()
 RETURNS jsonb LANGUAGE plpgsql SET search_path=''
AS $function$
DECLARE
 v_players integer;
 v_placements integer;
 v_cards integer;
BEGIN
 -- Exact club association, stable DBV IDs, no fuzzy name ownership claims.
 INSERT INTO private_content.spvgg_archive_players(dbv_id,club_at_capture)
 SELECT p.dbv_id,'SpVgg. Mössingen' FROM public.players p
 WHERE p.club='SpVgg. Mössingen' AND p.dbv_id ~ '^[0-9]{2}-[0-9]{6}$'
 ON CONFLICT(dbv_id) DO NOTHING;

 INSERT INTO private_content.spvgg_archive_evidence
  (dbv_id,kind,source_key,payload,source_observed_at)
 SELECT p.dbv_id,'placement',t.id,
  to_jsonb(t)-'player_id',t.updated_at
 FROM public.tournament_placements t
 JOIN public.players p ON p.id=t.player_id
 JOIN private_content.spvgg_archive_players a ON a.dbv_id=p.dbv_id
 WHERE p.club='SpVgg. Mössingen' AND t.source_url ~ '^https://'
 ON CONFLICT(dbv_id,kind,source_key) DO UPDATE
 SET payload=EXCLUDED.payload,
     source_observed_at=EXCLUDED.source_observed_at,archived_at=now()
 WHERE private_content.spvgg_archive_evidence.payload IS DISTINCT FROM EXCLUDED.payload
    OR private_content.spvgg_archive_evidence.source_observed_at IS DISTINCT FROM EXCLUDED.source_observed_at;

 INSERT INTO private_content.spvgg_archive_evidence
  (dbv_id,kind,source_key,payload,source_observed_at)
 SELECT f.dbv_id,'match_card',f.source_key,
  to_jsonb(f)-'dbv_id',f.observed_at
 FROM public.player_external_match_facts f
 JOIN public.players p ON p.dbv_id=f.dbv_id
 JOIN private_content.spvgg_archive_players a ON a.dbv_id=f.dbv_id
 WHERE p.club='SpVgg. Mössingen' AND f.source_url ~ '^https://'
 ON CONFLICT(dbv_id,kind,source_key) DO UPDATE
 SET payload=EXCLUDED.payload,
     source_observed_at=EXCLUDED.source_observed_at,archived_at=now()
 WHERE private_content.spvgg_archive_evidence.payload IS DISTINCT FROM EXCLUDED.payload
    OR private_content.spvgg_archive_evidence.source_observed_at IS DISTINCT FROM EXCLUDED.source_observed_at;

 -- Legal corrections/removals must propagate; this is an availability
 -- snapshot, not a route to resurrect corrected or erased records.
 DELETE FROM private_content.spvgg_archive_evidence a
 WHERE (a.kind='placement' AND NOT EXISTS (
          SELECT 1 FROM public.tournament_placements t
          JOIN public.players p ON p.id=t.player_id
          WHERE p.dbv_id=a.dbv_id AND t.id=a.source_key
            AND p.club='SpVgg. Mössingen' AND t.source_url ~ '^https://'))
    OR (a.kind='match_card' AND NOT EXISTS (
          SELECT 1 FROM public.player_external_match_facts f
          JOIN public.players p ON p.dbv_id=f.dbv_id
          WHERE f.dbv_id=a.dbv_id AND f.source_key=a.source_key
            AND p.club='SpVgg. Mössingen' AND f.source_url ~ '^https://'));

 SELECT count(*) INTO v_players FROM private_content.spvgg_archive_players;
 SELECT count(*) FILTER(WHERE kind='placement'),
        count(*) FILTER(WHERE kind='match_card')
  INTO v_placements,v_cards FROM private_content.spvgg_archive_evidence;
 RETURN jsonb_build_object('profiles',v_players,'placements',v_placements,
  'match_cards',v_cards,'coverage','partial_not_exhaustively_verified');
END;
$function$;

-- Function remains inside unexposed private schema, callable only by DB jobs/admin.
REVOKE ALL ON FUNCTION private_content.refresh_spvgg_evidence_archive()
 FROM PUBLIC,anon,authenticated;

-- First fill is synchronous; later source-backed upserts are retained daily
-- without additional hosted services, browser secrets or person-search endpoints.
SELECT private_content.refresh_spvgg_evidence_archive();
SELECT cron.schedule(
 'badminton-spvgg-private-evidence-archive-v126',
 '35 3 * * *',
 'SELECT private_content.refresh_spvgg_evidence_archive();'
);
COMMIT;
