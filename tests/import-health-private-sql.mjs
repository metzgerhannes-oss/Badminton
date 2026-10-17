import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// Offline-only contract: CI never connects to productive Supabase.
// Live SQL is exercised only after the reviewed migration is explicitly applied.
const sql=await readFile(
 "supabase/migrations/20261017170000_private_import_health_weekly.sql","utf8"
);
assert.match(sql,/CREATE TABLE IF NOT EXISTS private_content\.import_health_weekly/);
assert.match(sql,/ALTER TABLE private_content\.import_health_weekly ENABLE ROW LEVEL SECURITY/);
assert.match(sql,/REVOKE ALL ON private_content\.import_health_weekly FROM PUBLIC, anon, authenticated/);
assert.match(sql,/SECURITY INVOKER/);
assert.match(sql,/REVOKE ALL ON FUNCTION private_content\.record_import_health_weekly\(\)/);
assert.match(sql,/cron\.schedule\(\s*'badminton-import-health-weekly-v1'/);
assert.match(sql,/'49 7 \* \* 1'/);
assert.match(sql,/ON CONFLICT \(checked_on\) DO UPDATE/);
assert.match(sql,/checked_on < \(now\(\) AT TIME ZONE 'UTC'\)::date - 90/);
for(const metric of [
 "club_profiles","players_without_match_proof","players_without_latest_ranking",
 "bad_import_status","import_count_mismatch","match_archive_mismatch",
 "placement_archive_mismatch","ranking_publication_age_days","match_proofs",
 "tournament_placements"
])assert.ok(sql.includes("'"+metric+"'"),"Missing aggregate "+metric);
assert.match(sql,/source_key=f\.source_key/,"Proof identity checks, not just totals");
// No identifiers, contact details, match cards or source URLs stored in summaries.
const summary=sql.slice(sql.indexOf("SELECT jsonb_build_object("),
 sql.indexOf(") INTO counts",sql.indexOf("SELECT jsonb_build_object(")));
for(const token of ["dbv_id","player_id","email","source_url","opponent_names","source_key"])
 assert.doesNotMatch(summary,new RegExp("\\b"+token+"\\b","i"),
  "Aggregate summary may never contain personal details");
assert.doesNotMatch(sql,/https?:\/\/|http_get|net\.http|service_role|perform\s+.*import/i,
 "The weekly check must not fetch sources, cause imports or require API credentials");
console.log("Import health: privacy, one weekly run, 90d retention and source proof invariants OK.");
