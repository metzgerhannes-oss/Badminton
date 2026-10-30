/** v136 invitation-only entry. Server RLS, not the visual gate, protects match facts. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
const TOKEN=/^[a-f0-9]{64}$/;
let session=null,allowed=false,busy=false;
// The first successful cold launch has a short, consistent visual beat.
// Authentication still runs immediately; no delay for errors or a resumed PWA.
const COLD_START_MIN_MS=800;
const coldStartStartedAt=performance.now();
const root=document.documentElement;
const gate=document.getElementById("app-access-gate");
const code=document.getElementById("app-access-code");
const submit=document.getElementById("app-access-submit");
const paste=document.getElementById("app-access-paste");
const retry=document.getElementById("app-access-retry");
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
 if(retry)retry.hidden=true;
 gate.hidden=true;
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.has("appinvite")){
  history.replaceState(null,"",location.pathname+location.search+"#start");
  window.dispatchEvent(new Event("hashchange"));
 }
 window.dispatchEvent(new CustomEvent(member?"badminton:app-access-granted":"badminton:player-shell-granted"));
}
async function grantAfterIntro(options){
 // Only hold an already VERIFIED grant, never a failed/revoked invitation.
 // In background tabs or reduced-motion mode, avoid an artificial wait.
 if(document.visibilityState==="visible"&&
    !matchMedia("(prefers-reduced-motion: reduce)").matches){
  const remaining=COLD_START_MIN_MS-(performance.now()-coldStartStartedAt);
  if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
 }
 grant(options);
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
 if(retry)retry.hidden=true;
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
  await grantAfterIntro();
 }catch(error){
  root.dataset.appAccess="denied";
  inform(error?.message||"Einladung konnte nicht geprüft werden.");
 }finally{busy=false;submit.disabled=false}
}
submit?.addEventListener("click",()=>accept(code.value));
retry?.addEventListener("click",()=>{if(!busy)void initialize();});
code?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();accept(code.value)}});
// After iOS installation Safari and the PWA have separate storage. A deliberate
// user gesture can transfer the original link from the shared OS clipboard
// without copying/typing a 64-character secret into a form.
paste?.addEventListener("click",async()=>{
 if(busy)return;
 try{
  if(!navigator.clipboard?.readText)throw Error("clipboard");
  const text=await navigator.clipboard.readText();
  if(!text.trim())throw Error("empty");
  await accept(text);
 }catch{
  inform("Zwischenablage nicht verfügbar. Öffne den ursprünglichen Einladungslink oder füge ihn hier ein.");
 }
});
async function initialize(){
 if(retry)retry.hidden=true;
 inform("");
 root.dataset.appAccess="checking";
 const hashParams=new URLSearchParams(location.hash.slice(1));
 const incoming=hashParams.get("appinvite");
 // Safari's accepted anonymous Auth session is NOT carried into the installed
 // iPhone Home Screen app (independent localStorage). Intercept a fresh link
 // *before redeeming it*, so the same invite is accepted once in the final app.
 // The bootstrap has no PWA manifest: iOS installs its current fragment URL.
 // Existing PWA sessions, Android and explicit browser-only use are unchanged.
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||
  (/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
 const standalone=navigator.standalone===true||
  matchMedia("(display-mode:standalone)").matches;
 if(ios&&!standalone&&TOKEN.test(incoming||"")&&hashParams.get("browser")!=="1"){
  location.replace("./install-invite.html#appinvite="+incoming.toLowerCase());
  return;
 }
 if(TOKEN.test(incoming||""))code.value=incoming;
 if(paste)paste.hidden=!navigator.clipboard?.readText;
 gate.hidden=false;
 // A deliberate invitation link already requests access. Do not perform a
 // separate anonymous-session probe before redeeming it: on slow iOS/WebKit
 // starts the extra async check can hold the access screen while the visitor
 // expects the one-tap invite to be accepted. The accept() path still validates
 // the secret AND rechecks server-side membership before calling grant().
 if(TOKEN.test(incoming||"")){
  await accept(incoming);
  return;
 }
 try{
  const permission=await withCheckDeadline((async()=>{
   session=await getPrivateSession(false);
   if(!session)return null;
   const result=await rpc("app_access_status",{},session.access_token);
   if(result?.allowed===true)return "member";
   return await hasAcceptedPlayerLink(session.access_token)?"player":null;
  })());
  if(permission==="member"){await grantAfterIntro();return;}
  if(permission==="player"){await grantAfterIntro({member:false});return;}
 }catch(error){
  // An unavailable server never turns a private session into authorization.
  root.dataset.appAccess="denied";
  inform(error?.message||"Zugang konnte nicht geprüft werden. Bitte später erneut versuchen.");
  if(retry)retry.hidden=false;
  return;
 }
 root.dataset.appAccess="denied";
 inform(incoming?"Einladung erkannt. Bitte Zugang bestätigen.":"Diese App ist nur mit Einladung zugänglich. Öffne deinen persönlichen Einladungslink oder füge den Code ein.");
}
initialize();
