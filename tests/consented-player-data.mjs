import assert from "node:assert/strict";
import {KEY,cleanMatch,cleanTrophy,savePlayerCopy,loadPlayerCopy,deletePlayerCopy} from "../scripts/consented-player-data.mjs";
const player="99-111111",other="99-222222",store=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
const match={dbv_id:player,source_key:"one",source_url:"https://dbv.turnier.de/match",
 match_date:"2026-10-12",player_side:1,winning_side:2,
 opponent_names:["Gegner"],games:[[21,14],[15,21],[21,19]],secret_token:"should-not-copy"};
const medal={id:"t1",playerId:player,verified:true,place:2,date:"2026-10-11",event:"Turnier",
 source:{url:"https://dbv.turnier.de/medal"},private_token:"should-not-copy"};
assert.equal(cleanMatch({...match,dbv_id:other},player),null);
assert.equal(cleanTrophy({...medal,place:5},player),null);
assert.equal(cleanTrophy({...medal,verified:false},player),null);
const many=Array.from({length:115},(_,i)=>({...match,source_key:"match-"+i}));
const saved=savePlayerCopy(player,{matches:many,trophies:[medal,medal]},storage,"2026-10-14T11:00:00.000Z");
assert.equal(saved.matches.length,115,"Do not revive 30-match restriction");
assert.equal(saved.trophies.length,1);
assert.equal(loadPlayerCopy(player,storage).trophies[0].place,2);
assert.equal(loadPlayerCopy(other,storage),null);
assert.ok(!storage.get(KEY).includes("should-not-copy"),"Only sanctioned fields in local snapshot");
assert.ok(!storage.get(KEY).includes("invitation"),"No private access tokens/IDs in copy");
assert.equal(deletePlayerCopy(player,storage),true);
assert.equal(loadPlayerCopy(player,storage),null);
console.log("Consented local data copy: full paginated source, deduplication, identity and no authorization material OK");
