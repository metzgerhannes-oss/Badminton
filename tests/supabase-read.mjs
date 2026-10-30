import assert from "node:assert/strict";
import {readPublicRows,readMatchImportProgress,PublicReadError,SUPABASE_ROOT} from "../scripts/supabase-read.mjs";
const query="players?select=dbv_id,name&limit=40&offset=0";
const oldWindow=globalThis.window;
let deniedCalls=0;
globalThis.window={badmintonAppAccess:{allowed:false,getAccessToken:async()=>null}};
await assert.rejects(()=>readPublicRows(query,{fetchImpl:async()=>{deniedCalls++;throw Error("guest network")},retries:0}),
 error=>error instanceof PublicReadError&&error.kind==="restricted"&&error.status===403);
assert.equal(deniedCalls,0,"Guest must not query ANY Supabase REST table");
globalThis.window={badmintonAppAccess:{allowed:true,getAccessToken:async()=>"synthetic-family-jwt"}};
const result={dbv_id:"05-123456",name:"Muster"};
let calls=0,last;
const success=async(url,options)=>{
 calls++;last={url,options};
 return {ok:true,status:200,headers:{get:header=>header==="content-range"?"0-0/1":null},
  json:async()=>[result]};
};
assert.deepEqual(await readPublicRows(query,{fetchImpl:success}),{rows:[result],range:"0-0/1"});
assert.equal(calls,1);
assert.equal(last.url,SUPABASE_ROOT+query);
assert.equal(last.options.method,"GET");
assert.equal(last.options.headers.Authorization,"Bearer synthetic-family-jwt");
assert.equal(last.options.cache,"no-store");
assert.equal(last.options.headers.Prefer,"count=exact");
assert.equal(last.options.signal.aborted,false);


// P0 #417: a successful HTTP response must not publish old-session rows
// after a member logs out, switches accounts or loses the current capability.
function delayedRows(){
 let release,ready;
 const started=new Promise(resolve=>{ready=resolve});
 return {
  started,release:rows=>release(rows),
  fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>null},
   json:()=>new Promise(resolve=>{release=resolve;ready()})})
 };
}
{
 let token="synthetic-original-member";
 const capability={allowed:true,getAccessToken:async()=>token};
 globalThis.window={badmintonAppAccess:capability};
 const delayed=delayedRows();
 const pending=readPublicRows(query,{fetchImpl:delayed.fetchImpl,retries:0});
 await delayed.started;
 token="synthetic-other-member";
 delayed.release([result]);
 await assert.rejects(pending,error=>error instanceof PublicReadError&&
  error.kind==="restricted"&&error.status===403,
  "A rotated/account-switched token cannot accept an old HTTP 200 payload");
}
{
 const capability={allowed:true,getAccessToken:async()=>"synthetic-original-member"};
 globalThis.window={badmintonAppAccess:capability};
 const delayed=delayedRows();
 const pending=readPublicRows(query,{fetchImpl:delayed.fetchImpl,retries:0});
 await delayed.started;
 globalThis.window.badmintonAppAccess={
  allowed:false,getAccessToken:async()=>null
 };
 delayed.release([result]);
 await assert.rejects(pending,error=>error instanceof PublicReadError&&
  error.kind==="restricted"&&error.status===403,
  "A revoked/replaced member capability cannot accept an old HTTP 200 payload");
}
{
 const capability={allowed:true,getAccessToken:async()=>"synthetic-original-member"};
 globalThis.window={badmintonAppAccess:capability};
 const delayed=delayedRows(),controller=new AbortController();
 const pending=readPublicRows(query,{fetchImpl:delayed.fetchImpl,retries:0,signal:controller.signal});
 await delayed.started;
 controller.abort();
 delayed.release([result]);
 await assert.rejects(pending,error=>error instanceof PublicReadError&&
  error.kind==="aborted","Cancellation after HTTP 200 must suppress stale rows");
}
globalThis.window={badmintonAppAccess:{allowed:true,
 getAccessToken:async()=>"synthetic-family-jwt"}};

for(const invalid of ["", "../players?select=*", "https://evil.example/players?select=*",
 "players#fragment","/rest/v1/players?select=*", "players?select=*&x#bad"]){
 await assert.rejects(()=>readPublicRows(invalid,{fetchImpl:success}),error=>
  error instanceof PublicReadError&&error.kind==="invalid");
}
assert.equal(calls,1,"Invalid requests never hit network");

let retries=0;
const retry=async(url,options)=>{
 retries++;
 if(retries===1)return {ok:false,status:503};
 return success(url,options);
};
assert.deepEqual((await readPublicRows(query,{fetchImpl:retry})).rows,[result]);
assert.equal(retries,2,"Transient GET failure retries exactly once");

let authCalls=0;
await assert.rejects(()=>readPublicRows(query,{fetchImpl:async()=>{
 authCalls++;return {ok:false,status:403};
}}),error=>error.kind==="http"&&error.status===403);
assert.equal(authCalls,1,"Do not retry authorization failures");

let malformedCalls=0;
await assert.rejects(()=>readPublicRows(query,{fetchImpl:async()=>{
 malformedCalls++;return {ok:true,status:200,json:async()=>({not:"rows"})};
}}),error=>error.kind==="invalid");
assert.equal(malformedCalls,1,"Do not retry unexpected response shapes");

let disconnected=0;
const controller=new AbortController();controller.abort();
await assert.rejects(()=>readPublicRows(query,{signal:controller.signal,fetchImpl:async()=>{
 disconnected++;return {ok:true};
}}),error=>error.kind==="aborted");
assert.equal(disconnected,0,"An aborted request must not hit network");

await assert.rejects(()=>readPublicRows(query,{timeoutMs:100,retries:0,fetchImpl:async(url,{signal})=>{
 await new Promise((resolve,reject)=>{
  signal.addEventListener("abort",()=>reject(Object.assign(new Error("aborted"),{name:"AbortError"})),{once:true});
 });
}}),error=>error.kind==="timeout");

let networkAttempts=0;
await assert.rejects(()=>readPublicRows(query,{retries:1,fetchImpl:async()=>{
 networkAttempts++;throw new TypeError("Network not available");
}}),error=>error.kind==="offline");
assert.equal(networkAttempts,2);

// P0 #417: all routes, including formerly public ones, are member-only.
globalThis.window={badmintonAppAccess:{allowed:false,getAccessToken:async()=>null}};
// F03: a player-invite guest must never query member-only REST tables.
// The accepted invitation uses its own narrow private RPC instead.
const restricted=[
 "player_external_match_facts?select=dbv_id&limit=1",
 "tournament_placements?select=id&limit=1",
 "player_live_snapshots?select=id&limit=1"
];
let privateReads=0;
const privateFetch=async()=>{privateReads++;return {ok:true,status:200,json:async()=>[]}};
for(const route of restricted){
 await assert.rejects(()=>readPublicRows(route,{fetchImpl:privateFetch,retries:0}),
  error=>error instanceof PublicReadError&&error.kind==="restricted"&&error.status===403);
}
assert.equal(privateReads,0,"No unauthenticated member-only REST request leaves the browser");
const previousWindow=globalThis.window;
try{
 globalThis.window={badmintonAppAccess:{allowed:false,getAccessToken:async()=>null}};
 await assert.rejects(()=>readPublicRows(restricted[0],{fetchImpl:privateFetch,retries:0}),
  error=>error.kind==="restricted");
 assert.equal(privateReads,0,"A player-scoped invite is not global membership");
 globalThis.window={badmintonAppAccess:{allowed:true,getAccessToken:async()=> "synthetic-member-only"}};
 let authorization="";
 await readPublicRows(restricted[0],{fetchImpl:async(_url,options)=>{
  privateReads++;authorization=options.headers.Authorization;
  return {ok:true,status:200,headers:{get:()=>null},json:async()=>[]};
 },retries:0});
 assert.equal(authorization,"Bearer synthetic-member-only");
 assert.equal(privateReads,1,"Only verified members reach member-only REST endpoints");
}finally{
 if(previousWindow===undefined)delete globalThis.window;
 else globalThis.window=previousWindow;
}

// P0 #417: coverage RPC responses are also session-scoped, not only REST GETs.
const originalFetch=globalThis.fetch;
try{
 const syntheticId="99-999999";
 let calls=0;
 globalThis.window={badmintonAppAccess:{allowed:false,getAccessToken:async()=>null}};
 globalThis.fetch=async()=>{calls++;throw Error("denied coverage must not fetch")};
 assert.equal(await readMatchImportProgress(syntheticId),null);
 assert.equal(calls,0,"Denied coverage makes no request");

 let token="synthetic-coverage-member";
 const member={allowed:true,getAccessToken:async()=>token};
 globalThis.window={badmintonAppAccess:member};
 let release,started;
 const bodyStarted=new Promise(resolve=>{started=resolve});
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,SUPABASE_ROOT+"rpc/app_access_player_coverage");
  assert.equal(options.headers.Authorization,"Bearer synthetic-coverage-member");
  return {ok:true,json:()=>new Promise(resolve=>{release=resolve;started()})};
 };
 const stale=readMatchImportProgress(syntheticId);
 await bodyStarted;
 token="synthetic-switched-member";
 release({dbv_id:syntheticId,import_status:"complete",match_cards:3,birth_year:2000});
 assert.equal(await stale,null,"Old-session coverage is not disclosed after token switch");

 const verified={allowed:true,getAccessToken:async()=> "synthetic-coverage-member"};
 globalThis.window={badmintonAppAccess:verified};
 globalThis.fetch=async()=>({ok:true,json:async()=>({
  dbv_id:syntheticId,import_status:"partial",match_cards:7,birth_year:2000
 })});
 assert.deepEqual(await readMatchImportProgress(syntheticId),{
  status:"partial",verified_count:7,last_finished_at:null,birth_year:2000
 },"Verified member can read matching coverage");

 globalThis.fetch=async()=>({ok:true,json:async()=>{
  globalThis.window.badmintonAppAccess={allowed:false,getAccessToken:async()=>null};
  return {dbv_id:syntheticId,import_status:"complete",match_cards:8};
 }});
 assert.equal(await readMatchImportProgress(syntheticId),null,
  "Replacing capability while parsing the RPC response suppresses coverage");

 globalThis.window={badmintonAppAccess:verified};
 const coverageAbort=new AbortController();
 globalThis.fetch=async()=>({ok:true,json:async()=>{
  coverageAbort.abort();
  return {dbv_id:syntheticId,import_status:"complete",match_cards:9};
 }});
 assert.equal(await readMatchImportProgress(syntheticId,{signal:coverageAbort.signal}),null,
  "Aborted coverage never reaches the UI");
}finally{
 globalThis.fetch=originalFetch;
}

if(oldWindow===undefined)delete globalThis.window;
else globalThis.window=oldWindow;
console.log("P0 #417 member-only Supabase REST: guest denied before network, verified JWT and bounded safe GET.");
