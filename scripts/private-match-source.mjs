/** Private, in-memory Badhub match cards for independently verified own
 * players or explicitly accepted v2 player links. No local follow grants access. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./supabase-read.mjs";
import {getPrivateSession} from "../private-invites.js";
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_MS=30000, PAGE_SIZE=100, MAX_ROWS=10000;
const states=new Map();
const read=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||"null")??fallback}catch{return fallback}};
let active="",revision=0;
function acceptedIdsFor(player){
 const bindings=read("schmetterlinge.acceptedPlayerInviteBindings.v1",{});
 const raw=read("schmetterlinge.acceptedPlayerInvite.v3",[]);
 const values=Array.isArray(raw)?raw:(raw?.id?[raw.id]:[]);
 return values.filter(id=>typeof id==="string"&&UUID.test(id)&&bindings?.[id]===player).slice(-20);
}
function announce(player){
 window.dispatchEvent(new CustomEvent("badminton:private-matches-updated",{detail:{playerId:player}}));
}
export function matchArchiveSnapshot(player){
 if(!DBV.test(String(player||"")))return {state:"protected",rows:[]};
 const value=states.get(player);
 if(!value)return {state:"loading",rows:[]};
 if(Date.now()-value.checkedAt>CACHE_MS&&!value.pending)return {state:"loading",rows:[]};
 return {state:value.state,rows:value.rows||[],coverage:"partial_not_exhaustively_verified"};
}
async function rpc(session,name,args){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
   method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,
    "Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify(args)
  });
  if([400,401,403].includes(response.status))return null;
  if(!response.ok)throw Error("archive read temporarily unavailable");
  return response.json();
 }finally{clearTimeout(timeout)}
}
function validPage(data,player,offset){
 return data&&data.dbv_id===player&&data.kind==="match_card"&&data.scope_version===2&&
  data.offset===offset&&Number.isSafeInteger(data.total)&&data.total>=0&&data.total<=MAX_ROWS&&
  Array.isArray(data.entries)&&data.entries.length<=PAGE_SIZE;
}
function safeRows(rows,player){
 return rows.filter(row=>row&&row.dbv_id===player&&typeof row.source_key==="string"&&
  typeof row.source_url==="string"&&row.source_url.startsWith("https://")&&
  /^\d{4}-\d\d-\d\d$/.test(row.match_date||"")&&
  [1,2].includes(row.player_side)&&[1,2].includes(row.winning_side)&&
  Array.isArray(row.games)&&Array.isArray(row.opponent_names));
}
async function readAll(session,endpoint,base,player){
 let first=await rpc(session,endpoint,{...base,p_kind:"match_card",p_offset:0,p_limit:PAGE_SIZE});
 if(!first)return null;
 if(!validPage(first,player,0))throw Error("invalid archive response");
 const all=[...first.entries],total=first.total;
 for(let offset=PAGE_SIZE;offset<total;offset+=PAGE_SIZE){
  const next=await rpc(session,endpoint,{...base,p_kind:"match_card",p_offset:offset,p_limit:PAGE_SIZE});
  if(!validPage(next,player,offset)||next.total!==total||
     next.entries.length!==Math.min(PAGE_SIZE,total-offset))throw Error("archive page changed");
  all.push(...next.entries);
 }
 if(all.length!==total)throw Error("incomplete archive page");
 return safeRows(all,player);
}
export function requestPrivateMatches(player,{force=false}={}){
 if(!DBV.test(String(player||"")))return Promise.resolve();
 active=player;
 const old=states.get(player);
 if(old?.pending)return old.pending;
 if(!force&&old&&Date.now()-old.checkedAt<CACHE_MS)return Promise.resolve();
 const ticket=++revision;
 states.set(player,{state:"loading",rows:[],checkedAt:Date.now()});
 announce(player);
 const pending=(async()=>{
  try{
   const session=await getPrivateSession(false);
   if(ticket!==revision)return;
   if(!session){states.set(player,{state:"protected",rows:[],checkedAt:Date.now()});return}
   // Server checks the independent grant for this exact player on every page.
   let rows=await readAll(session,"private_player_owner_archive_read",
     {p_player_dbv_id:player},player);
   if(!rows){
    for(const id of acceptedIdsFor(player)){
     rows=await readAll(session,"private_player_archive_read",
       {p_invitation_id:id},player);
     if(rows)break;
    }
   }
   if(ticket!==revision)return;
   states.set(player,{state:rows?"ready":"protected",rows:rows||[],checkedAt:Date.now()});
  }catch{
   if(ticket===revision)states.set(player,{state:"unavailable",rows:[],checkedAt:Date.now()});
  }finally{
   if(ticket===revision)announce(player);
  }
 })();
 states.set(player,{state:"loading",rows:[],checkedAt:Date.now(),pending});
 return pending;
}
export function clearPrivateMatchArchive({refresh=true}={}){
 revision++;
 const previously=[...states.keys()];
 states.clear();
 previously.forEach(announce);
 if(refresh&&active)requestPrivateMatches(active,{force:true});
}
if(typeof document!=="undefined"){
 window.addEventListener("badminton:profile-change",e=>{
  const next=String(e.detail?.playerId||"");
  if(next&&next!==active){
   revision++;states.clear();active=next;requestPrivateMatches(next);
  }
 });
 window.addEventListener("badminton:private-player-revoked",()=>clearPrivateMatchArchive());
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)clearPrivateMatchArchive()});
 window.addEventListener("pagehide",()=>clearPrivateMatchArchive({refresh:false}));
}
