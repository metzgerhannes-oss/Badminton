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
function status(text){el("invite-status").textContent=text;}
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
 if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
 else window.prompt("Einladung kopieren:",text);
}
async function execute(action){
 if(busy)return;
 busy=true;
 el("invite-share").disabled=true;el("invite-copy").disabled=true;
 try{
  const record=await ensureInvite(),url=link(record.secret);
  if(action==="share"&&navigator.share){
   try{await navigator.share({title:"Einladung zu Schmetterlinge",
    text:"Mit diesem Link kannst du Schmetterlinge öffnen und belegte Badminton-Ergebnisse ansehen.",url});
    status("Wähle eine App, um den Einladungslink zu teilen.");return;
   }catch(e){if(e?.name==="AbortError")return}
  }
  await copyText(url);
  status("Einladungslink kopiert. Teile ihn über eine Nachricht. Der Link ist 30 Tage einlösbar; angenommene Zugänge bleiben bis zum Widerruf gültig.");
 }catch(e){status(e?.message||"Einladung konnte nicht erstellt werden.")}
 finally{busy=false;el("invite-share").disabled=false;el("invite-copy").disabled=false}
}
async function revoke(){
 const record=read();if(!record?.id||busy)return;
 busy=true;
 try{
  const done=await rpc("app_access_invite_revoke",{p_invitation_id:record.id});
  if(done!==true)throw Error("Widerruf nicht bestätigt.");
  write({...record,revoked:true});draw();
  status("Einladungslink und alle darüber freigeschalteten Zugänge wurden widerrufen.");
 }catch(e){status(e?.message||"Widerruf fehlgeschlagen.")}
 finally{busy=false}
}
async function init(){
 const card=document.querySelector(".invitation-card");
 try{
  session=await getPrivateSession(false);
  if(!session)return;
  const result=await rpc("app_access_status");
  owner=result?.owner===true;
  if(!owner)return;
  card.hidden=false;
  draw();
  mountOwnerInviteOverview({card,rpc,read,write,draw,status});
  el("invite-share").addEventListener("click",()=>execute("share"));
  el("invite-copy").addEventListener("click",()=>execute("copy"));
  el("invite-revoke").addEventListener("click",revoke);
  status("Nur Betreiber können App-Zugänge einladen. Persönliche Spieler-Verwaltungsrechte werden nicht übertragen.");
 }catch{/* No account or network check means no ability to issue invitations. */}
}
document.addEventListener("DOMContentLoaded",init);
