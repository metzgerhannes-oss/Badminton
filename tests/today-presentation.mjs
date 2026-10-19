import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {kickoffLabel,todayMatchRows,directMeetingReport} from "../scripts/today-presentation.mjs";
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
