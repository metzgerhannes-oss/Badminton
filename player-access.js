/** Consent-only invitation for ONE verified player's stored match cards.
 * A local DBV profile is NOT an ownership grant. All checks are server-side. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {freshToken} from "./scripts/private-invite-utils.mjs";
import {getPrivateSession} from "./private-invites.js";
const STORE="schmetterlinge.privatePlayerInvites.v1";
const $=id=>document.getElementById(id);
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const read=()=>{
 try{
  const obj=JSON.parse(localStorage.getItem(STORE)||"{}");
  return obj&&typeof obj==="object"&&!Array.isArray(obj)?obj:{};
 }catch{return {}}
};
const save=map=>localStorage.setItem(STORE,JSON.stringify(map));
const records=()=>{const value=read()[selected];return Array.isArray(value)?value:
 value&&typeof value==="object"&&value.id?[value]:[]};
function selectedRecord(){return records().find(r=>r.id===selectedInviteId)||null}
function listInvites(){
 const list=$("private-player-links");
 list.replaceChildren();
 const rs=records();
 list.hidden=!rs.length;
 for(const rec of rs){
  if(!/^[0-9a-f-]{36}$/i.test(rec.id||""))continue;
  const option=document.createElement("option");option.value=rec.id;
  const stillOpen=Date.parse(rec.expires)>Date.now();
  option.textContent=(stillOpen?"Annahme bis ":"Annahmefrist abgelaufen: ")+
   new Date(rec.expires).toLocaleDateString("de-DE")+
   " · Link "+String(rec.id).slice(0,8);
  list.append(option);
 }
 if(!rs.some(r=>r.id===selectedInviteId))selectedInviteId=rs.at(-1)?.id||"";
 list.value=selectedInviteId;
 show(selectedRecord());
}
let selected=null,selectedInviteId="",busy=false;
function dialog(){
 if($("private-player-dialog"))return $("private-player-dialog");
 const dlg=document.createElement("dialog");dlg.id="private-player-dialog";dlg.className="private-player-share-dialog";
 dlg.innerHTML='<div class="modal"><h2>Spielerprofil privat teilen</h2>'+
 '<p class="small">Lade eine Person ein, diesem Spieler einen privaten Lesezugang zu geben. Der Link kann innerhalb von sieben Tagen einmal angenommen werden. Danach bleibt der Zugang auf dem Empfängergerät bis zu deinem Widerruf bestehen.</p>'+
 '<p class="small"><strong>Bei neuen Links freigegeben:</strong> Spielerprofil · belegte Trophäen (Platz 1–4) · vorhandene Matchstatistiken. Nur für den ausgewählten Spieler und erst nach unabhängiger Verwalterprüfung. Bereits bestehende Links behalten ihren bisherigen Umfang.</p>'+
 '<p id="private-player-status" role="status" aria-live="polite"></p>'+
 '<label for="private-player-links">Meine Einladungen (auch angenommene)</label><select id="private-player-links" hidden></select>'+
 '<label for="private-player-url">Einladungslink (nur bis Annahmefrist)</label><input id="private-player-url" type="text" readonly autocomplete="off" spellcheck="false">'+
 '<div class="private-invite-actions"><button id="private-player-create" type="button" class="primary-button">Link erstellen</button>'+
 '<button id="private-player-copy" type="button" class="outline-button" hidden>Kopieren</button>'+
 '<button id="private-player-revoke" type="button" class="outline-button" hidden>Widerrufen</button>'+
 '<button id="private-player-close" type="button" class="subtle-button">Schließen</button></div></div>';
 document.body.append(dlg);
 $("private-player-links").addEventListener("change",e=>{selectedInviteId=e.target.value;show(selectedRecord())});
 $("private-player-create").addEventListener("click",create);
 $("private-player-copy").addEventListener("click",copy);
 $("private-player-revoke").addEventListener("click",revoke);
 $("private-player-close").addEventListener("click",()=>dlg.close());
 return dlg;
}
function message(text){$("private-player-status").textContent=text}
function show(record){
 const valid=record&&Date.parse(record.expires)>Date.now()&&/^[a-f0-9]{64}$/.test(record.token);
 const url=valid?new URL("./private-player.html",location.href):null;
 if(url)url.hash="token="+record.token;
 $("private-player-url").value=url?.href||"";
 $("private-player-create").hidden=false;
 $("private-player-copy").hidden=!valid;
 $("private-player-revoke").hidden=!record;
}
async function rpc(name,body,token=null){
 const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
  method:"POST",cache:"no-store",headers:{
   apikey:PUBLIC_KEY,"Content-Type":"application/json",
   ...(token?{Authorization:"Bearer "+token}:{})
  },body:JSON.stringify(body)});
 if(!response.ok){
  const error=await response.json().catch(()=>({}));
  const e=new Error("Einladung fehlgeschlagen");
  e.status=response.status;e.code=String(error?.code||"");
  throw e;
 }
 return response.json();
}
function open(player){
 if(!DBV.test(player?.id||""))return;
 selected=player.id;
 const dlg=dialog();
 listInvites();
 message(records().length?
  "Du kannst bestehende Einladungen auswählen und jederzeit widerrufen.":
  "Deine Berechtigung wird auf dem Server geprüft. Bereits bestätigte eigene Profile können direkt geteilt werden.");
 if(!dlg.open)dlg.showModal();
 checkVerifiedPlayer(selected);
}
async function checkVerifiedPlayer(dbvId){
 try{
  const session=await getPrivateSession(false);
  if(!session||selected!==dbvId)return;
  const status=await rpc("private_owner_status",{},session.access_token);
  if(selected!==dbvId)return;
  if(status?.owner===true&&Array.isArray(status.granted_players)){
   if(status.granted_players.includes(dbvId))
    message("Berechtigung für diesen Spieler bereits bestätigt. Du kannst jetzt den Einladungslink erstellen.");
   else message("Für diesen Spieler fehlt noch die Bestätigung unter Einstellungen → Eigentümerverwaltung.");
  }
 }catch{/* Read failure must not create or revoke any sharing rights. */}
}
async function create(){
 if(!selected||busy)return;
 busy=true;$("private-player-create").disabled=true;
 try{
  // User actively requested a private cloud action. No account for browsing.
  const session=await getPrivateSession(true);
  // Never advertise the v2 bundle while a stale v1 backend may issue an older-scope link.
  const capability=await rpc("private_player_scope_capabilities",{},session.access_token);
  if(capability?.scope_version!==2||
   !["profile","trophies","matches"].every(section=>capability?.sections?.includes(section)))
   throw Object.assign(new Error("scope backend missing"),{scopeMissing:true});
  const token=freshToken();
  const result=await rpc("private_player_invite_create_v2",{p_token:token,p_player_dbv_id:selected,p_scope_confirmation:"profile+trophies+matches:v2"},session.access_token);
  const record=Array.isArray(result)?result[0]:null;
  if(!record?.invitation_id||!record?.expires_at)throw Error("not confirmed");
  const map=read();
  const previous=records();
  const recordForStore={id:record.invitation_id,token,expires:record.expires_at,scopeVersion:2};
  map[selected]=[...previous,recordForStore].slice(-30);
  selectedInviteId=recordForStore.id;save(map);listInvites();
  message("Neuer Berechtigungslink erstellt: Profil, Trophäen und vorhandene Matchstatistiken. Sieben Tage zur Annahme, danach bis zum Widerruf.");
 }catch(error){
  if(error?.scopeMissing||error?.status===404)
   message("Neue gemeinsame Freigaben sind serverseitig noch nicht aktiviert. Es wurde kein alter Link erstellt.");
  else if(error?.status===403||error?.code==="42501")
   message("Keine Freigabeberechtigung für diesen Spieler. Prüfe Einstellungen → Eigentümerverwaltung.");
  else if(error?.code==="22023")
   message("Zu viele aktive Einladungen oder Tageslimit erreicht. Widerrufe einen alten Link oder versuche es später.");
  else
   message("Technischer Fehler beim Erstellen (HTTP "+(error?.status||"Netzwerk")+"). Deine vorhandene Berechtigung bleibt erhalten.");
 }finally{busy=false;$("private-player-create").disabled=false}
}
async function copy(){
 const value=$("private-player-url").value;if(!value)return;
 try{
  if(!navigator.clipboard?.writeText)throw Error("clipboard");
  await navigator.clipboard.writeText(value);
  message("Link kopiert. Jeder mit dem Link kann ausschließlich den freigegebenen Spieler sehen.");
 }catch{
  $("private-player-url").focus();$("private-player-url").select();
  message("Bitte den markierten Link kopieren.");
 }
}
async function revoke(){
 if(!selected||busy)return;
 const rec=selectedRecord();if(!rec)return;
 busy=true;$("private-player-revoke").disabled=true;
 try{
  const session=await getPrivateSession(false);
  if(!session)throw Error("session missing");
  const result=await rpc("private_player_invite_revoke",{p_invitation_id:rec.id},session.access_token);
  if(result!==true)throw Error("not revoked");
  const map=read();map[selected]=records().filter(r=>r.id!==rec.id);
  selectedInviteId="";save(map);listInvites();
  window.dispatchEvent(new Event("badminton:private-player-revoked"));
  message("Zugriff serverseitig widerrufen – auch nach Ablauf der Annahmefrist. Bereits kopierte Informationen können nicht zurückgeholt werden.");
 }catch{message("Widerruf fehlgeschlagen. Die bestehende Sitzung wird benötigt.");}
 finally{busy=false;$("private-player-revoke").disabled=false}
}
window.addEventListener("badminton:player-private-share",e=>open(e.detail?.player));
