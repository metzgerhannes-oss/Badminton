/** One in-memory, server-authorized trophy source shared by Home and Historie.
 * No personal results in public JSON, service workers, persistent caches or logs. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./supabase-read.mjs";
import {getPrivateSession} from "../private-invites.js";
import {loadPlayerCopy} from "./consented-player-data.mjs";
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOLD_MS=30000;
const states=new Map();
// A revoked/changed session invalidates every in-flight private trophy read.
let generation=0;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
function acceptedIdsFor(player){
 const bindings=read("schmetterlinge.acceptedPlayerInviteBindings.v1",{});
 const values=read("schmetterlinge.acceptedPlayerInvite.v3",[]);
 const ids=Array.isArray(values)?values:(values?.id?[values.id]:[]);
 return ids.filter(id=>UUID.test(id)&&bindings?.[id]===player).slice(-20);
}
async function rpc(name,args,session){
 // Cellular Safari can receive a valid HTTP 200 after the old 6.5 s deadline.
  // Keep a bounded timeout without misclassifying slow successful reads as missing results.
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),11000);
 try{
  const r=await fetch(SUPABASE_ROOT+"rpc/"+name,{
   method:"POST",cache:"no-store",signal:abort.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
   body:JSON.stringify(args)
  });
  if(!r.ok){
   // A malformed RPC (400) must surface as unavailable, never as "no trophies".
   if([401,403].includes(r.status))return null;
   if(r.status===404)throw Error("private trophy endpoint not installed");
   throw Error("service unavailable");
  }
  return r.json();
 }finally{clearTimeout(timeout)}
}
function validResult(response,player){
 if(response===null)return null; // Explicitly denied, try another scoped grant.
 if(!response||response.player_dbv_id!==player||!Array.isArray(response.results))
  throw Error("invalid private trophy response");
 // Never silently convert a malformed or truncated authorized archive to zero.
 if(response.results.length>200)throw Error("private trophy result limit exceeded");
 const list=response.results.filter(r=>r?.playerId===player&&typeof r.verified==="boolean"&&
  typeof r.id==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&
  Number.isInteger(r.place)&&r.place>=1&&r.place<=128&&
  typeof r.source?.url==="string"&&r.source.url.startsWith("https://"));
 if(list.length!==response.results.length)throw Error("invalid private trophy row");
 return {state:"ready",results:list,
  coverage:response.scope==="app_archive"?"sourced_placements_partial":"partial_not_exhaustively_verified"};
}
export function trophySnapshot(player){
 if(!DBV.test(String(player||"")))return {state:"protected",results:[]};
 const state=states.get(player);
 if(state?.state==="ready"&&Date.now()-state.checkedAt<=HOLD_MS)
  return {state:"ready",results:state.results||[],coverage:state.coverage};
 // The one-way user-approved local archive is display-only, not a server grant.
 const saved=loadPlayerCopy(player);
 if(Array.isArray(saved?.trophies))
  return {state:"ready",results:saved.trophies,coverage:"device_snapshot",fetchedAt:saved.fetchedAt};
 if(!state||Date.now()-state.checkedAt>HOLD_MS&&!state.pending)return {state:"loading",results:[]};
 return {state:state.state,results:state.results||[],coverage:state.coverage};
}
function announce(player){
 window.dispatchEvent(new CustomEvent("badminton:private-trophies-updated",{detail:{playerId:player}}));
}
export function requestPrivateTrophies(player,{force=false}={}){
 if(!DBV.test(String(player||"")))return Promise.resolve();
 const ticket=generation;
 const previous=states.get(player);
 if(previous?.pending)return previous.pending;
 if(!force&&previous&&Date.now()-previous.checkedAt<HOLD_MS)return Promise.resolve();
 // A session is never created just for displaying Home or Historie.
 const pending=(async()=>{
  try{
   const session=await getPrivateSession(false);
   if(ticket!==generation)return;
   if(!session){states.set(player,{state:"protected",results:[],checkedAt:Date.now()});return;}
   let response=window.badmintonAppAccess?.allowed
    ?await rpc("app_access_trophies_read",{p_player_dbv_id:player},session):null;
   if(ticket!==generation)return;
   let validated=validResult(response,player);
   if(!validated){
    response=await rpc("private_owner_trophies_read",{p_player_dbv_id:player},session);
    if(ticket!==generation)return;
    validated=validResult(response,player);
   }
   if(!validated){
    for(const id of acceptedIdsFor(player)){
     response=await rpc("private_player_trophies_read",{p_invitation_id:id},session);
     if(ticket!==generation)return;
     validated=validResult(response,player);
     if(validated)break;
    }
   }
   if(ticket!==generation)return;
   states.set(player,{...(validated||{state:"protected",results:[]}),checkedAt:Date.now()});
  }catch{
   if(ticket===generation)states.set(player,{state:"unavailable",results:[],checkedAt:Date.now()});
  }finally{if(ticket===generation)announce(player)}
 })();
 states.set(player,{state:"loading",results:[],checkedAt:Date.now(),pending});
 return pending;
}
export function clearPrivateTrophyCache({refresh=true}={}){
 generation++;
 const current=[...states.keys()];
 states.clear();
 // Notify every view immediately: old private results must disappear at revoke,
 // not only after a potentially slow or failed network refresh.
 current.forEach(announce);
 if(refresh)current.forEach(player=>{requestPrivateTrophies(player,{force:true})});
}
if(typeof document!=="undefined"){
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)clearPrivateTrophyCache()});
 window.addEventListener("badminton:private-player-revoked",()=>clearPrivateTrophyCache());
 window.addEventListener("badminton:app-access-granted",()=>clearPrivateTrophyCache());
  window.addEventListener("badminton:local-data-copy-updated",e=>{const id=e.detail?.playerId;if(DBV.test(String(id||"")))announce(id)});
 window.addEventListener("pagehide",()=>clearPrivateTrophyCache({refresh:false}));
}
