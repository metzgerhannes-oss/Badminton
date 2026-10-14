/** Owner-only panel. The backend checks the owner identity on every request. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
const panel=document.getElementById("owner-admin-panel");
const status=document.getElementById("owner-admin-status");
const form=document.getElementById("owner-admin-form");
const player=document.getElementById("owner-admin-player");
const verify=document.getElementById("owner-admin-confirm");
const list=document.getElementById("owner-admin-grants");
const ownList=document.getElementById("owner-admin-my-players");
const search=document.getElementById("owner-admin-search");
const candidates=document.getElementById("owner-admin-candidates");
const manual=document.querySelector(".owner-admin-manual");
const TOKEN=/^[0-9]{2}-[0-9]{6}$/;
let verifiedIds=new Set();
let session=null,loading=false;
async function rpc(name,args={}){
 if(!session?.access_token)throw Error("no owner session");
 const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
  method:"POST",cache:"no-store",
  headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
  body:JSON.stringify(args)});
 if(!response.ok)throw Error("permission denied");
 return response.json();
}
function localProfiles(){
 try{
  const data=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
  return Array.isArray(data.players)?data.players.filter(x=>TOKEN.test(x?.id||"")).slice(0,12):[];
 }catch{return []}
}
function updateCandidates(){
 ownList.replaceChildren();candidates.replaceChildren();
 const profiles=localProfiles();
 const q=String(search?.value||"").trim().normalize("NFKC").toLocaleLowerCase("de");
 let count=0;
 for(const item of profiles){
  const opt=document.createElement("option");opt.value=item.id;
  opt.label=(item.name||"Eigenes Profil")+" · "+item.id;ownList.append(opt);
  if(q&&!((item.name||"")+" "+item.id).normalize("NFKC").toLocaleLowerCase("de").includes(q))continue;
  count++;
  const entry=document.createElement("div");entry.className="owner-admin-candidate";
  const title=document.createElement("span");
  title.textContent=(item.name||"Eigenes Profil")+" · "+item.id;
  const confirmed=verifiedIds.has(item.id);
  const button=document.createElement("button");button.type="button";
  button.className=confirmed?"primary-button":"outline-button";
  button.textContent=confirmed?"Privaten Link prüfen":"Selbstauskunft erfassen";
  button.addEventListener("click",()=>{
   if(confirmed){
    window.dispatchEvent(new CustomEvent("badminton:player-private-share",{detail:{player:item}}));
   }else{
    manual.open=true;player.value=item.id;verify.focus();
    status.textContent="Erfasse deine Selbstauskunft für "+(item.name||item.id)+". Sie ersetzt keine unabhängige Freigabeprüfung.";
   }
  });
  if(confirmed){const mark=document.createElement("small");mark.textContent="Als eigener Spieler ausdrücklich bestätigt · Archivlinks können erstellt werden";entry.append(title,mark,button);}
  else entry.append(title,button);
  candidates.append(entry);
 }
 if(!count){
  const hint=document.createElement("p");
  hint.textContent=profiles.length?"Kein passendes eigenes Profil gefunden.":"Keine eigenen Profile auf diesem Gerät gefunden.";
  candidates.append(hint);
 }
}
search.addEventListener("input",updateCandidates);
function updateGrants(grants){
 verifiedIds=new Set(grants.filter(id=>TOKEN.test(id)));
 updateCandidates();
 list.replaceChildren();
 if(!grants.length){const li=document.createElement("li");li.textContent="Noch keine eigenen Spieler freigegeben.";list.append(li);return}
 for(const id of grants){
  if(!TOKEN.test(id))continue;
  const li=document.createElement("li");li.textContent="DBV "+id+" · ";
  const button=document.createElement("button");button.type="button";button.className="outline-button";
  button.textContent="Berechtigung widerrufen";button.dataset.revoke=id;
  li.append(button);list.append(li);
 }
}
async function loadOwner(){
 if(loading)return;
 loading=true;
 try{
  session=await getPrivateSession(false);
  if(!session)return; // Browsers do not create an account simply by opening settings.
  const info=await rpc("private_owner_status");
  if(info?.owner!==true)return;
  panel.hidden=false;
  status.textContent="Betreiberzugang erkannt. Ausdrücklich bestätigte eigene Spieler kannst du über einen Berechtigungslink teilen; für andere Spieler bleibt eine unabhängige Freigabe erforderlich.";
  updateCandidates();
  updateGrants(Array.isArray(info.granted_players)?info.granted_players:[]);
 }catch{if(!panel.hidden)status.textContent="Administratorsitzung derzeit nicht erreichbar. Bitte erneut öffnen."}
 finally{loading=false}
}
form.addEventListener("submit",async event=>{
 event.preventDefault();
 const id=String(player.value||"").trim();
 if(!TOKEN.test(id)||!verify.checked){
  status.textContent="DBV-ID prüfen und Berechtigung ausdrücklich bestätigen.";return;
 }
 const button=form.querySelector('button[type="submit"]');button.disabled=true;
 try{
  const ok=await rpc("private_owner_player_attest",{p_player_dbv_id:id,p_guardian_attestation:true});
  if(ok!==true)throw Error("not entitled");
  verify.checked=false;player.value="";
  const state=await rpc("private_owner_status");
  updateGrants(Array.isArray(state?.granted_players)?state.granted_players:[]);
  status.textContent="Bestätigung gespeichert. Für diesen eigenen Spieler kannst du nun den Link mit Profil, belegten Trophäen und vorhandenen Matchstatistiken erstellen.";
 }catch{status.textContent="Berechtigung nicht erstellt. Prüfe, ob die DBV-ID existiert und die Eigentümersitzung gültig ist."}
 finally{button.disabled=false}
});
list.addEventListener("click",async e=>{
 const button=e.target.closest("button[data-revoke]");if(!button)return;
 const id=button.dataset.revoke;
 if(!TOKEN.test(id)||!confirm("Berechtigung für DBV "+id+" widerrufen? Alle zugehörigen privaten Einladungen verlieren sofort ihre Gültigkeit."))return;
 button.disabled=true;
 try{
  if(await rpc("private_owner_player_revoke",{p_player_dbv_id:id})!==true)throw Error("no grant");
  const state=await rpc("private_owner_status");
  updateGrants(Array.isArray(state?.granted_players)?state.granted_players:[]);
  window.dispatchEvent(new Event("badminton:private-player-revoked"));
  status.textContent="Berechtigung widerrufen; bestehende private Lesezugriffe sind damit gesperrt.";
 }catch{button.disabled=false;status.textContent="Widerruf derzeit fehlgeschlagen."}
});
document.addEventListener("DOMContentLoaded",loadOwner);
window.addEventListener("hashchange",()=>{if(location.hash==="#einstellungen")loadOwner()});
