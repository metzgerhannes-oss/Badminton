/** v136 invitation-only entry. Server RLS, not the visual gate, protects match facts. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
const TOKEN=/^[a-f0-9]{64}$/;
let session=null,allowed=false,busy=false;
const root=document.documentElement;
const gate=document.getElementById("app-access-gate");
const code=document.getElementById("app-access-code");
const submit=document.getElementById("app-access-submit");
const status=document.getElementById("app-access-status");
window.badmintonAppAccess=Object.freeze({
 get accessToken(){return allowed?session?.access_token||null:null;},
 get allowed(){return allowed},
 get shellAllowed(){return root.dataset.appAccess==="granted"},
 async getAccessToken(){
  if(!allowed)return null;
  const fresh=await getPrivateSession(false);
  if(!fresh)return null;
  session=fresh;
  return fresh.access_token;
 }
});
async function rpc(name,body,token){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),7000);
 try{
  const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
   method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify(body)
  });
  if(!response.ok)throw Error("Zugangsdienst nicht erreichbar oder Berechtigung abgelehnt");
  return response.json();
 }finally{clearTimeout(timeout)}
}
function grant({member=true}={}){
 allowed=member;
 root.dataset.appAccess="granted";
 gate.hidden=true;
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.has("appinvite")){
  history.replaceState(null,"",location.pathname+location.search+"#start");
  window.dispatchEvent(new Event("hashchange"));
 }
 window.dispatchEvent(new CustomEvent(member?"badminton:app-access-granted":"badminton:player-shell-granted"));
}
function inform(message){status.textContent=message;}
// Bound the visual check: a stalled Auth/connection request must never leave
// users staring at an endless animation. Late replies cannot grant access.
async function withCheckDeadline(work){
 let timer;
 try{
  return await Promise.race([work,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error("Die Zugangsprüfung dauert zu lange. Bitte Verbindung prüfen und erneut öffnen.")),12000);
  })]);
 }finally{clearTimeout(timer)}
}
async function hasAcceptedPlayerLink(token){
 // The server validates the accepted player invitation on every opening.
 // A device-local invitation id alone never proves access.
 let saved;
 try{saved=JSON.parse(localStorage.getItem("schmetterlinge.acceptedPlayerInvite.v3")||"[]")}
 catch{return false}
 const ids=Array.isArray(saved)?saved:(saved?.id?[saved.id]:[]);
 const unique=[...new Set(ids.filter(id=>typeof id==="string"&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))].slice(-20);
 for(const id of unique){
  try{
   const result=await rpc("private_player_access_read",{p_invitation_id:id},token);
   if(result?.player?.dbv_id)return true;
  }catch{/* A revoked, expired-session or unrelated link does not unlock the app. */}
 }
 return false;
}
async function accept(raw){
 const value=String(raw||"").trim();
 let token=value.toLowerCase();
 // iPhone Home Screen PWAs can have a different storage area than Safari.
 // Pasting the complete shared link into the installed app must be sufficient.
 if(value.includes("appinvite=")){
  const match=value.match(/(?:^|[#?&])appinvite=([0-9a-f]{64})(?:$|[&])/i);
  token=match?.[1]?.toLowerCase()||"";
 }
 if(!TOKEN.test(token)){inform("Bitte den vollständigen Einladungslink öffnen oder den Code einfügen.");return}
 if(busy)return;
 busy=true;submit.disabled=true;
 root.dataset.appAccess="checking";
 inform("");
 try{
  await withCheckDeadline((async()=>{
   session=await getPrivateSession(true);
   const ok=await rpc("app_access_invite_accept",{p_secret:token},session.access_token);
   if(ok!==true)throw Error("Dieser Link ist ungültig, widerrufen oder abgelaufen.");
   const permission=await rpc("app_access_status",{},session.access_token);
   if(permission?.allowed!==true)throw Error("Die Einladung wurde nicht freigeschaltet.");
  })());
  grant();
 }catch(error){
  root.dataset.appAccess="denied";
  inform(error?.message||"Einladung konnte nicht geprüft werden.");
 }finally{busy=false;submit.disabled=false}
}
submit?.addEventListener("click",()=>accept(code.value));
code?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();accept(code.value)}});
async function initialize(){
 root.dataset.appAccess="checking";
 const incoming=new URLSearchParams(location.hash.slice(1)).get("appinvite");
 if(TOKEN.test(incoming||""))code.value=incoming;
 gate.hidden=false;
 try{
  const permission=await withCheckDeadline((async()=>{
   session=await getPrivateSession(false);
   if(!session)return null;
   const result=await rpc("app_access_status",{},session.access_token);
   if(result?.allowed===true)return "member";
   return await hasAcceptedPlayerLink(session.access_token)?"player":null;
  })());
  if(permission==="member"){grant();return;}
  if(permission==="player"){grant({member:false});return;}
 }catch(error){
  // An unavailable server never turns a private session into authorization.
  root.dataset.appAccess="denied";
  inform(error?.message||"Zugang konnte nicht geprüft werden. Bitte später erneut versuchen.");
  return;
 }
 root.dataset.appAccess="denied";
 inform(incoming?"Einladung erkannt. Bitte Zugang bestätigen.":"Diese App ist nur mit Einladung zugänglich. Öffne deinen persönlichen Einladungslink oder füge den Code ein.");
 if(incoming&&TOKEN.test(incoming))accept(incoming);
}
initialize();
