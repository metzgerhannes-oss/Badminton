/** Optional private, one-event invitations. No signup until "Link erstellen" is clicked. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {newToken,invitationPayload,linkForToken,localInviteKey,TOKEN_RE} from "./scripts/private-invitation.mjs";
const $=id=>document.getElementById(id);
const AUTH_KEY="schmetterlinge.communitySession.v1";
const INVITES_KEY="schmetterlinge.privateInvites.v1";
const AUTH_URL=SUPABASE_ROOT.replace(/rest\/v1\/$/,"auth/v1/");
const obj=(key)=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};
const registry=()=>{const r=obj(INVITES_KEY);return r&&typeof r==="object"&&!Array.isArray(r)?r:{}};
const remember=records=>localStorage.setItem(INVITES_KEY,JSON.stringify(records));
window.badmintonPrivateInvite={
 hasActive:bookmark=>{
  const r=registry()[localInviteKey(bookmark)];
  return Boolean(r&&TOKEN_RE.test(r.token)&&Date.parse(r.expires)>Date.now());
 }
};
let selected=null,busy=false;
function notice(message){const node=$("private-share-status");if(node)node.textContent=message}
function actionDisabled(on){for(const id of ["private-share-create","private-share-copy","private-share-revoke"])if($(id))$(id).disabled=on}
function payloadHeaders(jwt){return {apikey:PUBLIC_KEY,...(jwt?{Authorization:"Bearer "+jwt}:{}),
  "Content-Type":"application/json",Accept:"application/json"}}
async function json(res){
 let value=null;try{value=await res.json()}catch{}
 if(!res.ok)throw Error(res.status===429?"Zu viele Anfragen. Bitte später erneut versuchen.":
   res.status===401?"Die Geräteanmeldung ist abgelaufen.":
   "Serverantwort "+res.status);
 return value;
}
async function session(create){
 let current=obj(AUTH_KEY);
 if(current?.access_token&&current.expires_at>Date.now()+60000)return current;
 if(current?.refresh_token){
  try{
   const res=await fetch(AUTH_URL+"token?grant_type=refresh_token",{
    method:"POST",cache:"no-store",headers:payloadHeaders(),
    body:JSON.stringify({refresh_token:current.refresh_token})});
   const data=await json(res);
   if(!data?.access_token||!data?.refresh_token)throw Error("Ungültige Sitzung.");
   current={access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+Number(data.expires_in||0)*1000,user_id:data.user?.id||current.user_id};
   localStorage.setItem(AUTH_KEY,JSON.stringify(current));return current;
  }catch{
   // Never replace an existing potentially verified identity with a new anonymous user
   // because of transient network or refresh-token errors.
   throw Error("Die bestehende Geräteanmeldung konnte nicht erneuert werden. Bitte die Verbindung prüfen.");
  }
 }
 if(current?.user_id||current?.access_token)
  throw Error("Die vorhandene Anmeldung ist unvollständig und wird nicht automatisch ersetzt.");
 if(!create)return null;
 const res=await fetch(AUTH_URL+"signup",{method:"POST",cache:"no-store",headers:payloadHeaders(),
  body:JSON.stringify({data:{}})});
 if(!res.ok&&res.status===422)throw Error("Anonyme Anmeldung für private Links ist in Supabase noch nicht aktiviert.");
 const data=await json(res);
 if(!data?.access_token||!data?.refresh_token||!data?.user?.id)
  throw Error("Die technische Anmeldung ist momentan nicht verfügbar.");
 current={access_token:data.access_token,refresh_token:data.refresh_token,
  expires_at:Date.now()+Number(data.expires_in||0)*1000,user_id:data.user.id};
 localStorage.setItem(AUTH_KEY,JSON.stringify(current));
 return current;
}
function showCurrent(){
 const record=selected?registry()[localInviteKey(selected)]:null;
 const active=record&&TOKEN_RE.test(record.token)&&Date.parse(record.expires)>Date.now();
 const url=active?linkForToken(location.href,record.token):"";
 $("private-share-link").value=url;
 $("private-share-link-wrap").hidden=!active;
 $("private-share-create").hidden=Boolean(active);
 $("private-share-copy").hidden=!active;
 $("private-share-revoke").hidden=!active;
 notice(active?"Der Link ist sieben Tage gültig und kann weitergegeben werden.":"Der Link enthält nur Turniername, Datum und offizielle Quelle – keine Teilnahmebestätigung.");
}
async function create(){
 if(busy||!selected)return;
 busy=true;actionDisabled(true);notice("Privaten Link anlegen …");
 try{
  const token=newToken();
  const body=invitationPayload(selected,token);
  // A new anonymous Auth user is created only after this explicit user action.
  const identity=await session(true);
  const response=await fetch(SUPABASE_ROOT+"rpc/private_tournament_invite_create",{
   method:"POST",cache:"no-store",headers:payloadHeaders(identity.access_token),body:JSON.stringify(body)});
  const data=await json(response);
  const item=Array.isArray(data)?data[0]:null;
  if(!item||!/^[-0-9a-f]{36}$/i.test(item.invitation_id)||!Number.isFinite(Date.parse(item.expires_at)))
   throw Error("Die Freigabe konnte nicht bestätigt werden.");
  const records=registry();
  records[localInviteKey(selected)]={id:item.invitation_id,token,expires:item.expires_at};
  remember(records);showCurrent();notice("Privater Link erstellt. Nur Personen mit dem Link können diese Turnierinformationen lesen.");
 }catch(err){notice(err?.message||"Privater Link konnte nicht angelegt werden.");}
 finally{busy=false;actionDisabled(false)}
}
async function revoke(record,bookmark,quiet=false){
 const identity=await session(false);
 if(!identity)throw Error("Diese Geräteanmeldung ist für den Widerruf nicht mehr verfügbar.");
 const response=await fetch(SUPABASE_ROOT+"rpc/private_tournament_invite_revoke",{
  method:"POST",cache:"no-store",headers:payloadHeaders(identity.access_token),
  body:JSON.stringify({p_invitation_id:record.id})});
 const data=await json(response);
 if(data!==true)throw Error("Widerruf konnte nicht bestätigt werden.");
 const records=registry();delete records[localInviteKey(bookmark)];remember(records);
 if(!quiet)showCurrent();
}
async function revokeSelected(){
 if(busy||!selected)return;
 const record=registry()[localInviteKey(selected)];if(!record)return;
 busy=true;actionDisabled(true);notice("Link widerrufen …");
 try{await revoke(record,selected);notice("Link widerrufen. Bereits kopierte Inhalte lassen sich nicht zurückholen.");}
 catch(err){notice(err?.message||"Der Link konnte nicht widerrufen werden.");}
 finally{busy=false;actionDisabled(false)}
}
async function copy(){
 const text=$("private-share-link").value;if(!text)return;
 try{
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
  else{$("private-share-link").focus();$("private-share-link").select();if(!document.execCommand("copy"))throw Error("Kopieren nicht möglich");}
  notice("Link kopiert. Du entscheidest, wem du ihn sendest.");
 }catch{notice("Bitte den Link im Feld markieren und selbst kopieren.");}
}
document.addEventListener("DOMContentLoaded",()=>{
 const dialog=$("private-share-dialog");if(!dialog)return;
 window.addEventListener("badminton:private-invite",event=>{
  selected=event.detail?.bookmark||null;if(!selected)return;
  $("private-share-title").textContent=String(selected.name||"Turnier");
  showCurrent();dialog.showModal();
 });
 $("private-share-create")?.addEventListener("click",create);
 $("private-share-copy")?.addEventListener("click",copy);
 $("private-share-revoke")?.addEventListener("click",revokeSelected);
 $("private-share-close")?.addEventListener("click",()=>dialog.close());

});
