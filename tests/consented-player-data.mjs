import assert from "node:assert/strict";
import {KEY,cleanMatch,cleanTrophy,savePlayerCopy,loadPlayerCopy,deletePlayerCopy,serializePlayerDataExport} from "../scripts/consented-player-data.mjs";
import {computeExternalStats,sourceMatchYears} from "../scripts/external-match-stats.mjs";
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
const portable=serializePlayerDataExport(player,storage);
const payload=JSON.parse(portable);
assert.equal(payload.format,"schmetterlinge-player-data-export");
assert.equal(payload.playerId,player);
assert.equal(payload.matches.length,115,"Export must keep all cached matches, not just 30");
assert.equal(payload.trophies.length,1);
assert.ok(!portable.includes("should-not-copy"),"Portable data must drop unknown/private fields");
assert.ok(!portable.includes("invitation"),"No invitation credentials in export");
assert.equal(serializePlayerDataExport(other,storage),null,"No export without matching local data");

assert.ok(!storage.getItem(KEY).includes("should-not-copy"),"Only sanctioned fields in local snapshot");
assert.ok(!storage.getItem(KEY).includes("invitation"),"No private access tokens/IDs in copy");

// #198/#188: an offline snapshot is only evidence when every locally stored
// row still satisfies the same verification contract as the consented writer.
// Corrupted or forged storage must not display a Top-4 or a match as verified.
const pristine=storage.getItem(KEY);
for(const damage of [
 item=>{item.trophies[0].verified=false;},
 item=>{item.trophies[0].place=5;},
 item=>{item.trophies[0].source.url="javascript:alert(1)";},
 item=>{item.trophies[0].playerId=other;},
 item=>{item.matches[0].winning_side=3;},
 item=>{item.matches[0].source_url="http://unsafe.invalid";},
]){
 const corrupted=JSON.parse(pristine);
 damage(corrupted[player]);
 storage.setItem(KEY,JSON.stringify(corrupted));
 assert.equal(loadPlayerCopy(player,storage),null,
  "Invalid offline records must not be displayed as verified private results");
}
storage.setItem(KEY,pristine);
const withUnknownFields=JSON.parse(pristine);
withUnknownFields[player].access_token="NEVER-RETURN-LOCAL-SECRET";
withUnknownFields[player].trophies[0].private_token="NEVER-RETURN-LOCAL-SECRET";
storage.setItem(KEY,JSON.stringify(withUnknownFields));
const sanitized=loadPlayerCopy(player,storage);
assert.ok(sanitized&&sanitized.trophies.length===1&&sanitized.matches.length===115);
assert.ok(!JSON.stringify(sanitized).includes("NEVER-RETURN-LOCAL-SECRET"),
 "Offline reader must return allowlisted fields only");
storage.setItem(KEY,pristine);

// Reproduce a real, independently source-verified Badhub card. The local
// round-trip must preserve every field required by the W/L evaluator.
const sourceMatch={
 ...match,source_key:"tournament:proof-123",source_url:"https://badhub.de/bwbv/turnier.php?id=123",
 match_year:2026,category:"tournament",discipline:"Einzel",competition:"Belegtes Turnier",
 event:"U13 Einzel",round_label:"Viertelfinale",source_name:"Badhub",
 source_kind:"third-party-match-card",outcome_evidence:"badhub-scores",
 partner_names:["Partner"],winning_side:1
};
const copied=savePlayerCopy(player,{matches:[sourceMatch],trophies:[]},storage,"2026-10-14T12:05:00.000Z");
assert.equal(copied.matches[0].match_year,2026);
assert.equal(copied.matches[0].source_kind,"third-party-match-card");
assert.equal(copied.matches[0].outcome_evidence,"badhub-scores");
assert.equal(copied.matches[0].round_label,"Viertelfinale");
assert.deepEqual(copied.matches[0].partner_names,["Partner"]);
assert.deepEqual(sourceMatchYears(loadPlayerCopy(player,storage).matches),["2026"]);
const count=computeExternalStats(loadPlayerCopy(player,storage).matches);
assert.equal(count.total,1,"Saved match must remain countable offline");
assert.equal(count.wins,1);
const withoutSets={...sourceMatch,source_key:"tournament:won-without-scores",games:[],
 outcome_evidence:"badhub-bold-dash"};
const noSets=savePlayerCopy(player,{matches:[withoutSets],trophies:[]},storage,"2026-10-14T12:06:00.000Z");
assert.equal(computeExternalStats(noSets.matches).wins,1,"Documented winner without set points remains countable");
const fiveSets={...sourceMatch,source_key:"tournament:five-set-proof",
 games:[[21,17],[17,21],[21,16],[16,21],[21,18]]};
assert.equal(cleanMatch(fiveSets,player).games.length,5,"Never silently cut off two valid source sets");

assert.equal(deletePlayerCopy(player,storage),true);
assert.equal(loadPlayerCopy(player,storage),null);
const {readFile}=await import("node:fs/promises");
const [ui,index,worker,matches,trophies,welcome,app]=await Promise.all([
 "consented-player-data.js","index.html","sw.js","scripts/private-match-source.mjs",
 "scripts/private-trophy-source.mjs","welcome.js","app.js"].map(p=>readFile(p,"utf8")));
assert.match(ui,/requestPrivateMatches\(player,\{force:true\}\)/);
assert.match(ui,/requestPrivateTrophies\(player,\{force:true\}\)/);
assert.match(ui,/Daten jetzt übernehmen/);
assert.match(ui,/id="player-copy-download"/);
assert.match(ui,/serializePlayerDataExport\(target\)/);
assert.match(ui,/application\/json/);
assert.match(ui,/badminton:profile-selected/);
assert.doesNotMatch(ui,/addEventListener\("badminton:profile-change"/);
assert.match(app,/badminton:profile-selected/);
assert.match(ui,/!matchOk&&!trophyOk/,"Protected sources must not produce a new local copy");
assert.match(index,/consented-player-data\.js/);
assert.match(worker,/scripts\/consented-player-data\.mjs/);
assert.match(matches,/coverage:"device_snapshot"/);
assert.match(trophies,/coverage:"device_snapshot"/);
assert.match(welcome,/pendingPlayerDataCopy\.v1/);
console.log("Consented local data copy: full paginated source, deduplication, identity and no authorization material OK");
