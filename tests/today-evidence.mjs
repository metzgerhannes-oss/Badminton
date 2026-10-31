import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 berlinDay,sourceMatchDay,followedTeamSelection,fixtureReadPath,
 todayTeamEvents,todayPlayerEvents,unconfirmedPlans,todayEvidence,hasVerifiedMatchToday
} from "../scripts/today-evidence.mjs";
import {TEAM_FOLLOWS_KEY} from "../scripts/team-directory-utils.mjs";

const today="2026-10-19";
const now=Date.parse("2026-10-19T11:00:00.000Z");
const teamUrl="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=2026";
const reportUrl="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubMeetingReport?match=1";
const a={id:"nuliga:10777:2026-27:1",follow_key:"nuliga:10777:1",club_name:"SpVgg Test",team_label:"1",season:"2026/27",
 source_url:teamUrl,source_checked_at:"2026-10-18T20:00:00Z"};
const b={id:"nuliga:10777:2026-27:2",follow_key:"nuliga:10777:2",club_name:"SpVgg Test",team_label:"2",season:"2026/27",
 source_url:teamUrl};
const fixture=(extra={})=>({
 id:"fixture-1",team_id:a.id,match_date:"2026-10-19T12:00:00+02:00",
 home_team:"SpVgg Test 1",away_team:"Gäste 1",home_score:null,away_score:null,
 status:"scheduled",source_url:reportUrl,source_checked_at:"2026-10-19T10:50:00Z",...extra
});
const own={id:"05-070879",name:"Spieler Eigen"};
const friend={id:"05-070880",name:"Spieler Gefolgt"};
const freshPlayer=(extra={})=>({
 dbv_id:friend.id,provider:"Badhub",
 source_url:"https://badhub.de/spieler/"+friend.id+"/live",
 checked_at:new Date(now-30000).toISOString(),
 payload:{upcoming:[],past:[],entries:[],tournament:{name:"Testevent U15"},
  running:{court:"Feld 1",sets:[[21,19]]}},...extra
});
assert.equal(TEAM_FOLLOWS_KEY,"schmetterlinge-followed-teams-v1");
assert.equal(berlinDay(now),today);
assert.equal(berlinDay("not a date"),"");
assert.equal(sourceMatchDay("2026-10-18T23:30:00Z"),today,
 "UTC midnight must be converted to Berlin local time");
assert.equal(sourceMatchDay("2026-10-19T23:30:00Z"),"2026-10-20");
assert.equal(sourceMatchDay("2026-10-19"),today);
assert.equal(sourceMatchDay("invalid"),"");
assert.equal(sourceMatchDay("2026-02-31"),"");
assert.equal(sourceMatchDay("2026-10-19T12:00:00"),"",
 "Naive ISO times cannot be treated as sourced instants");
const selection=followedTeamSelection([a.follow_key,b.follow_key,b.follow_key], [a,b]);
assert.equal(selection.teams.length,2);
assert.equal(selection.remaining,0);
assert.equal(selection.unknown,0);
assert.equal(followedTeamSelection(["nuliga:10777:3"],[a]).unknown,1);
const plan=fixtureReadPath([a,b],{day:today});
assert.ok(plan.startsWith("league_fixtures?"));
const params=new URLSearchParams(plan.split("?")[1]);
assert.deepEqual(params.getAll("match_date"),[
 "gte.2026-10-18T00:00:00.000Z","lt.2026-10-20T00:00:00.000Z"
]);
assert.equal(params.get("team_id"),'in.("nuliga:10777:2026-27:1","nuliga:10777:2026-27:2")');
assert.equal(params.get("limit"),"96");
const manyTeams=Array.from({length:30},(_,i)=>({id:String(i+1)}));
const boundedQuery=new URLSearchParams(fixtureReadPath(manyTeams,{day:today,limit:999}).split("?")[1]);
assert.equal(boundedQuery.get("team_id").split(",").length,12,"No caller may exceed the 12-team read budget");

assert.equal(fixtureReadPath([a,b],{day:"not-a-day"}),null);
assert.equal(fixtureReadPath([{id:"1;DROP TABLE"}],{day:today}),null);
assert.equal(fixtureReadPath([{id:"nuliga:10777:2026-27:1;drop"}],{day:today}),null);
const persistedModel=await readFile("database/team-league-public-directory-v95.sql","utf8");
assert.match(persistedModel,/\('nuliga:10777:2026-27:1'/,
 "The actual public team IDs are source-prefixed strings, not UUIDs");
assert.match(persistedModel,/league_fixtures \(/);
assert.match(persistedModel,/source_checked_at timestamptz not null/);
assert.ok(params.get("select").includes("source_checked_at"));

const scheduled=todayTeamEvents({today,teams:[a],fixtures:[fixture(),fixture({id:"tomorrow",match_date:"2026-10-20T12:00:00+02:00"})]});
assert.equal(scheduled.length,1);
assert.equal(scheduled[0].status,"Heute angesetzt");
assert.equal(scheduled[0].kind,"scheduled");
assert.equal(scheduled[0].name,"SpVgg Test 1",
 "The sourced team label remains available to the presentation");
assert.equal(scheduled[0].score,"");
assert.equal(scheduled[0].checkedAt,"2026-10-19T10:50:00Z","Use fixture last-check, not unrelated team-directory last-check");
for(const [status,expected] of [["cancelled","Abgesagt"],["postponed","Verlegt"]]){
 const rows=todayTeamEvents({today,teams:[a],fixtures:[fixture({status})]});
 assert.equal(rows[0].status,expected);
 assert.notEqual(rows[0].kind,"playing");
}
assert.equal(todayTeamEvents({today,teams:[a],fixtures:[fixture({status:"running",home_score:3,away_score:2})]}).length,0,
 "Non-authoritative 'running' field must not become live");
let result=todayTeamEvents({today,teams:[a],fixtures:[fixture({status:"finished",home_score:5,away_score:3})]});
assert.equal(result[0].status,"Ergebnis veröffentlicht");
assert.equal(result[0].score,"5:3");
result=todayTeamEvents({today,teams:[a],fixtures:[fixture({status:"finished",home_score:null,away_score:3})]});
assert.equal(result[0].status,"Ergebnis noch nicht belegt");
assert.equal(result[0].score,"");
assert.equal(todayTeamEvents({today,teams:[a],fixtures:[fixture({source_url:"https://example.org/evil"})]}).length,0);
assert.equal(todayTeamEvents({today,teams:[a],fixtures:[fixture({team_id:"999"})]}).length,0);
assert.equal(todayTeamEvents({today,teams:[a,b],fixtures:[fixture(),fixture()]}).length,1);

const opposingTeam={...b,id:"nuliga:10892:2026-27:1",follow_key:"nuliga:10892:1",
 club_name:"Gäste",team_label:"1",source_url:teamUrl};
// Source-key deduplication must not depend on a unique database row ID.
// nuLiga may produce a row for BOTH followed sides of the same exact match.
const firstSide=fixture({id:"home-side",team_id:a.id,
 source_checked_at:"2026-10-19T10:00:00Z"});
const secondSide=fixture({id:"away-side",team_id:opposingTeam.id,
 source_checked_at:"2026-10-19T10:05:00Z"});
let mirrored=todayTeamEvents({today,teams:[a,opposingTeam],
 fixtures:[firstSide,secondSide]});
assert.equal(mirrored.length,1,"One official match, not one tile per followed team");
assert.equal(mirrored[0].id,"team:away-side",
 "Choose latest provider-checked source row for the same official fixture");
mirrored=todayTeamEvents({today,teams:[a,opposingTeam],
 fixtures:[{...firstSide,source_checked_at:"2026-10-19T10:06:00Z"},{
  ...secondSide,source_checked_at:"2026-10-19T10:05:00Z",status:"finished",
  home_score:5,away_score:3}]});
assert.equal(mirrored.length,1);
assert.equal(mirrored[0].kind,"scheduled",
 "Do not prefer an older finished claim over a newer provider check");
assert.equal(mirrored[0].score,"");
for(const variant of [
 {...secondSide,match_date:"2026-10-19T13:00:00+02:00"},
 {...secondSide,away_team:"Andere Gäste 1"},
 {...secondSide,source_url:"https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=other"}
]){
 assert.equal(todayTeamEvents({today,teams:[a,opposingTeam],
  fixtures:[firstSide,variant]}).length,2,
 "Never collapse distinct source URL, kickoff or opponent just by town/club");
}

let player=todayPlayerEvents({today,groups:{own:[own],friends:[friend]},rows:[freshPlayer()],now});
assert.equal(player.events.length,1);
assert.equal(player.events[0].kind,"playing");
assert.equal(player.events[0].status,"Spielt gerade");
assert.equal(player.events[0].source,"Badhub");
player=todayPlayerEvents({today,groups:{friends:[friend]},rows:[freshPlayer({
 checked_at:new Date(now-121000).toISOString()
})],now});
assert.equal(player.events.length,0,"Stale running snapshots must not claim LIVE");
player=todayPlayerEvents({today,groups:{friends:[friend]},rows:[freshPlayer({
 source_url:"https://notbadhub.example/live"
})],now});
assert.equal(player.events.length,0,"Forged Badhub source not accepted");
player=todayPlayerEvents({today,groups:{friends:[friend]},rows:[freshPlayer({
 payload:{upcoming:[],past:[],entries:[],tournament:null,running:null}
})],now});
assert.equal(player.events.length,0,"A fresh idle snapshot is not participation");
const bookmarks=[{id:"t-1",name:"Vorgemerktes Event",startDate:today,playerId:own.id},
 {id:"t-1",name:"Vorgemerktes Event",startDate:today,playerId:own.id},
 {id:"private",name:"Privates Event",startDate:today,playerId:friend.id}];
const plans=unconfirmedPlans({today,bookmarks,ownProfiles:[own]});
assert.equal(plans.length,1);
assert.equal(plans[0].kind,"unconfirmed");
assert.match(plans[0].status,/Teilnahme nicht bestätigt/);
const mixed=todayEvidence({
 now,groups:{own:[own],friends:[friend]},
 follows:[a.follow_key],teams:[a,b],
 fixtures:[fixture()],snapshots:[freshPlayer()],bookmarks
});
assert.equal(mixed.events.length,2);
assert.equal(mixed.planned.length,1);
assert.equal(mixed.events.filter(x=>x.entity==="player").length,1);
assert.equal(mixed.events.filter(x=>x.entity==="team").length,1);
assert.ok(!mixed.events.some(x=>x.id.startsWith("plan:")));
for(const event of mixed.events){
 assert.ok(event.sourceUrl.startsWith("https://"));
 assert.ok(["Badhub","nuLiga"].includes(event.source));
 assert.notEqual(event.status,"Mannschaftsspiel läuft");
}
// The red 'Heute' tab means a match, NOT an unconfirmed tournament/day.
assert.equal(hasVerifiedMatchToday([]),false);
assert.equal(hasVerifiedMatchToday([{entity:"team",kind:"scheduled"}]),true);
assert.equal(hasVerifiedMatchToday([{entity:"player",kind:"next"}]),true);
assert.equal(hasVerifiedMatchToday([{entity:"player",kind:"playing"}]),true);
for(const kind of ["cancelled","postponed","result","unverified-result","tournament","unconfirmed"]){
 assert.equal(hasVerifiedMatchToday([{entity:kind==="tournament"?"player":"team",kind}]),false,
  kind+" alone must not display red Heute");
}
assert.equal(hasVerifiedMatchToday(mixed.events),true);
assert.equal(hasVerifiedMatchToday(todayEvidence({
 now,groups:{own:[own],friends:[friend]},follows:[a.follow_key],teams:[a],
 fixtures:[fixture({status:"cancelled"})],snapshots:[]
}).events),false);
assert.equal(hasVerifiedMatchToday(todayEvidence({
 now,groups:{own:[own]},follows:[],teams:[],fixtures:[],snapshots:[],bookmarks
}).events),false,"A tournament bookmark must not display red Heute");
const src=await readFile("scripts/today-evidence.mjs","utf8");
assert.doesNotMatch(src,/\bfetch\s*\(|\bsetInterval\s*\(|\bsetTimeout\s*\(|\blocalStorage\b|supabase\.co|\bPOST\b|\bDELETE\b|\bwriteFile\s*\(/,
 "Evidence calculations must not poll, write or trigger network calls");
console.log("#298 Paket A: sourced date/score/status, Badhub freshness, dedupe, unconfirmed bookmarks, bounded reads.");
