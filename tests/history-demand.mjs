import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {validHistoryId,importPost,demandPost,importStatusPath,importStatusUrl,overviewPath,overviewUrl,importMessage,retryAfterHours,historyImportOutcome} from "../scripts/history-demand.mjs";

assert.equal(validHistoryId("05-061350"),true);
for(const invalid of ["","local-123","05-12345","evil","05-061350 OR TRUE",undefined]){
 assert.equal(validHistoryId(invalid),false);
 assert.equal(importPost(invalid),null);
 assert.equal(demandPost(invalid),null);
 assert.equal(importStatusPath(invalid),null);
 assert.equal(overviewPath(invalid),null);
 assert.equal(importStatusUrl(invalid),null);
 assert.equal(overviewUrl(invalid),null);
}
const req=demandPost("05-061350");
assert.equal(req.url,"https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/rpc/request_player_history_demand");
assert.deepEqual(JSON.parse(req.body),{target_id:"05-061350"});
const post=importPost("05-061350");
assert.deepEqual(JSON.parse(post.body),{dbv_id:"05-061350"});
assert.equal(post.headers.Prefer,"resolution=ignore-duplicates,return=minimal");
assert.equal(post.url,"https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/player_history_imports?on_conflict=dbv_id");
assert.match(importStatusUrl("05-061350"),/dbv_id=eq.05-061350/);
assert.match(overviewUrl("05-061350"),/player_history_overviews/);
assert.equal(importStatusUrl("05-061350"),"https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/"+importStatusPath("05-061350"));
assert.equal(overviewUrl("05-061350"),"https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/"+overviewPath("05-061350"));
assert.match(importStatusPath("05-061350"),/^player_history_imports\?/);
assert.match(overviewPath("05-061350"),/^player_history_overviews\?/);
assert.match(importMessage({status:"queued"}).title,/vorgemerkt/);
assert.match(importMessage({status:"checking"}).title,/geprüft/);
assert.match(importMessage({status:"partial"}).detail,/Bereits belegte Spiele bleiben sichtbar/);
assert.equal(importMessage({status:"complete"}).kind,"complete");
assert.match(importMessage({status:"complete",match_cards:62}).detail,/62 gespeicherte Einzelmatchkarten/);
assert.match(importMessage({status:"complete",match_cards:62}).detail,/nicht die Vollständigkeit/);
assert.doesNotMatch(importMessage({status:"complete",match_cards:0}).detail,/0 gespeicherte Einzelmatchkarten/);
assert.match(importMessage({status:"partial",match_cards:235}).detail,/235 gespeicherte Einzelmatchkarten/);
assert.match(importMessage({status:"error",match_cards:18}).detail,/18 gespeicherte Einzelmatchkarten/);
assert.doesNotMatch(importMessage({status:"error",match_cards:-1}).detail,/-1 gespeicherte Einzelmatchkarten/);
assert.doesNotMatch(importMessage({status:"awaiting_source",match_cards:"unknown"}).detail,/unknown/);
assert.match(importMessage({status:"awaiting_source"}).detail,/keine neuen eindeutigen Einzelmatches/);
assert.match(importMessage({status:"awaiting_source"}).detail,/Vorhandene Ranglisten und Turnierergebnisse bleiben sichtbar/);
assert.doesNotMatch(importMessage({status:"awaiting_source"}).detail,/weiterhin regelmäßig geprüft/);
assert.equal(retryAfterHours({status:"partial"}),168);
assert.equal(retryAfterHours({status:"error"}),1);

const sql=await readFile("database/history-on-demand.sql","utf8");
const app=await readFile("app.js","utf8");
const welcome=await readFile("welcome.js","utf8");
const page=await readFile("index.html","utf8");
const bridge=await readFile("history-demand.js","utf8");
const career=await readFile("career-history.js","utf8");
const sw=await readFile("sw.js","utf8");
assert.match(sql,/create table if not exists public\.player_history_imports/);
assert.match(sql,/create table if not exists public\.player_history_overviews/);
assert.match(sql,/enable row level security/);
assert.match(sql,/grant insert\(dbv_id\)/);
assert.match(sql,/verified_at is not null/);
assert.match(sql,/pg_advisory_xact_lock/);
assert.match(sql,/>=60 then/);
assert.match(sql,/limit batch_size for update skip locked/);
assert.match(sql,/interval '7 days'/);
assert.match(sql,/cron\.schedule\('badminton-history-demand-worker'/);
assert.match(sql,/sourceStatus.*third-party-aggregated/);
assert.match(sql,/awaiting_source/);
assert.ok(!sql.includes("insert into public.matches"),"Never synthesize official match rows from Badhub aggregates");
assert.match(app,/badminton:friend-followed/);
assert.match(app,/badminton:own-profile-added/);
assert.match(bridge,/badminton:profile-change/);
assert.match(bridge,/const historyOpen=\(\)=>location\.hash==="#historie"/);
assert.match(bridge,/if\(!historyOpen\(\)\|\|!allowed\(id\)\)/);
assert.doesNotMatch(bridge,/registerSavedProfiles|enqueueQuietly/);
assert.doesNotMatch(bridge,/addEventListener\("badminton:friend-followed"/);
assert.doesNotMatch(bridge,/addEventListener\("badminton:own-profile-added"/);
assert.match(bridge,/readPublicRows\(importStatusPath\(id\),\{signal,count:false\}\)/);
assert.doesNotMatch(bridge,/fetch\(importStatusUrl/);
assert.match(bridge,/requestDemand\(id,signal\)/);
assert.match(bridge,/app_access_player_coverage/,
 "A permission-checked coverage RPC, not an open public SELECT, reports match-card counts");
assert.match(bridge,/match_cards:Number\.isSafeInteger\(verifiedCount\)/,
 "Only a verified nonnegative server card count can reach the source status view");

assert.doesNotMatch(bridge,/requestNew\(/);
assert.doesNotMatch(welcome,/importPost|history-match-import|player_history_imports/);
assert.match(welcome,/Profile creation and invitation remain entirely local/);
assert.match(page,/id="history-import-status"/);
assert.doesNotMatch(page,/id="home-import-status"/,"Home should not display technical import warnings");
assert.match(page,/<details id="history-source-details"/);
assert.match(bridge,/const views=\(\)=>\[\$\("history-import-status"\)\]/);
assert.match(career,/readPublicRows\(overviewPath\(id\),\{count:false\}\)/);
assert.doesNotMatch(career,/fetch\(overviewUrl/);
assert.match(career,/data\/player-history\/index.json/);
assert.match(sw,/history-demand\.js/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
const idleSQL=await readFile("database/history-worker-idle-guard-v51.sql","utf8");
assert.match(idleSQL,/if not exists \(/);
assert.match(idleSQL,/jsonb_build_object\('processed',0/);
assert.ok(idleSQL.indexOf("if not exists (")<idleSQL.indexOf("extensions.http_get("),"Check outstanding demand before any external HTTP request");
assert.match(idleSQL,/interval '7 days'/,"Prior refresh rules remain unchanged");
const lifecycle=await readFile("database/history-demand-lifecycle-v52.sql","utf8");
assert.match(lifecycle,/add column if not exists last_demand_at/);
assert.match(lifecycle,/create or replace function public.request_player_history_demand/);
assert.match(lifecycle,/revoke select on public.player_history_imports/);
assert.equal((lifecycle.match(/last_demand_at >= now\(\)-interval '14 days'/g)||[]).length,4);
assert.match(lifecycle,/create or replace function private.continue_external_match_import/i);
assert.match(lifecycle,/create or replace function public.claim_external_match_import/i);
assert.doesNotMatch(lifecycle,/delete from public.player_external_match_facts/);

// P1 #199: A 200 is not evidence of a changed match archive. The Edge
// function may return queued:false (rate limit), queued:true/stored:0
// (no source cards), or a bounded count of actually persisted match cards.
assert.deepEqual(historyImportOutcome({queued:false,reason:"rate_limited"}),
 {acknowledged:true,changed:false});
assert.deepEqual(historyImportOutcome({queued:true,stored:0}),
 {acknowledged:true,changed:false});
assert.deepEqual(historyImportOutcome({queued:true,stored:2}),
 {acknowledged:true,changed:true});
for(const invalid of [null,{},[],{queued:true},{queued:true,stored:"2"},
 {queued:true,stored:-1},{queued:true,stored:121},{queued:"true",stored:1}]){
 assert.equal(historyImportOutcome(invalid),null);
}
// Exercise the REAL browser client function in a closed VM: no real Supabase,
// no source network calls, no personal data. Failed responses must release the
// local 15-minute throttle; a valid skipped response must not dispatch.
const start=bridge.indexOf("const sourceCheckAt=new Map();");
const end=bridge.indexOf("// Following, backup restoration",start);
assert.ok(start>0&&end>start,"Source import client function must exist");
const responseQueue=[
 {ok:false,status:502,json:async()=>({error:"source_import_unavailable"})},
 {ok:true,json:async()=>({queued:false,reason:"server_throttled"})},
 {ok:true,json:async()=>({queued:true,stored:3})},
 {ok:true,json:async()=>({queued:true,stored:0})},
 {ok:true,json:async()=>({queued:true,stored:"bad"})},
 {ok:true,json:async()=>({queued:true,stored:1})}
];
const requests=[],events=[];
const sandbox=vm.createContext({
 Date,Map,PUBLIC_KEY:"synthetic-key",historyImportOutcome,
 allowed:()=>true,
 window:{
  badmintonAppAccess:{allowed:true,getAccessToken:async()=>"synthetic-member-token"},
  dispatchEvent:e=>events.push(e.detail)
 },
 CustomEvent:class{constructor(type,config){this.type=type;this.detail=config.detail}},
 fetch:async(url,options)=>{requests.push({url,options});return responseQueue.shift()},
 console:{warn(){}}
});
vm.runInContext(bridge.slice(start,end),sandbox,{filename:"history-import-client.js"});
const invoke=id=>vm.runInContext("requestIndividualMatches("+JSON.stringify(id)+")",sandbox);
await invoke("99-100001"); // HTTP 502: throttle must clear
assert.equal(requests.length,1);
await invoke("99-100001"); // immediate retry, successful but skipped
assert.equal(requests.length,2,"A 502 must NOT enforce a 15-minute retry penalty");
assert.equal(events.length,0,"A skipped job is not a match update");
await invoke("99-100001"); // cooldown after VALID server acknowledgement
assert.equal(requests.length,2,"A valid no-op response must respect local throttle");
await invoke("99-100002"); // actual 3 persisted cards -> one update
assert.equal(requests.length,3);
assert.equal(events.length,1);
assert.equal(events[0].playerId,"99-100002");
await invoke("99-100003"); // 0 newly persisted cards -> no event
assert.equal(events.length,1);
await invoke("99-100004"); // malformed JSON payload: release cooldown
assert.equal(events.length,1);
await invoke("99-100004"); // retry works; 1 new card -> event
assert.equal(requests.length,6);
assert.equal(events.length,2);
assert.equal(events[1].playerId,"99-100004");
assert.deepEqual(JSON.parse(requests[5].options.body),{dbv_id:"99-100004"});

console.log("History-on-open: validated public IDs, bounded source requests, no automatic registration on follow, onboarding or startup.");
