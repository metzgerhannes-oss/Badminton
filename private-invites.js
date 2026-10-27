/** Private sharing is separate from public DBV-player publishing.
 * Anonymous Auth is created only after pressing 'Privat teilen'. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {INVITE_STORE,SESSION_STORE,storedInvites,inviteKey,safeEvent,freshToken,invitationLink} from "./scripts/private-invite-utils.mjs";
import {createAuthSingleflight} from "./scripts/auth-singleflight.mjs";
const API=SUPABASE_ROOT.replace(/rest\/v1\/$/,"auth/v1/");
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")||fallback}catch{return fallback}};
const entries=()=>storedInvites(read(INVITE_STORE,{}));
const save=map=>localStorage.setItem(INVITE_STORE,JSON.stringify(map));
let chosen=null,busy=false;
function dialog(){
 if($("private-invite-dialog"))return $("private-invite-dialog");
 const el=document.createElement("dialog");el.id="private-invite-dialog";
 el.innerHTML='<div class="modal"><h2>Turnier privat teilen</h2>'+
 '<p class="small">Nur dieser Turniername, Zeitraum und die DBV-Quelle werden über den Link lesbar. Keine Spieler-, Freundes- oder Teilnahmedaten. Der Link kann weitergeleitet werden.</p>'+
 '<p id="private-invite-status" class="small" role="status" aria-live="polite"></p>'+
 '<label for="private-invite-url">Einladungslink (7 Tage gültig)</label>'+
 '<input id="private-invite-url" type="text" readonly autocomplete="off" spellcheck="false">'+
 '<div class="private-invite-actions"><button id="private-invite-create" type="button" class="primary-button">Link erstellen</button>'+
 '<button id="private-invite-copy" type="button" class="outline-button" hidden>Kopieren</button>'+
 '<button id="private-invite-revoke" type="button" class="outline-button" hidden>Widerrufen</button>'+
 '<button id="private-invite-close" type="button" class="subtle-button">Schließen</button></div></div>';
 document.body.appendChild(el);
 $("private-invite-create").addEventListener("click",()=>create());
 $("private-invite-copy").addEventListener("click",copy);
 $("private-invite-revoke").addEventListener("click",revoke);
 $("private-invite-close").addEventListener("click",()=>el.close());
 return el;
}
function message(value){$("private-invite-status").textContent=value}
function toggle(status){
 $("private-invite-create").hidden=status;
 $("private-invite-copy").hidden=!status;
 $("private-invite-revoke").hidden=!status;
}
async function asJson(response){
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error("Der Dienst ist derzeit nicht verfügbar (HTTP "+response.status+").");
 return data;
}
function sessionHeaders(token){return {apikey:PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"}}
// A single Auth refresh is shared by every app module on this page.
const pendingSession=createAuthSingleflight(async create=>{
 const action=async()=>{
  // A second Safari tab may have refreshed while this tab waited for Web Locks.
  let current=read(SESSION_STORE,null);
  if(current?.access_token&&current.expires_at>Date.now()+60000)return current;
  if(current?.refresh_token){
   const previousToken=current.refresh_token;
   const r=await fetch(API+"token?grant_type=refresh_token",{method:"POST",cache:"no-store",
    headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({refresh_token:previousToken})});
   // 409 means "Too many concurrent token refresh requests"; NEVER erase the
   // existing identity, manufacture another user or busy-loop on the same token.
   if(r.status===409){
    await new Promise(resolve=>setTimeout(resolve,180));
    const newer=read(SESSION_STORE,null);
    if(newer?.access_token&&newer?.refresh_token!==previousToken&&
       newer.expires_at>Date.now()+5000)return newer;
    throw Error("Die Sitzung wird gleichzeitig aktualisiert. Bitte die App erneut öffnen.");
   }
   if([400,401,403].includes(r.status)){
    const newer=read(SESSION_STORE,null);
    if(newer?.refresh_token&&newer.refresh_token!==previousToken&&
       newer.expires_at>Date.now()+5000)return newer;
    localStorage.removeItem(SESSION_STORE);
    if(!create)return null;
   }else{
    const d=await asJson(r);
    if(!d?.access_token||!d?.refresh_token||!(d?.user?.id||current.user_id))
     throw Error("Sitzungsantwort unvollständig. Bitte erneut versuchen.");
    current={access_token:d.access_token,refresh_token:d.refresh_token,
     expires_at:Date.now()+Number(d.expires_in||0)*1000,user_id:d.user?.id||current.user_id};
    localStorage.setItem(SESSION_STORE,JSON.stringify(current));return current;
   }
  }
  if(!create)return null;
  // Creating a Supabase Anonymous Auth user is still only a user-initiated
  // invite flow. Never create one merely to check an unauthenticated visitor.
  const response=await fetch(API+"signup",{method:"POST",cache:"no-store",
   headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json"},
   body:JSON.stringify({data:{},gotrue_meta_security:{}})});
  const data=await asJson(response);
  if(!data?.access_token||!data?.refresh_token||!data?.user?.id)
   throw Error("Anonyme Konten sind derzeit nicht aktiviert. Dein Turnier bleibt privat auf diesem Gerät.");
  current={access_token:data.access_token,refresh_token:data.refresh_token,
   expires_at:Date.now()+Number(data.expires_in||0)*1000,user_id:data.user.id};
  localStorage.setItem(SESSION_STORE,JSON.stringify(current));
  return current;
 };
 // Web Locks coordinate independent Safari tabs where supported. The Promise
 // above is still required because not every iOS WebKit version supports locks.
 if(typeof navigator!=="undefined"&&navigator.locks?.request)
  return navigator.locks.request("schmetterlinge-community-session-v1",action);
 return action();
});
export async function getPrivateSession(create=false){
 const current=read(SESSION_STORE,null);
 if(current?.access_token&&current.expires_at>Date.now()+60000)return current;
 if(!current?.refresh_token&&!create)return null;
 const result=await pendingSession(create);
 // An overlapping read-only check must not swallow an explicit signup request.
 if(!result&&create)return pendingSession(true);
 return result;
}

function showRecord(rec){
 const url=rec?invitationLink(rec.token,new URL("./",location.href)):"";
 $("private-invite-url").value=url;
 toggle(Boolean(url));
}
function open(bookmark){
 const el=dialog();
 chosen=bookmark;
 const rec=entries()[inviteKey(bookmark)];
 const current=rec&&Date.parse(rec.expires)>Date.now()?rec:null;
 showRecord(current);
 message(current?"Dieser Link ist gültig bis "+new Date(current.expires).toLocaleDateString("de-DE")+".":"Der Link wird nur auf deinen ausdrücklichen Wunsch erstellt.");
 if(!el.open)el.showModal();
}
async function create(){
 if(!chosen||busy)return;
 busy=true;$("private-invite-create").disabled=true;
 try{
  const item=safeEvent(chosen),s=await getPrivateSession(true),token=freshToken();
  const r=await fetch(SUPABASE_ROOT+"rpc/private_tournament_invite_create",{
   method:"POST",cache:"no-store",headers:sessionHeaders(s.access_token),
   body:JSON.stringify({p_token:token,p_title:item.title,p_start_date:item.start_date,
    p_end_date:item.end_date,p_source_url:item.source_url})});
  const response=await asJson(r),data=Array.isArray(response)?response[0]:null;
  if(!data?.invitation_id||!data?.expires_at)throw Error("Keine gültige Freigabebestätigung erhalten");
  const map=entries(),record={id:data.invitation_id,token,expires:data.expires_at};
  map[inviteKey(chosen)]=record;save(map);
  showRecord(record);message("Privater Link erstellt. Nur die ausgewählten Turnierdaten sind abrufbar.");
 }catch(error){message(error?.message||"Einladungslink konnte nicht erstellt werden. Persönliche Daten bleiben lokal.");}
 finally{busy=false;$("private-invite-create").disabled=false}
}
async function copy(){
 const value=$("private-invite-url").value;if(!value)return;
 try{if(!navigator.clipboard?.writeText)throw Error("clipboard");await navigator.clipboard.writeText(value);
  message("Link kopiert. Jeder mit diesem Link kann die ausgewählten Turnierdaten sehen.");
 }catch{$("private-invite-url").focus();$("private-invite-url").select();message("Bitte den markierten Link kopieren.");}
}
async function revoke(){
 if(!chosen||busy)return;
 const key=inviteKey(chosen),entry=entries()[key];if(!entry)return;
 busy=true;$("private-invite-revoke").disabled=true;
 try{
  const current=read(SESSION_STORE,null);
  if(!current)throw Error("Die ursprüngliche Sitzung fehlt. Dieser Link läuft spätestens nach sieben Tagen ab.");
  const s=await getPrivateSession(false);
  if(!s)throw Error("Die ursprüngliche Sitzung ist nicht mehr verfügbar. Der Link läuft nach sieben Tagen ab.");
  const response=await fetch(SUPABASE_ROOT+"rpc/private_tournament_invite_revoke",{
   method:"POST",cache:"no-store",headers:sessionHeaders(s.access_token),
   body:JSON.stringify({p_invitation_id:entry.id})});
  const data=await asJson(response);
  if(data!==true)throw Error("Link nicht widerrufen. Bitte Verbindung und Sitzung überprüfen.");
  const map=entries();delete map[key];save(map);
  showRecord(null);message("Einladungslink widerrufen. Bereits kopierte Informationen bleiben beim Empfänger.");
 }catch(error){message(error?.message||"Widerruf fehlgeschlagen");}
 finally{busy=false;$("private-invite-revoke").disabled=false}
}
window.addEventListener("badminton:private-invite",event=>{if(event.detail?.bookmark)open(event.detail.bookmark)});

window.badmintonPrivateInvite={hasActive:bookmark=>{
 const rec=entries()[inviteKey(bookmark)];
 return Boolean(rec&&Date.parse(rec.expires)>Date.now());
}};
