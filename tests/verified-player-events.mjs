import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {VERIFIED_PLAYER_EVENTS,validVerifiedPlayerEvent,verifiedPlayerEvents,verifiedRosterEvents}
 from "../scripts/verified-player-events.mjs";
import {todayEvidence,hasVerifiedMatchToday} from "../scripts/today-evidence.mjs";
import {todayDisplayRows} from "../scripts/today-presentation.mjs";

const playerId="05-067866";
const day="2026-11-07",tomorrow="2026-11-08";
const event=VERIFIED_PLAYER_EVENTS.find(x=>x.playerId===playerId);
assert.ok(event,"source-backed event registered for the exact DBV player ID");
assert.equal(validVerifiedPlayerEvent(event),true);
assert.equal(event.tournamentId,"836C93F3-7635-420B-B314-DEDB60884AB2");
assert.equal(event.tournamentUrl,"https://dbv.turnier.de/tournament/"+event.tournamentId);
// Protect against a wrong UUID that happens to be internally self-consistent.
// The exact official calendar row must agree on source ID, tournament URL,
// dates, location and youth groups (not the distinct SW O19 in Moessingen).
const snapshot=JSON.parse(await readFile("data/dbv-calendar.json","utf8"));
const official=snapshot.entries.filter(row=>row.source_key==="dbv-calendar-44606");
assert.equal(official.length,1,"Official DBV calendar ID must be unique");
assert.equal(official[0].event_url,event.tournamentUrl);
assert.equal(official[0].start_date,event.startDate);
assert.equal(official[0].end_date,event.endDate);
assert.match(official[0].title,/Südostdeutsche Meisterschaften U13-U19/);
assert.equal(official[0].location_text,"Augsburg");
assert.ok(official[0].age_groups.includes("U13"));
const different=snapshot.entries.find(row=>row.source_key==="dbv-calendar-44347");
assert.ok(different,"Separate Südwürttembergische O19 calendar item exists");
assert.notEqual(event.tournamentUrl,different.event_url,"Never send Südost users to Südwürttemberg O19");
assert.equal(verifiedPlayerEvents(playerId,day,{currentOnly:true}).length,1);
assert.equal(verifiedPlayerEvents(playerId,tomorrow,{currentOnly:true}).length,1);
assert.equal(verifiedPlayerEvents(playerId,"2026-11-06",{currentOnly:true}).length,0);
assert.equal(verifiedPlayerEvents(playerId,"2026-11-09").length,0);
assert.equal(verifiedPlayerEvents("05-000001",day,{currentOnly:true}).length,0);
assert.equal(verifiedPlayerEvents("nonsense",day).length,0);
assert.equal(verifiedPlayerEvents(playerId,"invalid").length,0);
assert.equal(verifiedRosterEvents({friends:[{id:"05-000001"},{id:playerId},{id:playerId}]},day).length,1);
assert.equal(verifiedRosterEvents({friends:[{id:"05-000001"}]},day).length,0);
assert.equal(validVerifiedPlayerEvent({...event,tournamentId:"00000000-0000-0000-0000-000000000000"}),false,
 "Never map event from name/town alone or an unrelated UUID");
assert.equal(validVerifiedPlayerEvent({...event,tournamentUrl:"https://badminton.example/turnier"}),false);
assert.equal(validVerifiedPlayerEvent({...event,evidenceUrl:"https://evil.example/"}),false);
assert.equal(validVerifiedPlayerEvent({...event,startDate:"2026-11-08",endDate:"2026-11-07"}),false);

const now=Date.parse("2026-11-07T06:00:00.000Z");
const model=todayEvidence({now,groups:{own:[],friends:[{id:playerId,name:"Léona Plaisant"}]},
 snapshots:[],follows:[],teams:[],fixtures:[],bookmarks:[]});
assert.equal(model.events.length,1);
assert.equal(model.events[0].entity,"player");
assert.equal(model.events[0].kind,"announced");
assert.equal(model.events[0].status,"Teilnahme vom Verein angekündigt");
assert.equal(model.events[0].sourceUrl,event.tournamentUrl);
assert.equal(hasVerifiedMatchToday(model.events),false,
 "A club announcement must NEVER trigger the red LIVE/next-match navigation");
const cards=todayDisplayRows(model.events,{now});
assert.equal(cards.length,1);
assert.equal(cards[0].kind,"announced");
assert.equal(cards[0].url,event.tournamentUrl);
assert.equal(cards[0].status,"Turnierteilnahme angekündigt");
assert.equal(cards[0].name,"Léona Plaisant");
assert.equal(cards[0].kickoff,"");
assert.equal(cards[0].score,"");
assert.equal(todayDisplayRows([{...model.events[0],sourceUrl:"https://example.com/hijack"}],{now}).length,0);
assert.equal(todayDisplayRows([{...model.events[0],evidenceUrl:"https://example.com/forged"}],{now}).length,0);
assert.equal(todayDisplayRows(model.events,{now:Date.parse("2026-11-09T06:00:00Z")}).length,0);
assert.equal(todayEvidence({now,groups:{friends:[]},snapshots:[]}).events.length,0,
 "Only followed/owned exact DBV IDs are allowed into personal Today.");

const dashboard=await readFile("dashboard.js","utf8");
assert.match(dashboard,/verifiedPlayerEvents\(selection,today\)/);
assert.match(dashboard,/Badhub/,"An ID-derived third-party fallback must be labeled as such");
assert.doesNotMatch(dashboard,/Bitte in den Freundeseinstellungen einen offiziellen Profil-Link ergänzen/,
 "No manual URL hunt for an otherwise identified followed player");
const show=await readFile("today-in-action.js","utf8");
assert.match(show,/e\.kind==="announced"/,
 "Local Badhub TTL expiry must not delete a source-backed whole-day announcement");
const shell=await readFile("sw.js","utf8");
assert.match(shell,/scripts\/verified-player-events\.mjs/,
 "The PWA must retain the offline announcement evidence module");
console.log("Verified player event: Nov 7–8, exact ID and UUID, provenance, no forged LIVE, safe fallback.");
