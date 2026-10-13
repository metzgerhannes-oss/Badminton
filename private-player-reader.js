/** 7 days to ACCEPT, thereafter device-bound access until explicitly revoked.
 * No credential is logged, cached in HTML or stored after redemption. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
import {addAcceptedPlayerToLocalStore} from "./scripts/invited-player-local.mjs";
const $=id=>document.getElementById(id);
const status=$("player-invite-status"),panel=$("player-invite-data");
const STORE="schmetterlinge.acceptedPlayerInvite.v3";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN=/^[a-f0-9]{64}$/;
const fragment=location.hash.slice(1);
let pendingToken=fragment.startsWith("token=")&&TOKEN.test(fragment.slice(6))?fragment.slice(6):"";
const reusable=fragment.startsWith("access=")&&UUID.test(fragment.slice(7))?fragment.slice(7):"";
history.replaceState(null,"",location.pathname+location.search);
function storedIds(){
 try{
  const raw=JSON.parse(localStorage.getItem(STORE)||"[]");
  const values=Array.isArray(raw)?raw:(raw?.id?[raw.id]:[]);
  return [...new Set(values.filter(id=>UUID.test(id)))].slice(-20);
 }catch{return []}
}
function saveIds(ids){localStorage.setItem(STORE,JSON.stringify([...new Set(ids)].slice(-20)))}
function syncSelector(){
 const chooser=$("player-invite-accepted");chooser.replaceChildren();
 const ids=storedIds();
 $("player-invite-selection").hidden=ids.length<=1;
 ids.forEach((id,i)=>{const opt=document.createElement("option");opt.value=id;opt.textContent="Gespeicherter Zugang "+(i+1);chooser.append(opt)});
 chooser.value=activeId;
}
function hide(msg){panel.hidden=true;status.textContent=msg}
function requestHeaders(session){return {apikey:PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json",Authorization:"Bearer "+session.access_token}}
async function rpc(path,args,session){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);
 try{
  let response;
  try{
   response=await fetch(SUPABASE_ROOT+"rpc/"+path,{method:"POST",cache:"no-store",signal:controller.signal,
    headers:requestHeaders(session),body:JSON.stringify(args)});
  }catch{
   throw Object.assign(new Error("network unavailable"),{retryable:true});
  }
  if(!response.ok){
   const error=new Error("request rejected");
   error.status=response.status;
   error.retryable=response.status===408||response.status===429||response.status>=500;
   throw error;
  }
  try{return await response.json()}
  catch{throw Object.assign(new Error("invalid response"),{retryable:true})}
 }finally{clearTimeout(timer)}
}
function show(data){
 if(!data?.player||!/^[0-9]{2}-[0-9]{6}$/.test(data.player.dbv_id)||typeof data.player.name!=="string")
  return false;
 $("player-invite-name").textContent=data.player.name;
 $("player-invite-club").textContent=[data.player.club,data.player.birth_year?"Jahrgang "+data.player.birth_year:"",data.player.age_class].filter(Boolean).join(" · ");
 // The read was authenticated and scoped by the accepted invitation.
 // Only save a local followed-player entry, never an own/verified-owner profile.
 try{
  const stored=JSON.parse(localStorage.getItem("shuttleboard-v1")||"null");
  const next=addAcceptedPlayerToLocalStore(stored,data.player);
  if(next)localStorage.setItem("shuttleboard-v1",JSON.stringify(next));
 }catch{/* A full/disabled browser storage must not block viewing the invite. */}
 // Store only the accepted invitation-to-DBV binding, never its secret token.
 // This is a routing hint; every subsequent private read is checked server-side.
 try{
  if(UUID.test(activeId)){
   const key="schmetterlinge.acceptedPlayerInviteBindings.v1";
   const previous=JSON.parse(localStorage.getItem(key)||"{}");
   const entries=Object.entries(previous&&typeof previous==="object"?previous:{}).filter(([id,dbv])=>UUID.test(id)&&/^[0-9]{2}-[0-9]{6}$/.test(dbv));
   const next=Object.fromEntries([...entries,[activeId,data.player.dbv_id]].slice(-20));
   localStorage.setItem(key,JSON.stringify(next));
  }
 }catch{/* Storage failure never changes server access. */}
 panel.hidden=false;status.textContent="Freigabe angenommen. Der Spieler ist für deine Schmetterlinge-App vorgemerkt.";return true;
}
let busy=false;let activeId=reusable||storedIds().at(-1)||"";syncSelector();
$("player-invite-accepted").addEventListener("change",event=>{activeId=event.target.value;reload()});
async function reload(){
 if(busy||!activeId)return;
 busy=true;panel.hidden=true;status.textContent="Private Berechtigung wird überprüft …";
 try{
  const session=await getPrivateSession(false);
  if(!session)throw Error("missing device session");
  const data=await rpc("private_player_access_read",{p_invitation_id:activeId},session);
  if(data===null)throw Object.assign(new Error("revoked"),{revoked:true});
  if(!show(data))throw Error("invalid read response");
 }catch(error){
  if(error?.revoked){
   try{
    const key="schmetterlinge.acceptedPlayerInviteBindings.v1";
    const entries=JSON.parse(localStorage.getItem(key)||"{}");
    if(entries&&typeof entries==="object"){delete entries[activeId];localStorage.setItem(key,JSON.stringify(entries));}
   }catch{/* Keep server revocation authoritative. */}
   saveIds(storedIds().filter(id=>id!==activeId));activeId="";syncSelector();
   hide("Kein Zugriff: Die Berechtigung wurde serverseitig widerrufen. Bitte einen neuen Einladungslink anfordern.");
  }else{
   // A temporary network/authentication failure is not proof of revocation.
   // Keep the saved ID so a later retry cannot erase the device-bound grant.
   hide("Privater Zugriff momentan nicht prüfbar. Verbindung prüfen und Seite erneut öffnen. Deine gespeicherte Freigabe bleibt auf diesem Gerät erhalten.");
  }
 }finally{busy=false}
}
const acceptBtn=$("player-invite-accept");
acceptBtn.addEventListener("click",async()=>{
 if(!pendingToken||busy)return;
 busy=true;acceptBtn.disabled=true;status.textContent="Einladung wird einmalig angenommen …";
 try{
  // A technical anonymous account is created ONLY after explicitly pressing Accept.
  const session=await getPrivateSession(true);
  const id=await rpc("private_player_invite_accept",{p_token:pendingToken},session);
  pendingToken="";
  if(!UUID.test(id||""))throw Object.assign(new Error("expired/redeemed/revoked"),{invalid:true});
  activeId=id;pendingToken="";
  saveIds([...storedIds(),id]);syncSelector();
  acceptBtn.hidden=true;status.textContent="Angenommen. Der Zugriff bleibt bis zum Widerruf auf diesem Gerät erhalten.";
 }catch(error){
  if(error?.invalid||[400,403,404,409,410,422].includes(error?.status)){
   pendingToken="";acceptBtn.hidden=true;
   hide("Einladung nicht mehr annehmbar: abgelaufen, bereits verwendet oder widerrufen.");
  }else{
   // The server may have accepted while the connection failed. Keep the token
   // in memory for a retry, but never claim that it was not consumed.
   acceptBtn.hidden=false;
   hide("Annahme konnte nicht bestätigt werden. Verbindung prüfen und erneut versuchen. Falls der Link inzwischen verwendet wurde, bitte eine neue Einladung anfordern.");
  }
 }finally{busy=false;acceptBtn.disabled=false}
 if(activeId)await reload();
});
if(pendingToken){
 activeId="";acceptBtn.hidden=false;
 status.textContent="Du kannst diese Einladung innerhalb von sieben Tagen nach Erstellung annehmen. Danach bleibt der Zugriff auf diesem Gerät bis zum Widerruf erhalten.";
}else if(activeId){acceptBtn.hidden=true;await reload()}
else{acceptBtn.hidden=true;hide("Auf diesem Gerät ist keine angenommene Einladung vorhanden.")}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&activeId)reload()});
