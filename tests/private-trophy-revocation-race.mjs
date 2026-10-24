import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

// Execute the real browser module with isolated synthetic dependencies.
// No production Supabase requests, user records, browser storage or tokens.
const source=(await readFile("scripts/private-trophy-source.mjs","utf8"))
 .replace(/^import .*;\r?\n/gm,"")
 .replace(/^export function /gm,"function ")
 +"\nglobalThis.__trophy={requestPrivateTrophies,trophySnapshot,clearPrivateTrophyCache};";
const player="99-000001";
const proof={player_dbv_id:player,scope:"app_archive",results:[{
 id:"fixture-1",playerId:player,verified:true,date:"2026-10-01",place:1,
 source:{url:"https://example.invalid/proof"}
}]};
const ok={ok:true,status:200,json:async()=>proof};
const denied={ok:false,status:403,json:async()=>({message:"revoked"})};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({fetchImpl,getSession=async()=>({access_token:"synthetic"}),onEvent=()=>{}}){
 const context={SUPABASE_ROOT:"https://example.invalid/rest/v1/",
  PUBLIC_KEY:"synthetic",fetch:fetchImpl,getPrivateSession:getSession,
  loadPlayerCopy:()=>null,localStorage:{getItem:()=>null},
  window:{badmintonAppAccess:{allowed:true},dispatchEvent:onEvent},
  CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts?.detail;}},
  AbortController,JSON,Date,Error,Promise,setTimeout,clearTimeout};
 vm.runInNewContext(source,vm.createContext(context),{filename:"private-trophy-source.mjs"});
 return context.__trophy;
}

// A late successful response must not recreate private trophies after revoke.
{
 let finish,requests=0;
 const api=harness({fetchImpl:()=>{
  requests++;
  return new Promise(resolve=>{finish=resolve;});
 }});
 const pending=api.requestPrivateTrophies(player);
 await tick();
 assert.equal(requests,1,"one synthetic read started");
 api.clearPrivateTrophyCache({refresh:false});
 finish(ok);
 await pending;
 assert.notEqual(api.trophySnapshot(player).state,"ready",
  "late pre-revocation response cannot repopulate the cache");
}

// Refresh can finish with a denial before an older successful request returns.
{
 let finish,requests=0;
 const api=harness({fetchImpl:()=>{
  requests++;
  return requests===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve(denied);
 }});
 const old=api.requestPrivateTrophies(player);
 await tick();
 api.clearPrivateTrophyCache();
 await tick();
 assert.equal(api.trophySnapshot(player).state,"protected",
  "new denied response is authoritative after revocation");
 finish(ok);
 await old;
 assert.equal(api.trophySnapshot(player).state,"protected",
  "older successful response cannot override the newer denial");
}

// If the session resolves after pagehide/revoke, do not send any RPC at all.
{
 let resume,requests=0;
 const api=harness({
  getSession:()=>new Promise(resolve=>{resume=resolve;}),
  fetchImpl:async()=>{requests++;return ok;}
 });
 const pending=api.requestPrivateTrophies(player);
 api.clearPrivateTrophyCache({refresh:false});
 resume({access_token:"synthetic"});
 await pending;
 assert.equal(requests,0,"invalidated session must not initiate an RPC");
 assert.notEqual(api.trophySnapshot(player).state,"ready");
}
console.log("F03: stale private trophies cannot reappear after revocation, refresh or pagehide.");

// F05: a revoked private trophy view must be told immediately to redraw,
// without waiting for a refresh RPC to resolve or fail.
{
 const observed=[];
 const api=harness({fetchImpl:async()=>ok,onEvent:event=>observed.push(event.type)});
 await api.requestPrivateTrophies(player);
 assert.equal(api.trophySnapshot(player).state,"ready");
 observed.length=0;
 api.clearPrivateTrophyCache({refresh:false});
 assert.deepEqual(observed,["badminton:private-trophies-updated"],
  "Revocation must notify Home and Historie synchronously");
 assert.notEqual(api.trophySnapshot(player).state,"ready");
}

// A syntactically successful but malformed/overlong authorized response is an
// unavailable source, never a falsely complete empty or truncated trophy list.
for(const invalid of [
 {...proof,results:[{...proof.results[0],date:"invalid-date"}]},
 {...proof,player_dbv_id:"99-000002"},
 {...proof,results:Array.from({length:201},(_,i)=>({...proof.results[0],id:"fixture-"+i}))}
]){
 const api=harness({fetchImpl:async()=>({ok:true,status:200,json:async()=>invalid})});
 await api.requestPrivateTrophies(player);
 assert.equal(api.trophySnapshot(player).state,"unavailable",
  "Invalid source payload must not be rendered as zero trophies");
}
console.log("F05 private trophy: immediate revocation notice and strict source integrity.");
