/** Offline device data export/import. No upload and no third-party requests. */
import {
 LOCAL_STORE_KEY,MAX_BACKUP_BYTES,createLocalBackup,inspectLocalBackup
} from "./scripts/local-backup.mjs";

const $=id=>document.getElementById(id);
const feedback=(message,error=false)=>{
 const node=$("backup-feedback");
 if(!node)return;
 node.textContent=message;
 node.dataset.error=error?"true":"false";
};
let pending=null;
function resetSelection(){
 pending=null;
 const button=$("backup-restore");
 if(button)button.disabled=true;
}
function save(){
 try{
  const stored=localStorage.getItem(LOCAL_STORE_KEY);
  const archive=createLocalBackup(stored);
  const blob=new Blob([archive],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  const date=new Date().toISOString().slice(0,10);
  link.href=url;
  link.download="schmetterlinge-sicherung-"+date+".json";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  feedback("Sicherung erstellt. Die Datei bleibt auf deinem Gerät, bis du sie selbst teilst oder löschst.");
 }catch(err){feedback(err?.message||"Sicherung konnte nicht erstellt werden.",true)}
}
async function preview(file){
 resetSelection();
 if(!file){feedback("Wähle zuerst eine Sicherungsdatei.");return}
 if(file.size>MAX_BACKUP_BYTES){
  feedback("Die ausgewählte Datei ist zu groß.",true);return;
 }
 try{
  const text=await file.text();
  const inspected=inspectLocalBackup(text);
  pending=inspected;
  const s=inspected.summary;
  const when=new Intl.DateTimeFormat("de-DE",{
   dateStyle:"medium",timeZone:"Europe/Berlin"
  }).format(new Date(inspected.createdAt));
  feedback("Sicherung vom "+when+": "+s.players+" eigene Spieler, "+
   s.friends+" Freunde und "+s.tournaments+" Turnierfavoriten. Aktives Profil: "+
   s.activePlayer+". Prüfe die Angaben und bestätige erst dann die Wiederherstellung.");
  $("backup-restore").disabled=false;
 }catch(err){feedback(err?.message||"Sicherungsdatei nicht gültig.",true)}
}
function restore(){
 if(!pending)return;
 const s=pending.summary;
 const prompt="Vorhandene Profile, gefolgte Spieler und Turnierfavoriten auf DIESEM Gerät werden ersetzt.\n\n"+
  "In der ausgewählten Sicherung: "+s.players+" eigene Spieler, "+s.friends+
  " Freunde und "+s.tournaments+" Turnierfavoriten.\n\n"+
  "Wenn du die aktuellen Daten behalten möchtest, erstelle zuerst eine eigene Sicherung.\n\n"+
  "Jetzt wirklich wiederherstellen?";
 if(!window.confirm(prompt)){feedback("Wiederherstellung abgebrochen. Deine Daten sind unverändert.");return}
 try{
  // Only the documented local family key is replaced; cloud data and other
  // unrelated device settings are untouched.
  localStorage.setItem(LOCAL_STORE_KEY,JSON.stringify(pending.data));
  feedback("Spieler und Turnierfavoriten wiederhergestellt. Die App wird neu geladen.");
  window.location.hash="#start";
  window.location.reload();
 }catch(err){feedback("Die Wiederherstellung konnte nicht gespeichert werden. Bitte prüfe den Gerätespeicher.",true)}
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("backup-export"))return;
 $("backup-export").addEventListener("click",save);
 $("backup-file").addEventListener("change",e=>void preview(e.target.files?.[0]));
 $("backup-restore").addEventListener("click",restore);
});
