import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// Offline contract: CI must never access real Supabase.
const sql=await readFile(
 "supabase/migrations/20261017183000_private_storage_budget_guard.sql","utf8"
);
assert.match(sql,/CREATE OR REPLACE FUNCTION private_content\.record_import_health_weekly/);
assert.match(sql,/SECURITY INVOKER/);
assert.match(sql,/REVOKE ALL ON FUNCTION private_content\.record_import_health_weekly/);
assert.match(sql,/pg_database_size\(current_database\(\)\)/);
assert.match(sql,/pg_total_relation_size\('public\.spvgg_match_rebuild_stage'::regclass\)/);
assert.match(sql,/pg_total_relation_size\('private_content\.spvgg_match_backup_before_reimport_20261015'::regclass\)/);
for(const metric of [
 "pg_database_bytes","nominal_free_database_limit_bytes",
 "pg_database_nominal_percent","storage_watch_level","match_stage_bytes",
 "reimport_backup_bytes","stage_cards_unreconciled",
 "backup_cards_not_in_current","ranking_weeks_retained",
 "previous_pg_database_bytes",
 "club_profiles","match_archive_mismatch"
])assert.ok(sql.includes("'"+metric+"'"),"Missing safe aggregate "+metric);
assert.match(sql,/350000000/,"70% early warning");
assert.match(sql,/425000000/,"85% critical threshold");
assert.match(sql,/\(counts->>'ranking_weeks_retained'\)::int > 8/);
assert.match(sql,/summary \? 'pg_database_bytes'/);
assert.match(sql,/ON CONFLICT \(checked_on\) DO UPDATE/);
assert.match(sql,/checked_on < \(now\(\) AT TIME ZONE 'UTC'\)::date - 90/);
const inserted=sql.slice(sql.indexOf("counts := counts || jsonb_build_object("),
 sql.indexOf("  classification := CASE"));
assert.ok(inserted.length>100);
assert.doesNotMatch(inserted,/INSERT INTO|UPDATE public\.|DELETE FROM|DROP TABLE/i);
assert.doesNotMatch(sql,/http_get|net\.http|supabase\.co|service_role|pg_read_file/i);
assert.doesNotMatch(sql,/DELETE FROM public\.|DELETE FROM private\.external_match_quarantine|TRUNCATE|DROP TABLE/i);
assert.doesNotMatch(sql,/cron\.schedule|cron\.unschedule/i,
 "Reuse existing weekly check; do not create more scheduled jobs");
console.log("Storage budget: bounded, private, non-destructive and 70/85% watch gates OK.");
