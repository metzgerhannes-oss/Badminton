import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {eventId,tournamentPath,matchesPath,matchTournament,toMatch,tournamentOverview,
 filterTournament,tournamentCounts} from "../scripts/tournament-live.mjs";

const event="E24DC6EE-152A-454D-B00C-E625B751D7D5",eventUrl="https://dbv.turnier.de/tournament/"+event;
const tournament="11111111-2222-4333-8444-555555555555";
const matchA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",matchB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
assert.equal(eventId(eventUrl),event);
assert.equal(eventId("https://www.turnier.de/tournament/"+event),event);
for(const url of ["http://dbv.turnier.de/tournament/"+event,eventUrl+".evil.test",eventUrl+"/games",
 "https://evil.test/tournament/"+event,"javascript:alert(1)",eventUrl+"?foo=bar"])
 assert.equal(eventId(url),null,"Untrusted tournament URL must not be queried");
assert.equal(tournamentPath("../../etc"),null);
assert.equal(matchesPath(""),null);
assert.ok(tournamentPath(event).startsWith("tournaments?"));
assert.ok(matchesPath(tournament).includes("matches?"));
assert.match(matchesPath(tournament),/tournament_id=eq/);
assert.equal(matchTournament([{id:tournament,source_url:"https://evil.test"},{id:tournament,source_url:eventUrl}],{url:eventUrl})?.source_url,eventUrl);
assert.equal(matchTournament([{id:tournament,source_url:"https://evil.test"}],{url:eventUrl}),null);
const now=Date.parse("2026-10-11T10:00:00Z");
const first={id:matchA,tournament_id:tournament,status:"playing",court:"5",scheduled_at:"2026-10-11T10:00:00Z",
 last_synced_at:"2026-10-11T09:59:25Z",events:{title:"JE U11"},
 match_participants:[{side:1,player_position:1,players:{name:"Philipp"}},{side:2,player_position:1,participant_name:"Gegner"}],
 match_games:[{game_number:1,side1_points:11,side2_points:7},{game_number:2,side1_points:4,side2_points:5}]};
const finished={...first,id:matchB,status:"finished",last_synced_at:"2026-10-11T08:00:00Z",
 match_games:[{game_number:1,side1_points:11,side2_points:9}]};
const rows=tournamentOverview([finished,first,first,{...first,id:"invalid-id"},{...first,id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",tournament_id:"another"}],tournament,now);
assert.equal(rows.length,2);
assert.equal(rows[0].id,matchA);
assert.equal(rows[0].category,"live");
assert.equal(rows[0].label,"Läuft");
assert.deepEqual(rows[0].sets,["11:7","4:5"],"Published score formats must remain unchanged");
assert.equal(rows[1].category,"finished");
assert.deepEqual(rows[1].sets,["11:9"]);
assert.equal(rows[0].side1,"Philipp");
assert.equal(rows[0].side2,"Gegner");
const old=toMatch({...first,last_synced_at:"2026-10-11T09:50:00Z"},now);
assert.equal(old.label,"Stand prüfen");
assert.deepEqual(old.sets,[],"Stale live points must not be shown");
assert.equal(toMatch({...first,match_games:[{game_number:1,side1_points:999,side2_points:4}]},now).sets.length,0);
assert.equal(toMatch({...first,status:"walkover"},now).category,"other","Walkover is not a played match");
assert.deepEqual(toMatch({...first,status:"walkover"},now).sets,[],"Walkover/BYE must never present sets as played");
assert.equal(toMatch({...first,status:"cancelled"},now).label,"Abgesagt");
assert.equal(filterTournament(rows,{status:"finished"}).length,1);
assert.equal(filterTournament(rows,{court:"5"}).length,2);
assert.equal(filterTournament(rows,{court:"3"}).length,0);
assert.deepEqual(tournamentCounts(rows),{live:1,upcoming:0,finished:1,total:2});
assert.equal(tournamentOverview([first],"invalid",now).length,0);

const html=await readFile("index.html","utf8"),js=await readFile("tournament-live.js","utf8"),
 app=await readFile("app.js","utf8"),sw=await readFile("sw.js","utf8");
for(const id of ["tournament-live-select","tournament-live-content","tournament-live-refresh",
 "tournament-court-filter","live-tournament-links"]){
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,"Exactly one event control: "+id);
}
assert.match(html,/tournament-live\.js/);
assert.match(js,/readPublicRows\(tournamentPath\(id\)/);
assert.match(js,/readPublicRows\(matchesPath\(tournament.id\)/);
assert.match(js,/!document\.hidden/);
assert.match(js,/location\.hash/);
assert.match(js,/sourceFresh/);
assert.match(app,/badminton:tournament-bookmarks/);
assert.match(sw,/tournament-live\.js/);
assert.match(js,/window\.badmintonMatchdayMode==="all"/);
assert.match(html,/data-matchday-view="mine"/);
assert.match(html,/data-matchday-view="all"/);
assert.match(sw,/scripts\/tournament-live\.mjs/);
assert.match(js,/selected=e\.currentTarget\.value;items=\[\];status="all";court="all";loadedAt=0;choose\(\);refresh\(\);/,
 "Official DBV link updates immediately on tournament selection even outside LIVE");
console.log("Tournament live: URL provenance, read-only bounded queries, correct sets, stale-score guard, filtering and UI wiring.");
