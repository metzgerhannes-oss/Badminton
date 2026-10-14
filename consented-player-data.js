/** Consent-only one-way import of records the current device is already allowed to read.
 * No new permissions, cloud writes, background polling or mandatory account. */
import {matchArchiveSnapshot,requestPrivateMatches} from "./scripts/private-match-source.mjs";
import {trophySnapshot,requestPrivateTrophies} from "./scripts/private-trophy-source.mjs";
import {loadPlayerCopy,savePlayerCopy,deletePlayerCopy} from "./scripts/consented-player-data.mjs";
const DBV=/^\d{2}-\d{6}$/;
const SEEN="schmetterlinge.playerCopyPrompted.v1",PENDING="schmetterlinge.pendingPlayerDataCopy.v1";
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
let target="",busy=false;
function dialog(){
 let d=$("player-copy-dialog");if(d)return d;
 d=document.createElement("dialog");d.id="player-copy-dialog";d.className="player-copy-dialog";
 d.innerHTML='<section class="player-copy-modal" aria-labelledby="player-copy-title">'+
  '<h2 id="player-copy-title">Deine Daten übernehmen</h2>'+
  '<p id="player-copy-detail"></p>'+
  '<p>Einmalig und freiwillig: Wir prüfen deine bereits erteilte Spielerberechtigung und übernehmen vorhandene Matchkarten und belegte Top-4-Platzierungen auf dieses Gerät. Eine DBV-ID allein gibt keinen Zugriff.</p>'+
  '<p>Die lokale Kopie bleibt danach auch ohne Internet erhalten. Ein späterer Widerruf verhindert neue Abrufe, löscht aber keine bereits gespeicherte Kopie.</p>'+
  '<p class="settings-hint" id="player-copy-summary"></p>'+
  '<p role="status" aria-live="polite" id="player-copy-status"></p>'+
  '<div class="player-copy-actions">'+
  '<button type="button" id="player-copy-now" class="primary-button">Daten jetzt übernehmen</button>'+
  '<button type="button" id="player-copy-later" class="outline-button">Später</button>'+
  '<button type="button" id="player-copy-remove" class="subtle-button" hidden>Lokale Kopie löschen</button>'+
  '</div></section>';
 document.body.append(d);
 $("player-copy-now").addEventListener("click",importNow);
 $("player-copy-later").addEventListener("click",()=>d.close());
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
 updateSummary();
 if(!d.open)d.showModal();
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
   status.textContent="Keine gültige Datenfreigabe für dieses Profil auf diesem Gerät. Bitte zuerst den Spieler-Berechtigungslink annehmen. Bisherige Kopien bleiben erhalten.";
   return;
  }
  const old=loadPlayerCopy(player);
  const saved=savePlayerCopy(player,{
   matches:matchOk?matches.rows:(old?.matches??null),
   trophies:trophyOk?trophies.results:(old?.trophies??null)
  });
  if(!saved)throw Error("Die lokale Kopie konnte nicht gespeichert werden. Bitte freien Speicher prüfen.");
  updateSummary();
  window.dispatchEvent(new CustomEvent("badminton:local-data-copy-updated",{detail:{playerId:player}}));
  status.textContent="Übernahme abgeschlossen. Nur vorhandene, belegte Ergebnisse wurden gespeichert; keine vollständige Karrierehistorie zugesichert.";
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
window.addEventListener("badminton:profile-selected",event=>{const id=event.detail?.playerId;if(DBV.test(String(id||"")))open(id)});
window.addEventListener("badminton:own-profile-added",event=>{const id=event.detail?.playerId;if(DBV.test(String(id||"")))open(id,{force:true})});
