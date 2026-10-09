import assert from "node:assert/strict";
import {upcomingTournaments,validDay} from "../scripts/upcoming-tournaments.mjs";

const today="2026-10-09";
const tournaments=[
 {id:"past",name:"Altes Turnier",playerId:"05-070879",startDate:"2026-09-30",endDate:"2026-10-01"},
 {id:"ongoing",name:"Laufendes Turnier",playerId:"05-070879",startDate:"2026-10-08",endDate:"2026-10-10"},
 {id:"first",name:"Nächstes Turnier",playerId:"05-070879",startDate:"2026-10-12",endDate:""},
 {id:"later",name:"Späteres Turnier",playerId:"05-070879",startDate:"2026-12-02",endDate:""},
 {id:"second",name:"Übernächstes Turnier",playerId:"all",startDate:"2026-11-15",endDate:""},
 {id:"other",name:"Anderes Kind",playerId:"local-charlotte",startDate:"2026-10-10",endDate:""},
 {id:"no-date",name:"Ohne Datum",playerId:"05-070879",startDate:"",endDate:""},
 {id:"duplicate",name:"Gemeinsam",playerId:"all",startDate:"2026-10-20",endDate:""},
 {id:"duplicate",name:"Philipps Buchung",playerId:"05-070879",startDate:"2026-10-20",endDate:""}
];
assert.deepEqual(upcomingTournaments(tournaments,"05-070879",today).map(x=>x.id),["ongoing","first","duplicate"]);
assert.equal(upcomingTournaments(tournaments,"05-070879",today).length,3,"Never display more than three");
assert.equal(upcomingTournaments(tournaments,"05-070879",today)[2].name,"Philipps Buchung","Prefer player-specific entry");
assert.deepEqual(upcomingTournaments(tournaments,"05-070879","2026-10-11").map(x=>x.id),["first","duplicate","second"]);
assert.deepEqual(upcomingTournaments(tournaments,"local-charlotte",today).map(x=>x.id),["other","duplicate","second"]);
assert.deepEqual(upcomingTournaments([tournaments[1]],"05-070879","2026-10-10").map(x=>x.id),["ongoing"],"Ending day is inclusive");
assert.deepEqual(upcomingTournaments([tournaments[1]],"05-070879","2026-10-11"),[],"A finished tournament must disappear");
assert.deepEqual(upcomingTournaments([tournaments[1]],"other-id",today),[],"Do not expose the wrong player's tournaments");
assert.deepEqual(upcomingTournaments(tournaments,"05-070879",today,{limit:2}).map(x=>x.id),["ongoing","first"]);
assert.deepEqual(upcomingTournaments(tournaments,"05-070879",today,{limit:99}).length,3);
assert.deepEqual(upcomingTournaments([{id:"x",playerId:"all",name:"",startDate:"2026-02-30"}],"x",today),[]);
assert.equal(validDay("2026-02-30"),false);
assert.equal(validDay("2026-10-09"),true);
assert.equal(validDay("2026-10-9"),false);
assert.deepEqual(upcomingTournaments(null,"05-070879",today),[]);
console.log("Upcoming tournament tests passed: next three, player filter, active date range, sorting and duplicate IDs.");
