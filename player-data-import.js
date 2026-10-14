/** Consent-only, one-way transfer: accepted device-scoped player permissions -> local data.
 * No automatic reads, no synthetic authorization, no background synchronization. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
import {acceptedInvitationsFor,cleanImportedProfile,cleanImportedMatches,cleanImportedTrophies,loadImportedSnapshot,saveImportedSnapshot,deleteImportedSnapshot} from "./scripts/player-data-import.mjs";

const DBV=/^\d{2}-\d{6}$/;
const SEEN="schmetterlinge.dataImportPrompted.v1";
const pending="schmetterlinge.pendingProfileDataImport.v1";
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const truncate=(value,max=80)=>String(value||"").slice(0,max);
const currentProfileId=()=>{
 const saved=read("shuttleboard-v1",{});
 return String(saved?.viewingFriendId||saved?.activeProfileId||saved?.chosen||"");
};
let focused="",busy=false,lastOpened="";
function view(){
 let dialog=$("player-data-import-dialog");
 if(dialog)return dialog;
 dialog=document.createElement("dialog");dialog.id="player-data-import-dialog";dialog.className="player-data-import-dialog";
 dialog.innerHTML='<div class="player-data-modal">'+
  '<h2 id="player-data-import-heading">Deine Daten übernehmen</h2>'+
  '<p id="player-data-import-intro"></p>'+
  '<p class="player-data-hint">Mit einer angenommenen persönlichen Einladung kannst du freigegebene Profildaten und Matchkarten abrufen. Belegte Trophäen sind nur mit einer neuen entsprechenden Freigabe verfügbar. Deine Profilwahl allein erteilt keine Berechtigung.</p>'+
  '<p class="player-data-hint">Der Abruf ist einmalig und freiwillig. Bei erfolgreichem Import wird eine Kopie auf diesem Gerät gespeichert und bleibt auch offline erhalten. Nach einem Widerruf sind neue Abrufe gesperrt; bereits gespeicherte Kopien werden nicht aus der Ferne gelöscht.</p>'+
  '<p id="player-data-import-summary" class="player-data-summary"></p>'+
  '<p id="player-data-import-status" role="status" aria-live="polite"></p>'+
  '<div class="player-data-actions">'+
   '<button type="button" id="player-data-import-now" class="primary-button">Daten jetzt abrufen</button>'+
   '<button type="button" id="player-data-import-later" class="outline-button">Später</button>'+
   '<button type="button" id="player-data-import-delete" class="subtle-button" hidden>Lokale Kopie löschen</button>'+
  '</div></div>';
 document.body.append(dialog);
 $("player-data-import-now").addEventListener("click",()=>download());
 $("player-data-import-later").addEventListener("click",()=>dialog.close());
 $("player-data-import-delete").addEventListener("click",()=>{
  if(!focused||busy)return;
  deleteImportedSnapshot(focused);refresh();
  window.dispatchEvent(new CustomEvent("badminton:data-import-updated",{detail:{playerId:focused,deleted:true}}));
  $("player-data-import-status").textContent="Lokale Kopie entfernt. Weitere Abrufe erfordern erneut eine gültige Freigabe.";
 });
 return dialog;
}
function refresh(){
 const snapshot=loadImportedSnapshot(focused);
 const summary=$("player-data-import-summary");
 const remove=$("player-data-import-delete");
 if(!summary||!remove)return;
 remove.hidden=!snapshot;
 if(snapshot){
  const when=new Date(snapshot.fetchedAt).toLocaleString("de-DE");
  summary.textContent="Lokal gespeichert seit "+when+" · "+
   snapshot.matches.length+" verfügbare Matchkarten"+
   (snapshot.trophies===null?" · Trophäen nicht freigegeben":" · "+snapshot.trophies.length+" belegte Top-4-Platzierungen")+
   ". Keine vollständige Karrierehistorie.";
 }else summary.textContent="Für dieses Profil ist noch keine private Datenkopie auf diesem Gerät gespeichert.";
}
function open(id,{force=false}={}){
 id=String(id||"");
 if(!id||id==="all")return;
 const seen=read(SEEN,{});
 if(!force&&seen[id])return;
 if(!force){
  try{localStorage.setItem(SEEN,JSON.stringify({...seen,[id]:Date.now()}));}catch{}
 }
 focused=id;lastOpened=id;
 const dlg=view();
 $("player-data-import-intro").textContent=DBV.test(id)
  ?"Profil "+id+" ist ausgewählt. Jetzt kannst du die für dieses Profil freigegebenen Daten einmalig auf dieses Gerät übernehmen."
  :"Das Profil ist ausgewählt, aber eine gültige DBV-Spieler-ID fehlt noch. Ergänze sie zuerst in den Profileinstellungen.";
 $("player-data-import-now").disabled=!DBV.test(id);
 $("player-data-import-status").textContent=DBV.test(id)
  ?"Der Download beginnt ausschließlich nach deiner Bestätigung. Ohne angenommene Freigabe wird nichts heruntergeladen."
  :"Ohne DBV-ID ist kein geschützter Datenabruf möglich.";
 refresh();
 if(!dlg.open)dlg.showModal();
}
async function rpc(name,args,session){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
 try{
  const res=await fetch(SUPABASE_ROOT+"rpc/"+name,{method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
   body:JSON.stringify(args)});
  if(res.status===401||res.status===403)return null;
  if(!res.ok)throw Error("Der Datenabruf ist derzeit nicht verfügbar (HTTP "+res.status+").");
  return await res.json();
 }finally{clearTimeout(timer)}
}
async function download(){
 const target=focused;if(!DBV.test(target)||busy)return;
 busy=true;
 const submit=$("player-data-import-now"),status=$("player-data-import-status");
 submit.disabled=true;status.textContent="Berechtigung wird geprüft und verfügbare Daten werden abgerufen …";
 try{
  const session=await getPrivateSession(false);
  if(!session){
   status.textContent="Noch keine angenommene Freigabe auf diesem Gerät. Öffne zuerst den persönlichen Berechtigungslink und nimm ihn an. Die bloße DBV-ID reicht nicht.";
   return;
  }
  let profile=null,matches=[],trophies=null;
  const ids=acceptedInvitationsFor(target,localStorage);
  for(const invitation of ids){
   const result=await rpc("private_player_access_read",{p_invitation_id:invitation},session);
   const validated=cleanImportedProfile(result?.player,target);
   if(!validated)continue;
   profile=validated;matches=cleanImportedMatches(result?.matches);
   const raw=await rpc("private_player_trophies_read",{p_invitation_id:invitation},session);
   trophies=cleanImportedTrophies(raw,target);
   break;
  }
  if(!profile){
   // An independently verified player manager may read sourced trophies without
   // possessing a recipient invitation. Do not grant them profile/match rights.
   const owner=await rpc("private_owner_trophies_read",{p_player_dbv_id:target},session);
   trophies=cleanImportedTrophies(owner,target);
  }
  if(!profile&&trophies===null){
   status.textContent="Keine gültige Datenfreigabe für dieses Profil gefunden. Bitte erst den persönlichen Link annehmen oder eine unabhängige Verwalterprüfung abschließen. Andere Spieler bleiben geschützt.";
   return;
  }
  const saved=saveImportedSnapshot(target,{profile,matches,trophies,fetchedAt:new Date().toISOString()},localStorage);
  if(!saved)throw Error("Auf dem Gerät fehlt Speicherplatz oder die lokale Datenspeicherung ist deaktiviert.");
  refresh();
  status.textContent="Import abgeschlossen. Die verfügbaren Daten sind jetzt lokal gespeichert. Für einen neuen Abruf wird die Freigabe erneut serverseitig geprüft.";
  window.dispatchEvent(new CustomEvent("badminton:data-import-updated",{detail:{playerId:target,imported:true}}));
 }catch(error){
  status.textContent=truncate(error?.message||"Abruf fehlgeschlagen. Die bestehende lokale Kopie bleibt unverändert.",190);
 }finally{busy=false;submit.disabled=!DBV.test(focused)}
}
window.badmintonPromptDataImport=(id,options)=>open(id,options);
window.addEventListener("badminton:profile-selected",event=>{
 const id=event.detail?.playerId;
 if(id)open(id);
});
window.addEventListener("badminton:private-player-revoked",()=>{
 if($("player-data-import-dialog")?.open)$("player-data-import-status").textContent="Die Freigabe wurde widerrufen. Neue Abrufe sind gesperrt. Bereits lokal gespeicherte Kopien kannst du hier löschen.";
});
document.addEventListener("DOMContentLoaded",()=>{
 const room=$("settings-room-daten")||$("view-einstellungen");
 if(room){
  const section=document.createElement("section");section.className="settings-card";
  const h=document.createElement("h3");h.textContent="Meine Daten";
  const p=document.createElement("p");p.className="settings-hint";
  p.textContent="Freigegebene Daten des ausgewählten Spielers jederzeit erneut abrufen oder eine vorhandene lokale Kopie löschen.";
  const button=document.createElement("button");button.type="button";button.className="outline-button";
  button.textContent="Daten für ausgewähltes Profil verwalten";
  button.addEventListener("click",()=>{
   const id=currentProfileId();
   if(id)open(id,{force:true});
   else{p.textContent="Wähle zuerst ein Spielerprofil aus."; }
  });
  section.append(h,p,button);room.append(section);
 }
 // New installations and the separate Welcome page can pass a local selection
 // hint. It contains only a DBV ID; never a token or authority assertion.
 let id="";
 try{id=localStorage.getItem(pending)||"";localStorage.removeItem(pending)}catch{}
 if(id&&id.length<=60){
  const saved=read("shuttleboard-v1",{});
  if(saved?.activeProfileId===id||saved?.viewingFriendId===id)open(id,{force:true});
 }
});
