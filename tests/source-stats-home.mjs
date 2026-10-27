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

// Previously imported contradictory knockout cards must be quarantined in
// Home, Statistik and Historie even when the importer is already fixed.
const knockout=(id,competition,event,round,year=2026)=>fixture(
 id,"Einzel",1,1,year,{source_key:"tournament:"+competition+":"+event+":"+round+":"+id,
  competition_id:competition,event,round_label:round,
  source_url:"https://badhub.de/bwbv/turnier.php?id="+competition});
const historic=[
 knockout("semifinal-a","4184","JE U15","Halbfinale"),
 knockout("semifinal-b","4184","JE U15","Halbfinale"),
 knockout("final-a","4184","JE U15","Finale"),
 knockout("independent","4190","JE U15","Finale"),
 knockout("group-a","5200","JE U13","Gruppe A"),
 knockout("group-b","5200","JE U13","Gruppe A")
];
const checked=computeExternalStats(historic);
assert.equal(checked.total,3,"Contradictory event contributes no W/L; independent and group matches remain");
assert.equal(checked.wins,3);
assert.equal(checked.quarantined,3,"Every affected event card is held without deleting evidence");
assert.equal(checked.excluded,3);
assert.equal(checked.details.length,3);
assert.equal(computeExternalStats(historic,{discipline:"Einzel",year:"2026"}).total,3);
assert.equal(computeExternalStats(historic,{year:"2025"}).total,0);
const unrelatedLeague=fixture("league:independent","Einzel",1,1,2026,{
 category:"league",event:"JE U15",round_label:"Halbfinale",
 source_url:"https://badhub.de/bwbv/begegnung.php?id=99"});
assert.equal(computeExternalStats([...historic,unrelatedLeague]).total,4,
 "League matches must not be quarantined as tournament knockout rounds");
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
const first=importCompleteness({verified_count:608,cursor_offset:240,rejected_count:69},240);
assert.match(first,/240 belegte Quellkarten/);
assert.match(first,/Quellenlauf: 608/);
assert.doesNotMatch(first,/240 von 608/,"Never divide lifetime facts by a source-run count");
assert.match(importCompleteness({verified_count:42,cursor_offset:42,rejected_count:20},42),
 /20 unklare.*protokollierten Quellenlauf/);
const discrepancy=importCompleteness({status:"partial",verified_count:608,
 cursor_offset:240,rejected_count:20},42);
assert.match(discrepancy,/42 belegte Quellkarten/);
assert.match(discrepancy,/Quellenlauf: 608/);
assert.match(discrepancy,/Importposition: 240/);
assert.match(discrepancy,/nicht als vollständig bestätigt/);
assert.doesNotMatch(discrepancy,/42 von 608|240 von 608/);
const missing=importCompleteness({verified_count:42,cursor_offset:42,status:"error"},0);
assert.match(missing,/Noch keine Einzelmatchbelege/);
assert.match(missing,/nicht erfolgreich/);
assert.doesNotMatch(missing,/0 von 42/);
assert.match(importCompleteness(null,5),/5 belegte Quellkarten/);
const retained=importCompleteness({verified_count:40,cursor_offset:40,status:"complete"},42);
assert.match(retained,/42 belegte Quellkarten/);
assert.match(retained,/Quellenlauf: 40/);
assert.doesNotMatch(retained,/älter oder unvollständig/,
 "More retained cards than one batch cannot prove an outdated status");
assert.match(importCompleteness({verified_count:42,cursor_offset:42,status:"complete",
 last_finished_at:"2026-10-10T12:00:00Z"},42),/Letzter dokumentierter Importversuch/);
const [stats,html,history,claim,cron,sw]=await Promise.all([
 "stats.js","index.html","history-demand.js","database/external-match-import.sql",
 "database/external-match-cron.sql","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(stats,/player_external_match_facts/);
assert.doesNotMatch(stats,/player_match_observations/,"Home must not query the restricted official observations table");
assert.match(stats,/officialCount\.total===0&&external\.length>0/,
 "Never aggregate external and official matches into one total");
assert.match(stats,/computeExternalStats/);
assert.match(stats,/stats\.quarantined/,"Home must disclose quarantined knockout cards");
assert.match(await readFile("external-matches.js","utf8"),/all\.quarantined/,
 "Historie must disclose the same excluded source evidence");
assert.match(stats,/importCompleteness/);
assert.match(await readFile("scripts/supabase-read.mjs","utf8"),/last_finished_at/);
assert.match(stats,/lastLoadedAt/);
assert.match(stats,/visibilitychange/);
assert.match(stats,/Bisher belegte Spiele/);
assert.match(stats,/matchAvailability\(\{officialFailed:officialError,externalFailed:externalError\}\)/);
assert.match(stats,/lookup\.hidden=!validId/);
assert.match(stats,/awaitingMatchSource\?"https:\/\/turniere\.badminton\.de\/ranking"/);
assert.match(stats,/Spieler erkannt, aber noch keine auswertbaren Einzelmatches importiert/);
const dashboard=await readFile("dashboard.js","utf8");
assert.match(dashboard,/home-trophy-latest/);
assert.match(dashboard,/results\.filter\(r=>\[1,2,3,4\]\.includes\(Number\(r\.place\)\)\)/,"Home trophy preview only includes confirmed top-four placements");
assert.match(dashboard,/DBV-Rangliste: /);
assert.match(dashboard,/rankCounts\.length===1/);
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
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
console.log("Real-source Home stats with on-demand Historie: verified source separation, filters, no doubles and weekly refresh.");
