/** v136: only a verified site owner issues revocable, shareable app invitations. */
import {getPrivateSession} from "./private-invites.js";
import {PUBLIC_KEY,SUPABASE_ROOT} from "./scripts/supabase-read.mjs";
import {mountOwnerInviteOverview,checkIssuedInviteForSharing} from "./scripts/owner-invites-overview.mjs";
const STORAGE="schmetterlinge.appIssuedInvite.v136";
const el=id=>document.getElementById(id);
const hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
const read=()=>{try{return JSON.parse(localStorage.getItem(STORAGE)||"null")}catch{return null}};
const write=(value,{broadcast=true}={})=>{localStorage.setItem(STORAGE,JSON.stringify(value));
 if(broadcast)window.dispatchEvent(new Event("badminton:issued-invites-changed"));};
const link=token=>{const url=new URL("./index.html",location.href);url.hash="appinvite="+token;return url.href};
const active=record=>record&&/^[0-9a-f]{64}$/.test(record.secret)&&Date.parse(record.expires)>Date.now()&&!record.revoked;
let session=null,owner=false,busy=false;
async function rpc(endpoint,body={}){
 if(!session?.access_token)throw Error("Berechtigung fehlt");
 const response=await fetch(SUPABASE_ROOT+"rpc/"+endpoint,{
  method:"POST",cache:"no-store",
  headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
  body:JSON.stringify(body)
 });
 if(!response.ok)throw Error("Einladungsdienst nicht erreichbar oder Zugriff abgelehnt.");
 return response.json();
}
function status(text,kind="info"){
 const target=el("invite-status");
 target.dataset.state=kind;
 target.textContent=text;
}
function draw(){
 const record=read(),valid=active(record);
 const preview=el("invite-link-preview");
 preview.href=valid?link(record.secret):"./welcome.html#installation";
 preview.textContent=valid?"Aktuellen Einladungslink öffnen ↗":"Installationsanleitung öffnen ↗";
 el("invite-revoke").hidden=!record?.id||record?.revoked===true;
 el("invite-copy").hidden=!valid;
}
async function ensureInvite(){
 if(!owner)throw Error("Nur der Betreiber darf Einladungen erstellen.");
 const current=read();
 if(active(current)){
  // A revoked or expired invitation may remain cached on another device.
  // Never copy a stale bearer link or silently create a new grant on this click.
  const verified=checkIssuedInviteForSharing(current,await rpc("app_access_invites_overview"));
  if(verified.status!=="active"){
   if(verified.status==="revoked")write({...current,revoked:true});
   if(verified.status==="expired")write({...current,expires:verified.expires});
   draw();
   throw Error(verified.status==="revoked"?"Einladung wurde widerrufen. Für einen neuen Link erneut auf Teilen klicken.":
    verified.status==="expired"?"Annahmefrist abgelaufen. Für einen neuen Link erneut auf Teilen klicken.":
    "Einladungsstatus derzeit nicht bestätigbar. Bitte Liste aktualisieren und erneut versuchen.");
  }
  // The server's deadline can shorten, but never silently extend, local validity.
  if(Date.parse(verified.expires)<Date.parse(current.expires)){
   const synced={...current,expires:verified.expires};
   write(synced,{broadcast:false});draw();return synced;
  }
  return current;
 }
 const secret=hex();
 const id=await rpc("app_access_invite_issue",{p_secret:secret});
 if(typeof id!=="string"||!/^[a-f0-9-]{36}$/i.test(id))throw Error("Einladung nicht bestätigt");
 const record={id,secret,expires:new Date(Date.now()+30*86400000).toISOString(),revoked:false};
 write(record);draw();return record;
}
async function copyText(text){
 if(navigator.clipboard?.writeText){
  await navigator.clipboard.writeText(text);
  return true;
 }
 // Prompt cannot confirm whether the user actually copied the token.
 window.prompt("Einladung zum manuellen Kopieren:",text);
 return false;
}
async function execute(action){
 if(busy)return;
 busy=true;
 const copyButton=el("invite-copy");
 const previousText=copyButton.textContent;
 el("invite-share").disabled=true;copyButton.disabled=true;
 if(action==="copy")copyButton.textContent="Wird kopiert …";
 status(action==="copy"?"Einladungslink wird vorbereitet …":"Einladung wird vorbereitet …");
 try{
  const record=await ensureInvite(),url=link(record.secret);
  if(action==="share"&&navigator.share){
   try{await navigator.share({title:"Einladung zu Schmetterlinge",
    text:"Mit diesem Link kannst du Schmetterlinge öffnen und belegte Badminton-Ergebnisse ansehen.",url});
    status("Teilen geöffnet. Wähle eine App und einen Empfänger.");return;
   }catch(e){if(e?.name==="AbortError"){status("Teilen abgebrochen.");return;}}
  }
  const copied=await copyText(url);
  if(copied){
   copyButton.textContent="✓ Link kopiert";
   status("✓ Einladungslink kopiert. Du kannst ihn jetzt in der privaten App verwenden.", "success");
  }else{
   status("Der Link wurde angezeigt. Bitte manuell kopieren; automatisches Kopieren ist nicht verfügbar.");
  }
 }catch(e){
  // Keep verified invite revocation/expiry visible; a generic clipboard error
  // would hide the server-confirmed denial and mislead the owner.
  const reason=String(e?.message||"");
  const verifiedDenial=/^(Einladung wurde widerrufen\.|Annahmefrist abgelaufen\.|Einladungsstatus derzeit nicht bestätigbar\.)/.test(reason);
  status(verifiedDenial?reason:
   "Kopieren nicht möglich. Bitte die Zwischenablage freigeben oder „Aktuellen Einladungslink öffnen“ nutzen.", "error");
 }finally{
  busy=false;el("invite-share").disabled=false;copyButton.disabled=false;
  if(action!=="copy"||copyButton.textContent==="Wird kopiert …")
   copyButton.textContent=previousText;
 }
}
async function revoke(){
 const record=read();if(!record?.id||busy)return;
 busy=true;
 try{
  const done=await rpc("app_access_invite_revoke",{p_invitation_id:record.id});
  if(done!==true)throw Error("Widerruf nicht bestätigt.");
  write({...record,revoked:true});draw();
  status("Einladungslink und zugehörige Zugänge wurden widerrufen.", "success");
 }catch(e){status(e?.message||"Widerruf fehlgeschlagen.", "error")}
 finally{busy=false}
}
let listenersReady=false,checking=false;
async function checkOwnerAccess(){
 if(checking)return;
 const card=document.querySelector(".invitation-card");
 const help=document.getElementById("invite-access-help");
 const message=document.getElementById("invite-access-message");
 const button=document.getElementById("invite-access-recheck");
 // The settings DOM is composed by settings-rooms.js on DOMContentLoaded.
 if(!card||!help||!message)return;
 checking=true;
 if(button)button.disabled=true;
 message.textContent="Betreiberberechtigung wird geprüft …";
 try{
  session=await getPrivateSession(false);
  if(!session){
   owner=false;card.hidden=true;help.hidden=false;
   message.textContent="Auf diesem Gerät ist keine gültige Betreiber-Sitzung gespeichert. Bestehende Familienzugänge bleiben unverändert.";
   return;
  }
  const result=await rpc("app_access_status");
  owner=result?.owner===true;
  if(!owner){
   card.hidden=true;help.hidden=false;
   message.textContent="Deine aktuelle Sitzung besitzt keine Betreiberrechte. Deshalb sind die Einladungsbuttons ausgeblendet. Ein neuer Einladungslink würde diese Rechte nicht vergeben.";
   return;
  }
  card.hidden=false;help.hidden=true;
  draw();
  if(!listenersReady){
   listenersReady=true;
   mountOwnerInviteOverview({card,rpc,read,write,draw,status});
   el("invite-share").addEventListener("click",()=>execute("share"));
   el("invite-copy").addEventListener("click",()=>execute("copy"));
   el("invite-revoke").addEventListener("click",revoke);
  }
  status("Du kannst einen Familienzugang erstellen und teilen. Spieler-Verwaltungsrechte werden nicht übertragen.");
 }catch{
  owner=false;card.hidden=true;help.hidden=false;
  message.textContent="Die Betreiberberechtigung konnte nicht geprüft werden. Bitte Verbindung prüfen und „Berechtigung erneut prüfen“ wählen.";
 }finally{checking=false;if(button)button.disabled=false;}
}
function init(){
 document.getElementById("invite-access-recheck")?.addEventListener("click",checkOwnerAccess);
 void checkOwnerAccess();
 window.addEventListener("badminton:app-access-granted",checkOwnerAccess);
 window.addEventListener("hashchange",()=>{
  if(location.hash.startsWith("#einstellungen"))void checkOwnerAccess();
 });
}
document.addEventListener("DOMContentLoaded",init);
