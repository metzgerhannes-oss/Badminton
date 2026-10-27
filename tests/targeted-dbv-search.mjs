import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validDbvLookup,searchDbvIdentities,IDENTITY_SEARCH_LIMIT,dbvRetryDelayMs} from "../scripts/targeted-player-search.mjs";
import {searchInvitationPlayers} from "../scripts/invitation-search.mjs";
assert.equal(IDENTITY_SEARCH_LIMIT,12);
for(const x of ["","  ","ab","a"," -- ","%","*","?"]){
 assert.equal(validDbvLookup(x),"","Reject empty, too-short and wildcard lookups");
}
assert.equal(validDbvLookup("  Mössingen  "),"Mössingen");
assert.equal(validDbvLookup("99-000001"),"99-000001");
const oldWindow=globalThis.window;
globalThis.window={badmintonAppAccess:{allowed:false,getAccessToken:async()=>null}};
let deniedCalls=0;
await assert.rejects(()=>searchDbvIdentities("Probe",{fetchImpl:async()=>{deniedCalls++;throw Error("guest network")}}),
 error=>error.status===403);
assert.equal(deniedCalls,0,"Guest cannot call identity RPC");
globalThis.window={badmintonAppAccess:{allowed:true,getAccessToken:async()=>"synthetic-family-jwt"}};
let calls=0;
const records=Array.from({length:24},(_,i)=>({
 dbv_id:"99-"+String(i).padStart(6,"0"),name:"Probe "+i,
 club:"SpVgg Mössingen",age_class:"U13",association:"BAW-Baden-Württemberg"
}));
const result=await searchDbvIdentities("  Probe  ",{
 ageClass:"U13",club:"SpVgg Mössingen",association:"BAW-Baden-Württemberg",
 fetchImpl:async(url,request)=>{
  calls++;
  assert.match(url,/\/rpc\/search_dbv_player_identity$/);
  assert.equal(request.method,"POST");
  assert.equal(request.cache,"no-store");
  assert.equal(request.headers.Accept,"application/json");
  assert.equal(request.headers.Authorization,"Bearer synthetic-family-jwt");
  const body=JSON.parse(request.body);
  assert.deepEqual(body,{
   p_query:"Probe",p_age_class:"U13",p_club:"SpVgg Mössingen",
   p_association:"BAW-Baden-Württemberg"
  });
  return {ok:true,json:async()=>records};
 }
});
assert.equal(calls,1);
assert.equal(result.length,12);
assert.equal(result[0].id,"99-000000");
assert.equal(result[0].birthYear,undefined,"Public RPC never returns personal birth year");
assert.deepEqual(await searchDbvIdentities("a",{fetchImpl:()=>{throw Error("Must not make request")}}),[]);
const sql=await readFile("database/targeted_dbv_identity_search_v133.sql","utf8");
assert.match(sql,/SECURITY DEFINER/);
assert.match(sql,/SET search_path = ''/);
assert.match(sql,/LIMIT 12/);
assert.match(sql,/verified_at IS NOT NULL/);
assert.match(sql,/last_ranking_week IS NOT NULL/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.search_dbv_player_identity/);
assert.doesNotMatch(sql,/GRANT SELECT ON public\.players/i,"Do not open the full DBV table");
const library=await readFile("library.js","utf8");
const invitation=await readFile("scripts/invitation-search.mjs","utf8");
assert.match(library,/rosterDenied=true/);
assert.match(library,/loadIdentityDirectory/);
assert.match(invitation,/searchDbvIdentities/);
// F03/#327: honor a server 429, cap Retry-After and never evade quotas via a
// public GitHub catalog fallback. The local cooldown is only a courtesy guard.
assert.equal(dbvRetryDelayMs("2",0),2000);
assert.equal(dbvRetryDelayMs("999999",0),300000);
assert.equal(dbvRetryDelayMs("invalid",0),30000);
assert.equal(dbvRetryDelayMs("Thu, 01 Jan 1970 00:00:08 GMT",6000),2000);
let throttledRequests=0;
await assert.rejects(()=>searchDbvIdentities("Probe",{
 fetchImpl:async()=>{throttledRequests++;return {
  ok:false,status:429,headers:{get:key=>key==="retry-after"?"2":null}
 }}
}),error=>error.status===429&&error.retryAfterMs>0);
assert.equal(throttledRequests,1);
await assert.rejects(()=>searchDbvIdentities("Probe",{
 fetchImpl:async()=>{throttledRequests++;throw Error("Must not refetch in cooldown")}
}),error=>error.status===429);
assert.equal(throttledRequests,1,"Cooldown prevents immediate duplicate lookup");
const localPlayer={id:"99-000123",name:"Probe Beispiel",club:"Testverein",ageClass:"U13"};
const saved=await searchInvitationPlayers("Probe",{
 savedCandidates:[localPlayer],fetchImpl:async()=>{throttledRequests++;throw Error("No fallback during 429")}
});
assert.equal(saved.source,"rate-limited-device");
assert.equal(saved.players.length,1,"On-device player remains selectable");
const unknown=await searchInvitationPlayers("Nichtgespeichert",{
 fetchImpl:async()=>{throttledRequests++;throw Error("No catalog bypass during cooldown")}
});
assert.equal(unknown.source,"rate-limited");
assert.equal(unknown.players.length,0);
assert.equal(throttledRequests,1,"Rate limit never triggers public backup file GETs");

if(oldWindow===undefined)delete globalThis.window;
else globalThis.window=oldWindow;
console.log("P0 #417 scoped DBV lookup: guest denied before network, verified family JWT, 12-hit cap and 429 cooldown");
