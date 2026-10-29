import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../supabase/migrations/20261029061000_import_health_stage_diagnostic_only.sql",import.meta.url),"utf8");

test("historical stage/backup counts stay visible, but no longer force a permanent alarm",()=>{
 assert.match(sql,/stage_cards_unreconciled/);
 assert.match(sql,/backup_cards_not_in_current/);
 assert.doesNotMatch(sql,/OR\s*\(counts->>'stage_cards_unreconciled'\)::int\s*>\s*0/);
 assert.doesNotMatch(sql,/OR\s*\(counts->>'backup_cards_not_in_current'\)::int\s*>\s*0/);
});
test("true source and import faults remain actionable and data is not deleted",()=>{
 for(const gate of ["bad_import_status","import_count_shortfall",
   "import_count_missing_counter","match_archive_mismatch",
   "players_without_latest_ranking","players_without_match_proof",
   "ranking_publication_age_days","pg_database_bytes"]){
   assert.match(sql,new RegExp("counts->>'"+gate+"'"),gate);
 }
 assert.match(sql,/ON CONFLICT\s*\(checked_on\)/);
 assert.doesNotMatch(sql,/TRUNCATE|DELETE\s+FROM\s+(?:public\.spvgg_match_rebuild_stage|private_content\.spvgg_match_backup)/i);
 assert.doesNotMatch(sql,/GRANT\s+|\bcron\.schedule\s*\(/i);
});
