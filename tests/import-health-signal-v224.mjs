import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const sql=await readFile(
  "supabase/migrations/20261026174500_private_import_health_signal.sql","utf8");
const contains=(needle,message)=>assert.ok(sql.includes(needle),message||"Missing "+needle);

contains("CREATE OR REPLACE FUNCTION private_content.record_import_health_weekly()");
contains("SECURITY INVOKER");
contains("SET search_path TO 'pg_catalog', 'pg_temp'");
// PostgreSQL requires a semicolon AFTER the closing dollar quote, before
// REVOKE. The previous migration passed text-only tests but failed SQL DDL.
assert.match(sql,/END;\s*\$function\$;\s*REVOKE ALL ON FUNCTION/,
 "The PL/pgSQL definition must end before REVOKE (DB syntax regression)");
contains("REVOKE ALL ON FUNCTION private_content.record_import_health_weekly() FROM PUBLIC, anon, authenticated");
for(const metric of ["import_count_mismatch","import_count_excess_facts","import_count_shortfall",
 "import_count_missing_counter"])
  contains("'"+metric+"'","Missing diagnostic "+metric);

assert.ok(!sql.includes("OR (counts->>'import_count_mismatch')::int > 0"),
  "Cumulative canonical facts are not comparable to one import job counter");
contains("OR (counts->>'import_count_shortfall')::int > 0",
  "A genuine shortage of canonical match facts must still raise attention");
contains("OR (counts->>'import_count_missing_counter')::int > 0",
  "Missing import evidence must still raise attention");
contains("OR (counts->>'stage_cards_unreconciled')::int > 0",
  "Unreconciled staging cards must remain an attention signal");
for(const metric of ["bad_import_status","match_archive_mismatch",
 "placement_archive_mismatch","players_without_match_proof",
 "players_without_latest_ranking"])
  contains("OR (counts->>'"+metric+"')::int > 0",
    "Never hide real import, archive or ranking failures: "+metric);
contains("OR (counts->>'ranking_publication_age_days')::int > 14",
  "Ranking publication age warning must retain its original 14-day threshold");
contains("ON CONFLICT (checked_on) DO UPDATE");
assert.match(sql,/checked_on < .*?90;/s,"Retain existing 90-day log cleanup");
assert.doesNotMatch(sql,/https?:\/\/|http_get|net\.http|service_role|cron\.schedule\(/i,
  "No external source request, privileged key or additional cron job");
console.log("Private import health: separate cumulative counts from real failures, with no network or new cron.");
