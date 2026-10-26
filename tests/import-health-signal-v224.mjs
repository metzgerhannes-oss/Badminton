import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const sql=await readFile("supabase/migrations/20261026174500_private_import_health_signal.sql","utf8");
assert.match(sql,/CREATE OR REPLACE FUNCTION private_content\\.record_import_health_weekly\\(\\)/);
assert.match(sql,/SECURITY INVOKER/);
assert.match(sql,/SET search_path TO 'pg_catalog', 'pg_temp'/);
assert.match(sql,/REVOKE ALL ON FUNCTION private_content\\.record_import_health_weekly\\(\\) FROM PUBLIC, anon, authenticated/);
assert.match(sql,/'import_count_mismatch'/,"Retain diagnostic count for audit continuity");
assert.match(sql,/'import_count_excess_facts'/);
assert.match(sql,/'import_count_shortfall'/);
assert.doesNotMatch(sql,/OR \\(counts->>'import_count_mismatch'\\)::int > 0/,
  "Lifetime fact totals are not comparable to one worker batch; no false alarm");
assert.match(sql,/OR \\(counts->>'stage_cards_unreconciled'\\)::int > 0/,
  "Unreconciled staging evidence must still be signalled");
for(const metric of ["bad_import_status","match_archive_mismatch","placement_archive_mismatch",
  "players_without_match_proof","players_without_latest_ranking","ranking_publication_age_days"])
  assert.match(sql,new RegExp("OR \\(counts->>'"+metric+"'\\)::int > 0"),
    "Do not downgrade real import, archive or coverage failures: "+metric);
assert.match(sql,/ON CONFLICT \\(checked_on\\) DO UPDATE/);
assert.match(sql,/checked_on < \\(now\\(\\) at time zone 'UTC'\\)::date - 90/i);
assert.doesNotMatch(sql,/https?:\\/\\/|http_get|net\\.http|service_role|cron\\.schedule\\(/i,
  "No network, credentials, or additional cron");
console.log("Weekly health signal: diagnostics separated, real import/stage warnings retained, privacy preserved");
