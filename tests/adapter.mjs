import assert from "node:assert/strict";
import {normalizeAuthorizedFeed,parseDelimited,dateISO,safeLink} from "../scripts/normalize-feed.mjs";
const playerIds=["05-070879"];
const sourceTime="2026-10-09T12:00:00Z";
const tournament={id:"event-1",name:"Testturnier",location:"Mössingen",startDate:"2026-10-09",url:"https://dbv.turnier.de/tournament/test"};
const feed={updatedAt:sourceTime,tournaments:[tournament],matches:[
 {id:"match-1",tournamentId:"event-1",discipline:"Jungeneinzel U11",scheduledAt:"2026-10-09T14:30:00+02:00",court:"4",status:"called",players:["Philipp Metzger","Gegner"],playerIds:["05-070879","05-000001"],score:""},
 {id:"match-2",tournamentId:"event-1",discipline:"Jungeneinzel U11",scheduledAt:"2026-10-09T14:00:00+02:00",status:"finished",players:["Andere","Andere"],playerIds:["05-888888","05-999999"],score:"21:15, 21:17"}
]};
const json=normalizeAuthorizedFeed(JSON.stringify(feed),{allowedIds:playerIds});
assert.equal(json.connection,"connected");
assert.equal(json.updatedAt,sourceTime);
assert.deepEqual(json.tournaments.map(t=>t.id),["event-1"]);
assert.deepEqual(json.matches.map(m=>m.id),["match-1"],"No unrelated youth matches may be published");
assert.equal(json.matches[0].scheduledAt,"2026-10-09T12:30:00.000Z");
assert.equal(json.matches[0].status,"called");
const csv=[
 "\uFEFFmatchId;tournamentId;tournamentName;tournamentLocation;tournamentDate;discipline;scheduledAt;court;status;players;playerIds;score;url",
 'm-1;t-1;"Jugend; Cup";Mössingen;2026-10-09;Jungeneinzel U11;2026-10-09T15:30:00+02:00;5;Läuft;"Philipp Metzger | Gegner";"05-070879 | 05-888888";;https://dbv.turnier.de/tournament/test',
 "m-2;t-1;Jugendcup;Mössingen;2026-10-09;Jungeneinzel U11;2026-10-09T16:30:00+02:00;;Geplant;Andere | Gegner;05-000999;;"
].join("\r\n");
assert.equal(parseDelimited(csv)[0].tournamentName,"Jugend; Cup");
const csvFeed=normalizeAuthorizedFeed(csv,{format:"csv",allowedIds:playerIds,updatedAt:sourceTime});
assert.deepEqual(csvFeed.matches.map(m=>m.id),["m-1"]);
assert.equal(csvFeed.matches[0].status,"live");
assert.equal(csvFeed.matches[0].court,"5");
assert.equal(csvFeed.tournaments[0].name,"Jugend; Cup");
assert.equal(dateISO("2026-10-09T14:30:00+02:00"),"2026-10-09T12:30:00.000Z");
assert.equal(safeLink("javascript:alert(1)"),"");
assert.throws(()=>dateISO("2026-10-09T14:30:00"),/UTC offset/);
assert.throws(()=>normalizeAuthorizedFeed(JSON.stringify(feed),{allowedIds:[]}),/allowlist/);
assert.throws(()=>normalizeAuthorizedFeed(JSON.stringify({...feed,matches:[{...feed.matches[0],status:"unknown"}]}),{allowedIds:playerIds}),/status/);
assert.throws(()=>normalizeAuthorizedFeed(JSON.stringify({...feed,matches:[feed.matches[0],feed.matches[0]]}),{allowedIds:playerIds}),/Duplicate/);
console.log("Authorized feed adapters passed: JSON, CSV, offsets, allowlist, URLs, statuses.");
