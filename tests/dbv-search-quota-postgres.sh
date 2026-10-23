#!/usr/bin/env bash
# F03: ephemeral PostgreSQL 17 only. Never point PGHOST at Supabase.
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" ]] || { echo "Refusing non-local PostgreSQL host" >&2; exit 2; }
[[ "${PGDATABASE:-}" == "badminton_test" ]] || { echo "Refusing non-fixture database" >&2; exit 2; }
command -v psql >/dev/null || { echo "PostgreSQL client unavailable" >&2; exit 2; }

psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA private_content;
CREATE TABLE public.players (
  dbv_id text NOT NULL, name text NOT NULL, club text, age_class text,
  association text, verified_at timestamptz, last_ranking_week integer
);
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.players FROM PUBLIC, anon, authenticated;
INSERT INTO public.players VALUES
  ('99-000001','Test Sichtbar','Beispielclub','U13','BAW',clock_timestamp(),42),
  ('99-000002','Test Nichtgeprueft','Beispielclub','U13','BAW',NULL,42);
SQL
psql -X -v ON_ERROR_STOP=1 -f database/dbv-identity-quota-f03.sql

psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='search_dbv_player_identity'
    AND p.provolatile='v' AND p.prosecdef AND p.proconfig @> ARRAY['search_path=']
 ) THEN RAISE EXCEPTION 'Quota function security properties are wrong'; END IF;
 IF has_table_privilege('anon','public.players','SELECT')
 OR has_table_privilege('anon','private_content.dbv_identity_search_quota','SELECT')
 OR has_table_privilege('anon','private_content.dbv_identity_search_quota','UPDATE')
 OR NOT has_function_privilege('anon','public.search_dbv_player_identity(text,text,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Unexpected anonymous grants'; END IF;
END $$;
SET ROLE anon;
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM public.search_dbv_player_identity('Test');
 IF n <> 1 THEN RAISE EXCEPTION 'Expected only one verified synthetic player, got %', n; END IF;
END $$;
RESET ROLE;
-- 59 additional requests plus the first valid anonymous call = minute cap 60.
DO $$
DECLARE i integer;
BEGIN
 FOR i IN 1..59 LOOP
   PERFORM dbv_id FROM public.search_dbv_player_identity('Test');
 END LOOP;
END $$;
SQL

expect_429() {
  local output rc
  set +e
  output=$(psql -X -v VERBOSITY=verbose -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) FROM public.search_dbv_player_identity('Test');" 2>&1)
  rc=$?
  set -e
  if [[ "$rc" -eq 0 || "$output" != *"PGRST"* ]]; then
    echo "Expected PostgreSQL PGRST custom 429 exception, got: $output" >&2
    exit 1
  fi
}
expect_429
psql -X -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private_content.dbv_identity_search_quota
   WHERE singleton=true AND minute_requests=60 AND day_requests=60)
 THEN RAISE EXCEPTION 'Atomic minute counter incorrect after 60 accepted calls'; END IF;
END $$;
UPDATE private_content.dbv_identity_search_quota SET
 minute_requests=1, day_requests=1200;
SQL
expect_429
psql -X -v ON_ERROR_STOP=1 <<'SQL'
UPDATE private_content.dbv_identity_search_quota SET
 minute_bucket=clock_timestamp()-interval '2 minutes',
 day_bucket=((clock_timestamp() AT TIME ZONE 'UTC')::date-1);
SELECT count(*) FROM public.search_dbv_player_identity('Test');
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private_content.dbv_identity_search_quota
  WHERE singleton=true AND minute_requests=1 AND day_requests=1)
 THEN RAISE EXCEPTION 'UTC rollover did not reset both global quotas'; END IF;
END $$;
SQL
echo "F03 ephemeral PostgreSQL: anon RLS/grants, 60/min, 1200/day, PGRST 429, UTC reset PASS"
