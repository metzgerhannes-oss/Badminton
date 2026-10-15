-- A rank in the complete national youth list is NOT an age-class-only rank.
-- Published DBV Jugend-Gesamtliste, 14.10.2026.
ALTER TABLE public.ranking_entries
 ADD COLUMN IF NOT EXISTS germany_youth_overall_rank integer
 CHECK (germany_youth_overall_rank >= 1);
