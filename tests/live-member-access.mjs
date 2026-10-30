import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {readPublicRows,PublicReadError} from "../scripts/supabase-read.mjs";
// All network responses in this test are synthetic. No production API calls.
const path="player_live_snapshots?dbv_id=eq.05-070879&limit=1";
let attempts=0,header="";
const fake=async(_url,options)=>{
 attempts++;header=options.headers.Authorization||"";
 return {ok:true,status:200,headers:{get:()=>null},json:async()=>[]};
};
globalThis.window={badmintonAppAccess:{allowed:false,async getAccessToken(){return null}}};
await assert.rejects(readPublicRows(path,{fetchImpl:fake,retries:0}),e=>
 e instanceof PublicReadError&&e.kind==="restricted"&&e.status===403);
assert.equal(attempts,0,"No anonymous live-cache request may be emitted");
globalThis.window={badmintonAppAccess:{allowed:true,async getAccessToken(){return "synthetic-member-jwt"}}};
const rows=await readPublicRows(path,{fetchImpl:fake,retries:0,count:false});
assert.deepEqual(rows.rows,[]);
assert.equal(attempts,1);
assert.equal(header,"Bearer synthetic-member-jwt");
header="";
await readPublicRows("league_fixtures?limit=1",{fetchImpl:fake,retries:0,count:false});
assert.equal(header,"Bearer synthetic-member-jwt","P0 #417: league fixtures must also require a verified family JWT");
delete globalThis.window;
const migration=await readFile("supabase/migrations/20261019210000_member_scoped_live_read_watch.sql","utf8");
assert.match(migration,/grant select\s*\(dbv_id,\s*provider,\s*source_url,\s*checked_at,\s*payload,\s*last_error_at\)/i);
assert.match(migration,/grant insert\s*\(dbv_id\)\s+on\s+(?:table\s+)?public\.player_live_watches to authenticated/i);
assert.match(migration,/app_access_is_member\(\)/g);
assert.match(migration,/app_access_is_verified_live_player\(dbv_id\)/);
assert.equal((migration.match(/\$member_check\$/g)||[]).length,2,"SQL function delimiter must be balanced");
assert.equal((migration.match(/\bcommit\s*;/gi)||[]).length,1,"SQL must be one transaction");
assert.match(migration,/select public\.app_access_is_member\(\)[\s\S]*and p_dbv_id/,"helper must also require membership");
assert.match(migration,/security definer\s+set search_path\s*=\s*''/i);
assert.doesNotMatch(migration,/grant\s+select\s+on\s+public\.players/i);
assert.doesNotMatch(migration,/grant\s+(?:select|insert)\s+on\s+public\.player_live_(?:watches|snapshots)\s+to\s+anon/i);
assert.doesNotMatch(migration,/cron\.schedule|cron\.unschedule|create\s+extension/i);
const radar=await readFile("live-radar.js","utf8");
const followed=await readFile("followed-live.js","utf8");
assert.match(radar,/Authorization:"Bearer "\+token/);
assert.match(followed,/Authorization:"Bearer "\+token/);
assert.match(radar,/getAccessToken/);
assert.match(radar,/badminton:app-access-granted/,"Live radar must retry after async member grant");
assert.match(radar,/if\(!window\.badmintonAppAccess\?\.allowed\)/,
 "Live radar must not request unauthenticated watch during startup");
assert.match(followed,/getAccessToken/);
assert.match(followed,/badminton:app-access-granted/);
assert.match(followed,/if\(!window\.badmintonAppAccess\?\.allowed\)/,
 "Followed LIVE must await membership before scheduling watches");
console.log("P0 #417: verified family JWT required for live cache and league fixtures; no anonymous reads or extra cron.");
