/** Consent-only one-way import of records the current device is already allowed to read.
 * No new permissions, cloud writes, background polling or mandatory account. */
import {matchArchiveSnapshot,requestPrivateMatches} from "./scripts/private-match-source.mjs";
import {trophySnapshot,requestPrivateTrophies} from "./scripts/private-trophy-source.mjs";
import {loadPlayerCopy,savePlayerCopy,deletePlayerCopy,serializePlayerDataExport} from "./scripts/consented-player-data.mjs";
const DBV=/^\d{2}-\d{6}$/;
const SEEN="schmetterlinge.playerCopyPrompted.v1",PENDING="schmetterlinge.pendingPlayerDataCopy.v1";
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
let target="",busy=false;
function dialog(){
 let d=$("player-copy-dialog");if(d)return d;
 d=document.createElement("dialog");d.id="player-copy-dialog";d.className="player-copy-dialog";
 d.innerHTML='<section class="player-copy-modal" aria-labelledby="player-copy-title">'+
  '<button type="button" id="player-copy-close" class="player-copy-close" aria-label="Fenster schließen" title="Schließen">×</button>'+
  '<h2 id="player-copy-title">Deine Daten übernehmen</h2>'+
  '<p id="player-copy-detail"></p>'+
  '<p>Einmalig und freiwillig: Wir prüfen deine bereits erteilte Spielerberechtigung und übernehmen vorhandene Matchkarten und belegte Top-4-Platzierungen auf dieses Gerät. Eine DBV-ID allein gibt keinen Zugriff.</p>'+
  '<p>Die lokale Kopie bleibt danach auch ohne Internet erhalten. Ein späterer Widerruf verhindert neue Abrufe, löscht aber keine bereits gespeicherte Kopie.</p>'+
  '<p class="settings-hint" id="player-copy-summary"></p>'+
  '<p role="status" aria-live="polite" id="player-copy-status"></p>'+
  '<div class="player-copy-actions">'+
  '<button type="button" id="player-copy-now" class="primary-button">Daten jetzt übernehmen</button>'+
  '<button type="button" id="player-copy-later" class="outline-button">Später</button>'+
   '<button type="button" id="player-copy-download" class="outline-button" hidden>Matchkarten und Trophäen herunterladen</button>'+
  '<button type="button" id="player-copy-remove" class="subtle-button" hidden>Lokale Kopie löschen</button>'+
  '</div></section>';
 document.body.append(d);
 $("player-copy-now").addEventListener("click",importNow);
 $("player-copy-close").addEventListener("click",()=>d.close());
 $("player-copy-later").addEventListener("click",()=>d.close());
 $("player-copy-download").addEventListener("click",downloadCopy);
 $("player-copy-remove").addEventListener("click",()=>{
  if(busy||!target)return;
  if(deletePlayerCopy(target))window.dispatchEvent(new CustomEvent("badminton:local-data-copy-updated",{detail:{playerId:target}}));
  updateSummary();$("player-copy-status").textContent="Die lokale Kopie wurde gelöscht.";
 });
 return d;
}
function updateSummary(){
 const item=loadPlayerCopy(target),el=$("player-copy-summary"),remove=$("player-copy-remove");
 if(!el)return;
 remove.hidden=!item;
 const download=$("player-copy-download");if(download)download.hidden=!item;
 el.textContent=item
  ?"Lokal gespeichert: "+new Date(item.fetchedAt).toLocaleString("de-DE")+" · "+(item.matches===null?"Matches nicht freigegeben":item.matches.length+" Matchkarten")+
   " · "+(item.trophies===null?"Trophäen nicht freigegeben":item.trophies.length+" Platzierungen")+" (Teilarchiv)."
  :"Noch keine lokale Datenkopie vorhanden.";
}
function open(player,{force=false}={}){
 player=String(player||"");
 if(!DBV.test(player))return;
 const seen=read(SEEN,{});
 if(!force&&seen[player])return;
 if(!force)try{localStorage.setItem(SEEN,JSON.stringify({...seen,[player]:Date.now()}))}catch{}
 target=player;
 const d=dialog(),copy=loadPlayerCopy(player);
 $("player-copy-detail").textContent="Gewähltes Spielerprofil: "+player+". Du kannst den freigegebenen Datenbestand einseitig auf dein Gerät kopieren.";
 $("player-copy-status").textContent=copy?"Erneuter Abruf benötigt eine weiterhin gültige Berechtigung.":"Der Abruf startet erst nach deiner Bestätigung.";
 $("player-copy-now").disabled=false;
 $("player-copy-later").textContent=copy?"Schließen":"Später";
 updateSummary();
 if(!d.open)d.showModal();
}
function downloadCopy(){
 if(busy||!DBV.test(target))return;
 const status=$("player-copy-status");
 const exported=serializePlayerDataExport(target);
 if(!exported){status.textContent="Noch keine gespeicherte, freigegebene Datenkopie vorhanden.";return}
 let link=null,url="";
 try{
  const blob=new Blob([exported],{type:"application/json;charset=utf-8"});
  url=URL.createObjectURL(blob);
  link=document.createElement("a");
  link.href=url;link.download="schmetterlinge-daten-"+target+"-"+new Date().toISOString().slice(0,10)+".json";
  document.body.append(link);link.click();
  status.textContent="Dateidownload gestartet. Die Datei enthält nur die zuvor auf diesem Gerät gespeicherten Matchkarten und Trophäen.";
 }catch{status.textContent="Dateidownload fehlgeschlagen. Die lokale Kopie bleibt unverändert."}
 finally{link?.remove();if(url)setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
async function importNow(){
 if(busy||!DBV.test(target))return;
 const player=target,b=$("player-copy-now"),status=$("player-copy-status");
 busy=true;b.disabled=true;status.textContent="Freigaben werden geprüft; vorhandene Daten werden gelesen …";
 try{
  // Existing server-checked read adapters, including complete 100-row pagination.
  await Promise.all([requestPrivateMatches(player,{force:true}),requestPrivateTrophies(player,{force:true})]);
  if(player!==target)return;
  const matches=matchArchiveSnapshot(player),trophies=trophySnapshot(player);
  const matchOk=matches.state==="ready"&&matches.coverage!=="device_snapshot";
  const trophyOk=trophies.state==="ready"&&trophies.coverage!=="device_snapshot";
  if(!matchOk&&!trophyOk){
   status.textContent="Für dieses Profil ist derzeit kein gültiger Datenabruf möglich. Bitte App-Zugang oder Spielerfreigabe prüfen. Bisherige Kopien bleiben erhalten.";
   return;
  }
  const old=loadPlayerCopy(player);
  const saved=savePlayerCopy(player,{
   matches:matchOk?matches.rows:(old?.matches??null),
   trophies:trophyOk?trophies.results:(old?.trophies??null)
  });
  if(!saved)throw Error("Die lokale Kopie konnte nicht gespeichert werden. Bitte freien Speicher prüfen.");
  updateSummary();
  $("player-copy-later").textContent="Schließen";
  window.dispatchEvent(new CustomEvent("badminton:local-data-copy-updated",{detail:{playerId:player}}));
  status.textContent="Übernahme abgeschlossen. Nur vorhandene, belegte Ergebnisse wurden gespeichert; keine vollständige Karrierehistorie zugesichert.";
  dialog().close();
  window.dispatchEvent(new CustomEvent("badminton:community-feedback",{detail:{message:"Daten erfolgreich auf diesem Gerät gespeichert."}}));
 }catch(error){status.textContent="Abruf fehlgeschlagen. "+String(error?.message||"Die alte Kopie bleibt unverändert.").slice(0,120)}
 finally{busy=false;b.disabled=false}
}
function current(){
 const stored=read("shuttleboard-v1",{});
 return String(stored.viewingFriendId||stored.activeProfileId||"");
}
document.addEventListener("DOMContentLoaded",()=>{
 const backup=$("backup-title")?.closest("section");
 if(backup){
  const container=document.createElement("div");container.className="player-copy-entry";
  const h=document.createElement("h3");h.textContent="Meine Daten";
  const p=document.createElement("p");p.className="settings-hint";
  p.textContent="Einmaliger Download vorhandener, freigegebener Spiel- und Trophäendaten. Auch später erneut möglich.";
  const button=document.createElement("button");button.type="button";button.className="outline-button";
  button.textContent="Daten für ausgewählten Spieler übernehmen";
  button.addEventListener("click",()=>{const id=current();if(DBV.test(id))open(id,{force:true});else p.textContent="Bitte zuerst ein Spielerprofil mit DBV-ID auswählen.";});
  container.append(h,p,button);backup.append(container);
 }
 let pending="";try{pending=localStorage.getItem(PENDING)||"";localStorage.removeItem(PENDING)}catch{}
 if(DBV.test(pending)&&current()===pending)open(pending,{force:true});
});
// Routine switches among already-configured players must never cover the app.
 // Only explicit first-time onboarding creates the one-time prompt.
window.addEventListener("badminton:profile-selected",event=>{
 const id=event.detail?.playerId;
 if(event.detail?.source==="onboarding"&&DBV.test(String(id||"")))open(id);
});
window.addEventListener("badminton:own-profile-added",event=>{const id=event.detail?.playerId;if(DBV.test(String(id||"")))open(id,{force:true})});
