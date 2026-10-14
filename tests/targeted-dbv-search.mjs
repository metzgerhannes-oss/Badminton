import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validDbvLookup,searchDbvIdentities,IDENTITY_SEARCH_LIMIT} from "../scripts/targeted-player-search.mjs";
assert.equal(IDENTITY_SEARCH_LIMIT,12);
for(const x of ["","  ","ab","a"," -- ","%","*","?"]){
 assert.equal(validDbvLookup(x),"","Reject empty, too-short and wildcard lookups");
}
assert.equal(validDbvLookup("  Mössingen  "),"Mössingen");
assert.equal(validDbvLookup("05-071969"),"05-071969");
let calls=0;
const records=Array.from({length:24},(_,i)=>({
 dbv_id:"05-"+String(i).padStart(6,"0"),name:"Probe "+i,
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
assert.equal(result[0].id,"05-000000");
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
console.log("Scoped official DBV identity lookup: explicit query, 12-hit cap, no birth year, no anonymous table read");
