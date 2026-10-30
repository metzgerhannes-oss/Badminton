/** P0 #417 · Private two-secret ownership recovery. Never log or store secrets. */
import {getPrivateSession} from "./private-invites.js";
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
const form=document.getElementById("handover-form");
const status=document.getElementById("status");
const button=document.getElementById("transfer-submit");
const tokenPattern=/^[a-f0-9]{64}$/;
function invitationToken(input){
 const value=String(input||"").trim();
 const direct=value.toLowerCase();
 if(tokenPattern.test(direct))return direct;
 const match=value.match(/(?:^|[#?&])appinvite=([0-9a-f]{64})(?:$|[&])/i);
 return match?.[1]?.toLowerCase()||"";
}
async function rpc(name,data,jwt,signal){
 const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
  method:"POST",signal,cache:"no-store",
  headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+jwt,"Content-Type":"application/json"},
  body:JSON.stringify(data)
 });
 if(!response.ok)throw Error("Der Berechtigungsdienst hat die Übertragung abgelehnt.");
 return response.json();
}
let busy=false;
form?.addEventListener("submit",async e=>{
 e.preventDefault();
 if(busy)return;
 // Do not store or echo secret material, even when server-side validation fails.
 const invitation=invitationToken(document.getElementById("invitation").value);
 const recovery=document.getElementById("handover").value.trim().toLowerCase();
 if(!tokenPattern.test(invitation)||!tokenPattern.test(recovery)){
  status.textContent="Bitte beide vollständigen Codes bzw. den originalen Einladungslink eingeben.";
  return;
 }
 busy=true;button.disabled=true;status.textContent="Berechtigungen werden serverseitig geprüft …";
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const session=await getPrivateSession(true);
  if(!session?.access_token)throw Error("Neue Sitzung nicht verfügbar.");
  const accepted=await rpc("app_access_invite_accept",{p_secret:invitation},session.access_token,controller.signal);
  if(accepted!==true)throw Error("Familieneinladung ungültig, widerrufen oder abgelaufen.");
  const claimed=await rpc("app_owner_device_transfer_claim",{
   p_invitation_secret:invitation,p_transfer_secret:recovery
  },session.access_token,controller.signal);
  if(claimed!==true)throw Error("Eigentümer-Übertragung nicht bestätigt. Das bisherige Eigentümerkonto bleibt erhalten.");
  const verified=await rpc("app_access_status",{},session.access_token,controller.signal);
  if(verified?.allowed!==true||verified?.owner!==true)
   throw Error("Die neue Eigentümerberechtigung konnte nicht bestätigt werden.");
  status.textContent="Eigentümerzugang bestätigt. Öffne deine private Schmetterlinge-App.";
  document.getElementById("invitation").value="";
  document.getElementById("handover").value="";
  window.location.replace("./index.html#einstellungen");
 }catch(error){
  status.textContent=error?.name==="AbortError"?"Zeitüberschreitung. Bitte die Verbindung prüfen.":
   error?.message||"Übertragung fehlgeschlagen. Der bisherige Zugang bleibt gültig.";
 }finally{
  clearTimeout(timer);busy=false;button.disabled=false;
 }
});
