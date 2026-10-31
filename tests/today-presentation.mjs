import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {kickoffLabel,todayMatchRows,directMeetingReport,todayDisplayRows} from "../scripts/today-presentation.mjs";
const now=Date.parse("2026-10-19T19:00:00+02:00");
const url="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupMeetingReport?group=40175&meeting=384845";
const scheduled={id:"team:fixture-1",entity:"team",kind:"scheduled",
 when:"2026-10-19T18:00:00Z",detail:"SpVgg. Mössingen IV – TSV Gomaringen",
 sourceUrl:url,name:"SpVgg. Mössingen IV",status:"Heute angesetzt",source:"nuLiga",
 checkedAt:"2026-10-19T17:43:00Z"};
assert.equal(kickoffLabel(scheduled.when,now),"20:00 Uhr");
assert.equal(kickoffLabel("2026-10-19T23:00:00Z",now),"");
assert.equal(kickoffLabel("2026-10-19",now),"");
assert.equal(kickoffLabel("2026-10-19T20:00:00",now),"");
assert.equal(kickoffLabel("invalid",now),"");
assert.deepEqual(todayMatchRows([scheduled],{now}),[
 {id:scheduled.id,kickoff:"20:00 Uhr",pairing:scheduled.detail,url}
]);
const scheduleUrl="https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupPage?championship=SW+26%2F27&group=40175";
assert.equal(directMeetingReport(scheduleUrl),"","Group overviews must not impersonate live scores");
assert.equal(directMeetingReport("https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupMeetingReport?group=40175"),"","Missing meeting ID");
assert.equal(directMeetingReport(url),url);
assert.deepEqual(todayMatchRows([{...scheduled,sourceUrl:scheduleUrl}],{now}),[
 {id:scheduled.id,kickoff:"20:00 Uhr",pairing:scheduled.detail,url:""}
],"Display the match, but NEVER link a static nuLiga table as live results");
assert.deepEqual(todayMatchRows([{...scheduled,kind:"result"}],{now}),[
 {id:scheduled.id,kickoff:"20:00 Uhr",pairing:scheduled.detail,url}
],"Published per-match results are navigable on the same day");
assert.equal(todayMatchRows([{...scheduled,sourceUrl:"https://evil.example/report"}],{now}).length,0);
assert.equal(todayMatchRows([{...scheduled,detail:"Gast – "}],{now}).length,0);
assert.equal(todayMatchRows([{...scheduled,when:"2026-10-18T18:00:00Z"}],{now}).length,0);
for(const kind of ["cancelled","postponed","unverified-result","unknown"]){
 assert.equal(todayMatchRows([{...scheduled,kind}],{now}).length,0,
  "No unsupported or cancelled current match display: "+kind);
}
assert.equal(todayMatchRows([{...scheduled,entity:"player"}],{now}).length,0,
 "Player without sourced pairing and kickoff must not invent either");
assert.equal(todayMatchRows([scheduled,scheduled],{now}).length,1);
assert.equal(todayMatchRows(Array.from({length:50},(_,i)=>({...scheduled,id:String(i)})),
 {now,limit:999}).length,12,"Bounded projection, no additional network requests");
const s=await readFile("scripts/today-presentation.mjs","utf8");
assert.doesNotMatch(s,/fetch\(|setInterval\(|setTimeout\(|localStorage|supabase\.co/);
console.log("Today compact display: Berlin scheduled kickoff, pairing and trusted official link only.");


// F08 v205: existing verified evidence may show players and teams together.
// No player kickoff/sets invented; no unknown source becomes a clickable card.
const playerId="05-070879";
const validLiveUrl="https://badhub.de/spieler/"+playerId+"/live";
const player={
 id:"player:"+playerId+":synthetic",entity:"player",playerId,
 kind:"playing",status:"Spielt gerade",name:"Synthetische Person",
 detail:"Synthetisches Turnier",source:"Badhub",sourceUrl:validLiveUrl,
 checkedAt:new Date(now-15000).toISOString(),score:""
};
const combined=todayDisplayRows([scheduled,player],{now});
assert.equal(combined.length,2);
assert.deepEqual(combined.map(x=>x.entity),["player","team"],
 "Verified running player must precede scheduled fixture");
assert.deepEqual(combined.map(x=>x.status),["Spielt gerade","Heute angesetzt"]);
assert.equal(combined[0].url,validLiveUrl);
assert.equal(combined[0].kickoff,"","Badhub player view never invents start time");
assert.equal(combined[0].score,"","Unverified sets must not become a live score");
assert.equal(combined[1].kickoff,"20:00 Uhr");
assert.equal(combined[1].pairing,scheduled.detail);
assert.equal(combined[1].name,"SpVgg. Mössingen IV",
 "Team badge must name the followed, officially identified squad instead of generic Mannschaft");
const todayClient=await readFile("today-in-action.js","utf8");
assert.match(todayClient,/isPlayer\?event\.label:event\.name\|\|event\.label/,
 "Today card must render the sourced squad identity with fallback");
assert.equal(combined[1].url,url);
assert.equal(combined[1].score,"");
assert.equal(todayDisplayRows([player,player],{now}).length,1,"One sourced event, one card");
assert.equal(todayDisplayRows([scheduled,player],{now,limit:1}).length,1);
assert.equal(todayDisplayRows([scheduled,player],{now,limit:999}).length,2);
assert.equal(todayDisplayRows([{...player,kind:"next"}],{now})[0].status,"Spiel aufgerufen");
assert.equal(todayDisplayRows([{...player,kind:"tournament"}],{now})[0].status,"Turniertag gemeldet");
const officialEnd={...scheduled,kind:"result",status:"Ergebnis veröffentlicht",score:"5:3"};
assert.deepEqual(todayDisplayRows([officialEnd],{now}).map(x=>[x.status,x.score]),
 [["Ergebnis veröffentlicht","5:3"]]);
assert.equal(todayDisplayRows([{...officialEnd,score:""}],{now}).length,0,
 "Result with no evidenced score must not be published");
assert.equal(todayDisplayRows([{...officialEnd,score:"5:<script>"}],{now}).length,0);
assert.equal(todayDisplayRows([{...scheduled,sourceUrl:scheduleUrl}],{now})[0].url,"",
 "Static group page must not be a fake match report");
for(const [kind,status] of [["cancelled","Abgesagt"],["postponed","Verlegt"],
 ["unverified-result","Ergebnis noch nicht belegt"]]){
 const row=todayDisplayRows([{...scheduled,kind,score:"12:8"}],{now})[0];
 assert.equal(row.status,status);
 assert.equal(row.url,"");
 assert.equal(row.score,"");
}
for(const injected of [
 {...player,sourceUrl:validLiveUrl+"?redirect=evil"},
 {...player,sourceUrl:"https://badHub.de/spieler/"+playerId+"/live"},
 {...player,playerId:"05-000000"},
 {...player,source:"unknown"},
 {...player,kind:"scored",score:"21:19"},
 {...player,checkedAt:new Date(now-120001).toISOString()},
 {...player,checkedAt:new Date(now+1).toISOString()},
 {...player,checkedAt:new Date(now-86400000).toISOString()},
 {...player,checkedAt:"yesterday"},
 {...player,name:""}
]){
 assert.equal(todayDisplayRows([injected],{now}).length,0,
  "Unverified/stale/forged player event must not appear as LIVE");
}
assert.equal(todayDisplayRows([{...scheduled,sourceUrl:"https://evil.example/nuLiga"}],{now}).length,0);
assert.equal(todayDisplayRows([{...scheduled,kind:"playing"}],{now}).length,0,
 "nuLiga does not supply a verified running team state");
assert.equal(todayDisplayRows([player],{now:now+121000}).length,0,
 "A suspended iPhone tab must never display an expired running card");
assert.equal(todayDisplayRows([player],{now:NaN}).length,0);
console.log("F08 v205: mixed source-verified Today cards, no phantom live, TTL, links, results: OK");
