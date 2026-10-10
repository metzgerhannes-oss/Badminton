import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {computeExternalStats,sourceMatchYears,importCompleteness} from "../scripts/external-match-stats.mjs";
const fixture=(id,discipline,side,win,year=2026,extra={})=>({
 source_key:id,source_url:"https://badhub.de/bwbv/turnier.php?id=123",
 category:"tournament",discipline,player_side:side,winning_side:win,
 match_year:year,match_date:year+"-09-10",opponent_names:["Spieler Beispiel"],
 games:win===1?[[21,10],[21,18]]:[[10,21],[18,21]],...extra
});
const data=[
 fixture("a","Einzel",1,1),
 fixture("b","Einzel",1,2,2026,{games:[[10,21],[17,21]]}),
 fixture("c","Doppel",2,1,2025,{games:[[21,15],[21,17]]}),
 fixture("d","Mixed",2,2,2025,{games:[[17,21],[13,21]]}),
 fixture("e","Einzel",1,1,2026,{source_url:"https://evil.test/bwbv/turnier.php?id=123"}),
 fixture("f","Einzel",1,1,2026,{games:[[21,10],[19,21]]}),
 fixture("z","Einzel",1,1),fixture("z","Einzel",1,1)
];
assert.deepEqual(sourceMatchYears(data),["2026","2025"]);
const total=computeExternalStats(data);
assert.equal(total.total,4);
assert.equal(total.wins,2);
assert.equal(total.losses,2);
assert.equal(total.excluded,3);
assert.equal(total.rate,50);
assert.equal(computeExternalStats(data,{discipline:"Einzel"}).total,2);
assert.equal(computeExternalStats(data,{discipline:"Einzel"}).wins,1);
assert.equal(computeExternalStats(data,{year:"2025"}).total,2);
assert.equal(computeExternalStats(data,{year:"2026"}).total,2);
assert.equal(computeExternalStats(data,{discipline:"Mixed"}).total,1);
assert.equal(computeExternalStats([]).rate,null);
assert.match(importCompleteness({verified_count:608,cursor_offset:240,rejected_count:69},240),/240 von 608/);
assert.match(importCompleteness({verified_count:42,cursor_offset:42,rejected_count:20},42),/20 unklare/);
const discrepancy=importCompleteness({status:"partial",verified_count:608,cursor_offset:240,rejected_count:20},42);
assert.match(discrepancy,/42 von 608/,"Read-back rows, not cursor, determine the visible amount");
assert.match(discrepancy,/240 Quellkarten verarbeitet/);
assert.doesNotMatch(discrepancy,/240 von 608/,"Cursor cannot impersonate stored match count");
assert.match(importCompleteness({verified_count:42,cursor_offset:42,status:"error"},0),/0 von 42/);
assert.match(importCompleteness({verified_count:42,cursor_offset:42,status:"error"},0),/nicht erfolgreich/);
assert.match(importCompleteness(null,5),/5 Quellkarten/);
assert.match(importCompleteness({verified_count:40,cursor_offset:40,status:"complete"},42),/42 Quellkarten/);
assert.match(importCompleteness({verified_count:42,cursor_offset:42,status:"complete",last_finished_at:"2026-10-10T12:00:00Z"},42),/Letzter dokumentierter Importversuch/);
const [stats,html,history,claim,cron,sw]=await Promise.all([
 "stats.js","index.html","history-demand.js","database/external-match-import.sql",
 "database/external-match-cron.sql","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(stats,/player_external_match_facts/);
assert.match(stats,/player_match_observations/);
assert.match(stats,/officialCount\.total===0&&external\.length>0/,
 "Never aggregate external and official matches into one total");
assert.match(stats,/computeExternalStats/);
assert.match(stats,/importCompleteness/);
assert.match(stats,/last_finished_at/);
assert.match(stats,/lastLoadedAt/);
assert.match(stats,/visibilitychange/);
assert.match(stats,/Badhub · Einzelbelege/);
assert.match(stats,/matchAvailability\(\{officialFailed:officialError,externalFailed:externalError\}\)/);
assert.match(stats,/lookup\.hidden=!validId/);
assert.match(stats,/Sätze aus Spielersicht/);
assert.match(stats,/badminton:external-matches-updated/);
assert.match(stats,/fetchProfile\(selected,true\)/);
assert.match(html,/id="match-stats-source"/);
assert.doesNotMatch(history,/registerSavedProfiles\(\)/);
assert.match(history,/const historyOpen=\(\)=>location\.hash==="#historie"/);
assert.match(history,/const accepted=enqueue\?await requestDemand\(id,signal\):true/);
assert.match(history,/const status=await callStatus\(id,signal\)/);
assert.doesNotMatch(history,/await requestNew\(id,signal\)/);
assert.match(history,/sourceCheckAt=new Map\(\)/);
assert.doesNotMatch(history,/registerSavedProfiles|enqueueQuietly/);
assert.match(cron,/interval '7 days'/);
assert.match(cron,/status='awaiting_source'/);
assert.match(claim,/cursor_now:=0/,"Weekly refresh must revisit new matches at start of sorted source");
assert.match(claim,/status_now in \('complete','partial'\)/);
assert.match(sw,/schmetterlinge-shell-v59/);
console.log("Real-source Home stats with on-demand Historie: verified source separation, filters, no doubles and weekly refresh.");
