import assert from "node:assert/strict";
import {matchdayOverview,isExplicitNonplayedLiveMatch} from "../scripts/live-radar.mjs";
const id="05-070879",checked_at="2026-10-11T13:00:00Z",now=Date.parse(checked_at);
const row={dbv_id:id,provider:"Badhub",source_url:"https://badhub.de/spieler/"+id+"/live",checked_at,
 payload:{tournament:{name:"C-RLT"},running:{match_id:"m1",class:"HE U11",sets:[[11,8]],is_team1:1},
 next:{queue_position:0},upcoming:[{match_id:"m1",class:"HE U11"},{match_id:"m2",class:"HD U11"},{match_id:"m2",class:"HD U11"}],
 past:[{match_id:"m0",team1_won:true,is_team1:1}],entries:[]}};
const day=matchdayOverview(row,id,now);
assert.equal(day.tournament,"C-RLT");
assert.equal(day.running.match_id,"m1");
assert.equal(day.queue,0);
assert.deepEqual(day.upcoming.map(x=>x.match_id),["m2"],"Deduplicate only by explicit source IDs");
assert.equal(day.pendingCount,2);
assert.equal(day.shownResults,1);
assert.equal(day.hasPublishedGames,true);
assert.equal(matchdayOverview({...row,checked_at:"2026-10-11T12:55:00Z"},id,now),null,"Stale score invalid");
assert.equal(matchdayOverview({...row,source_url:"https://fake.test"},id,now),null);
assert.equal(matchdayOverview({...row,payload:{...row.payload,tournament:null}},id,now),null);
const empty=matchdayOverview({...row,payload:{...row.payload,running:null,next:{queue_position:null},upcoming:[],past:[]}},id,now);
assert.equal(empty.queue,null);
assert.equal(empty.hasPublishedGames,false);
assert.equal(empty.pendingCount,0);
assert.equal(isExplicitNonplayedLiveMatch({status:"BYE"}),true);
assert.equal(isExplicitNonplayedLiveMatch({status:"Rast"}),true);
assert.equal(isExplicitNonplayedLiveMatch({status:"Walkover"}),true);
assert.equal(isExplicitNonplayedLiveMatch({opponent:"Rust",sets:[[21,17],[21,9]]}),false,"Surname Rust is not a bye");
const skip=matchdayOverview({...row,payload:{...row.payload,
 upcoming:[{status:"BYE"},...row.payload.upcoming],past:[{status:"Rast"},...row.payload.past]}},id,now);
assert.equal(skip.shownResults,1,"BYE/Rast cannot count as played results");
assert.equal(skip.pendingCount,2,"BYE cannot become a pending match");
console.log("Matchday overview: sourced current/next/upcoming/past, deduplication and freshness.");
