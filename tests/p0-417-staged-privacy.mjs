import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
// Offline contract only: this test MUST NOT access a live Supabase project.
const read=path=>readFile(path,"utf8");
const sql=await read("database/p0-417-staged-member-rls-cutover.sql");
const rollback=await read("database/p0-417-staged-rollback-RESTORES-PUBLIC-READ.sql");
const client=await read("scripts/supabase-read.mjs");
const identity=await read("scripts/targeted-player-search.mjs");
const legacy=await read("friend-search.js");
const tables=["clubs","dbv_calendar_entries","events","league_clubs",
 "league_fixtures","league_table_rows","league_teams","ranking_weeks",
 "report_sources","tournaments"];
assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
assert.match(sql,/expected 10 public SELECT policies/);
for(const table of tables){
 assert.ok(sql.includes("ON public."+table),"Old public policy removed: "+table);
 assert.ok(sql.includes("CREATE POLICY \"p0_417_verified_family_read\" ON public."+table),
  "Member-only RLS required: "+table);
}
assert.match(sql,/REVOKE SELECT ON [^;]+ FROM PUBLIC, anon;/);
assert.match(sql,/FOR SELECT TO authenticated USING \(\(SELECT public\.app_access_is_member\(\)\)\)/);
assert.match(sql,/IF public\.app_access_is_member\(\) IS DISTINCT FROM true THEN RETURN; END IF;/);
assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.search_dbv_player_identity\(text,text,text,text\) FROM PUBLIC, anon;/);
assert.doesNotMatch(sql,/app_access_invite_accept[^\n]*(?:REVOKE|DROP)/i);
assert.match(rollback,/EMERGENCY ROLLBACK \(restores former PUBLIC READ exposure\)/);
assert.match(rollback,/GRANT SELECT ON [^;]+ TO anon,authenticated;/);
assert.match(client,/member\?\.allowed!==true/);
assert.match(client,/Authorization:"Bearer "\+sessionToken/);
assert.doesNotMatch(client,/const protectedRoute=/);
assert.match(identity,/member\?\.allowed===true/);
assert.match(identity,/Authorization:"Bearer "\+token/);
assert.match(legacy,/window\.badmintonAppAccess\?\.allowed!==true/);
assert.match(legacy,/Authorization:"Bearer "\+token/);
const legacyLive=await read("live.js");
assert.match(legacyLive,/member\?\.allowed!==true/);
assert.match(legacyLive,/Authorization:"Bearer "\+token/);
for(const path of ["dbv-calendar.js","teams.js","library.js"]){
 assert.match(await read(path),/badminton:app-access-granted/);
}
console.log("P0 #417: staged reversible member-only RLS, protected RPC, verified-JWT clients, no live network.");
