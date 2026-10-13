/** One in-memory, server-authorized trophy source shared by Home and Historie.
 * No personal results in public JSON, service workers, persistent caches or logs. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./supabase-read.mjs";
import {getPrivateSession} from "../private-invites.js";
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOLD_MS=30000;
const states=new Map();
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
function acceptedIdsFor(player){
 const bindings=read("schmetterlinge.acceptedPlayerInviteBindings.v1",{});
 const values=read("schmetterlinge.acceptedPlayerInvite.v3",[]);
 const ids=Array.isArray(values)?values:(values?.id?[values.id]:[]);
 return ids.filter(id=>UUID.test(id)&&bindings?.[id]===player).slice(-20);
}
async function rpc(name,args,session){
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),6500);
 try{
  const r=await fetch(SUPABASE_ROOT+"rpc/"+name,{
   method:"POST",cache:"no-store",signal:abort.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
   body:JSON.stringify(args)
  });
  if(!r.ok){
   if([400,401,403].includes(r.status))return null;
   if(r.status===404)throw Error("private trophy endpoint not installed");
   throw Error("service unavailable");
  }
  return r.json();
 }finally{clearTimeout(timeout)}
}
function validResult(response,player){
 if(!response||response.player_dbv_id!==player||!Array.isArray(response.results))return null;
 const list=response.results.filter(r=>r?.playerId===player&&r.verified===true&&
  typeof r.id==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&
  Number.isInteger(r.place)&&r.place>=1&&r.place<=4&&
  typeof r.source?.url==="string"&&r.source.url.startsWith("https://")).slice(0,200);
 return {state:"ready",results:list,coverage:"partial_not_exhaustively_verified"};
}
export function trophySnapshot(player){
 if(!DBV.test(String(player||"")))return {state:"protected",results:[]};
 const state=states.get(player);
 if(!state)return {state:"loading",results:[]};
 if(Date.now()-state.checkedAt>HOLD_MS&&!state.pending)return {state:"loading",results:[]};
 return {state:state.state,results:state.results||[],coverage:state.coverage};
}
function announce(player){
 window.dispatchEvent(new CustomEvent("badminton:private-trophies-updated",{detail:{playerId:player}}));
}
export function requestPrivateTrophies(player,{force=false}={}){
 if(!DBV.test(String(player||"")))return Promise.resolve();
 const previous=states.get(player);
 if(previous?.pending)return previous.pending;
 if(!force&&previous&&Date.now()-previous.checkedAt<HOLD_MS)return Promise.resolve();
 // A session is never created just for displaying Home or Historie.
 const pending=(async()=>{
  try{
   const session=await getPrivateSession(false);
   if(!session){states.set(player,{state:"protected",results:[],checkedAt:Date.now()});return;}
   let response=await rpc("private_owner_trophies_read",{p_player_dbv_id:player},session);
   let validated=validResult(response,player);
   if(!validated){
    for(const id of acceptedIdsFor(player)){
     response=await rpc("private_player_trophies_read",{p_invitation_id:id},session);
     validated=validResult(response,player);
     if(validated)break;
    }
   }
   states.set(player,{...(validated||{state:"protected",results:[]}),checkedAt:Date.now()});
  }catch{
   states.set(player,{state:"unavailable",results:[],checkedAt:Date.now()});
  }finally{announce(player)}
 })();
 states.set(player,{state:"loading",results:[],checkedAt:Date.now(),pending});
 return pending;
}
export function clearPrivateTrophyCache({refresh=true}={}){
 const current=[...states.keys()];
 states.clear();
 if(refresh)current.forEach(player=>{requestPrivateTrophies(player,{force:true})});
}
if(typeof document!=="undefined"){
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)clearPrivateTrophyCache()});
 window.addEventListener("badminton:private-player-revoked",()=>clearPrivateTrophyCache());
 window.addEventListener("pagehide",()=>states.clear());
}
