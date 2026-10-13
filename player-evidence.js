/** On-demand private player evidence. Accepted v2 invitations only, never local follows.
 * Scoped private responses are held in memory, not written to CacheStorage/localStorage.
 * An old v1 link or a revoked link cannot activate the private trophy/match UI. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";

const KEY="schmetterlinge.acceptedPlayerInvite.v3";
const VALID_ID=/^\d{2}-\d{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE=100;
let requestNumber=0,lastChecked=0,selected="";
const notify=detail=>window.dispatchEvent(new CustomEvent("badminton:private-evidence",{detail}));

function acceptedIds(){
 try{
  const raw=JSON.parse(localStorage.getItem(KEY)||"[]");
  const list=Array.isArray(raw)?raw:(raw?.id?[raw.id]:[]);
  return [...new Set(list.filter(id=>typeof id==="string"&&UUID.test(id)))].slice(-20);
 }catch{return []}
}
async function readPage(session,invitationId,kind,offset){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8500);
 try{
  const response=await fetch(SUPABASE_ROOT+"rpc/private_player_archive_read",{
   method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,
    "Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify({p_invitation_id:invitationId,p_kind:kind,p_offset:offset,p_limit:PAGE})
  });
  if(!response.ok)throw Error("private archive read unavailable: "+response.status);
  return response.json();
 }finally{clearTimeout(timeout)}
}
async function collect(session,invitationId,kind,first,id,ticket){
 const expected=Number(first?.total);
 if(!Number.isSafeInteger(expected)||expected<0||expected>10000||
    first.dbv_id!==id||first.kind!==kind||first.scope_version!==2||
    !Array.isArray(first.entries))throw Error("invalid archive page");
 const all=[...first.entries];
 for(let offset=PAGE;offset<expected;offset+=PAGE){
  if(ticket!==requestNumber)return null;
  const page=await readPage(session,invitationId,kind,offset);
  if(!page||page.dbv_id!==id||page.kind!==kind||page.scope_version!==2||
     page.total!==expected||!Array.isArray(page.entries)||
     page.entries.length!==Math.min(PAGE,expected-offset))throw Error("private grant changed");
  all.push(...page.entries);
 }
 return all.length===expected?all:null;
}
async function load(id){
 const ticket=++requestNumber;
 selected=id;
 lastChecked=Date.now();
 if(!VALID_ID.test(id)){notify({playerId:id,status:"no_player"});return}
 const ids=acceptedIds();
 if(!ids.length){notify({playerId:id,status:"not_connected"});return}
 notify({playerId:id,status:"checking"});
 try{
  // Never create a new technical identity merely to view/follow a player.
  const session=await getPrivateSession(false);
  if(ticket!==requestNumber)return;
  if(!session){notify({playerId:id,status:"no_session"});return}
  for(const invitationId of ids){
   const page=await readPage(session,invitationId,"placement",0);
   if(ticket!==requestNumber)return;
   if(!page||page.dbv_id!==id||page.scope_version!==2)continue;
   const placements=await collect(session,invitationId,"placement",page,id,ticket);
   if(ticket!==requestNumber)return;
   if(!placements)throw Error("placement access unavailable");
   notify({playerId:id,status:"ready",placements,matches:[],matchesLoading:true,coverage:"partial"});
   const firstMatches=await readPage(session,invitationId,"match_card",0);
   if(ticket!==requestNumber)return;
   if(!firstMatches)throw Error("private access revoked");
   const matches=await collect(session,invitationId,"match_card",firstMatches,id,ticket);
   if(ticket!==requestNumber)return;
   if(!matches)throw Error("match access unavailable");
   notify({playerId:id,status:"ready",placements,matches,matchesLoading:false,
    coverage:"partial",totalMatches:matches.length});
   return;
  }
  notify({playerId:id,status:"no_trophy_scope"});
 }catch{
  if(ticket===requestNumber)notify({playerId:id,status:"unavailable"});
 }
}
window.addEventListener("badminton:profile-change",e=>load(String(e.detail?.playerId||"")));
document.addEventListener("visibilitychange",()=>{
 if(!document.hidden&&selected&&Date.now()-lastChecked>=5*60*1000)load(selected);
});
window.addEventListener("badminton:player-evidence-retry",()=>{if(selected)load(selected)});
