-- Badminton ONLY: yadexibmjmnjfmfabrug. Source-declared winner, NO invented points.
-- All historical scored Badhub facts remain unchanged.
BEGIN;
ALTER TABLE public.player_external_match_facts
 ADD COLUMN IF NOT EXISTS outcome_evidence text;
ALTER TABLE public.player_external_match_facts
 ADD CONSTRAINT player_external_match_facts_outcome_evidence_v92_check
 CHECK (
  (jsonb_array_length(games) BETWEEN 1 AND 5 AND outcome_evidence IS NULL)
  OR
  (games='[]'::jsonb AND outcome_evidence='badhub-bold-dash' AND category='tournament')
 );
COMMENT ON COLUMN public.player_external_match_facts.outcome_evidence
 IS 'Only badhub-bold-dash when the tournament source card explicitly prints a dash AND highlights exactly one winner. No scored games are manufactured; an absence of scores without this proof remains uncountable.';
COMMIT;
