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
function grant(){
 allowed=true;
 root.dataset.appAccess="granted";
 gate.hidden=true;
 const params=new URLSearchParams(location.hash.slice(1));
 if(params.has("appinvite")){
  history.replaceState(null,"",location.pathname+location.search+"#start");
  window.dispatchEvent(new Event("hashchange"));
 }
 window.dispatchEvent(new CustomEvent("badminton:app-access-granted"));
}
function inform(message){status.textContent=message;}
async function accept(raw){
 const token=String(raw||"").trim().toLowerCase();
 if(!TOKEN.test(token)){inform("Bitte den vollständigen Einladungslink öffnen oder den Code einfügen.");return}
 if(busy)return;
 busy=true;submit.disabled=true;
 inform("Einladung wird geprüft …");
 try{
  session=await getPrivateSession(true);
  const ok=await rpc("app_access_invite_accept",{p_secret:token},session.access_token);
  if(ok!==true)throw Error("Dieser Link ist ungültig, widerrufen oder abgelaufen.");
  const permission=await rpc("app_access_status",{},session.access_token);
  if(permission?.allowed!==true)throw Error("Die Einladung wurde nicht freigeschaltet.");
  grant();
 }catch(error){inform(error?.message||"Einladung konnte nicht geprüft werden.")}
 finally{busy=false;submit.disabled=false}
}
submit?.addEventListener("click",()=>accept(code.value));
code?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();accept(code.value)}});
async function initialize(){
 root.dataset.appAccess="checking";
 const incoming=new URLSearchParams(location.hash.slice(1)).get("appinvite");
 if(TOKEN.test(incoming||""))code.value=incoming;
 gate.hidden=false;
 try{
  session=await getPrivateSession(false);
  if(session){
   const result=await rpc("app_access_status",{},session.access_token);
   if(result?.allowed===true){grant();return;}
  }
 }catch{/* Fail closed; never interpret a network error as valid membership. */}
 root.dataset.appAccess="denied";
 inform(incoming?"Einladung erkannt. Bitte Zugang bestätigen.":"Diese App ist nur mit Einladung zugänglich. Öffne deinen persönlichen Einladungslink oder füge den Code ein.");
 if(incoming&&TOKEN.test(incoming))accept(incoming);
}
initialize();
