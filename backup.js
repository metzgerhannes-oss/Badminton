/** Offline device data export/import. No upload and no third-party requests. */
import {
 LOCAL_STORE_KEY,SPOND_STORE_KEY,MAX_BACKUP_BYTES,createLocalBackup,inspectLocalBackup
} from "./scripts/local-backup.mjs";

const $=id=>document.getElementById(id);
const feedback=(message,error=false)=>{
 const node=$("backup-feedback");
 if(!node)return;
 node.textContent=message;
 node.dataset.error=error?"true":"false";
};
let pending=null,selectionVersion=0;
function resetSelection(){
 selectionVersion++;
 pending=null;
 const button=$("backup-restore");
 if(button)button.disabled=true;
}
function save(){
 try{
  const stored=localStorage.getItem(LOCAL_STORE_KEY);
  const archive=createLocalBackup(stored,new Date(),localStorage.getItem(SPOND_STORE_KEY));
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
 const version=selectionVersion;
 if(!file){feedback("Wähle zuerst eine Sicherungsdatei.");return}
 if(file.size>MAX_BACKUP_BYTES){
  feedback("Die ausgewählte Datei ist zu groß.",true);return;
 }
 try{
  const text=await file.text();
  if(version!==selectionVersion)return;
  const inspected=inspectLocalBackup(text);
  pending=inspected;
  const s=inspected.summary;
  const when=new Intl.DateTimeFormat("de-DE",{
   dateStyle:"medium",timeZone:"Europe/Berlin"
  }).format(new Date(inspected.createdAt));
  feedback("Sicherung vom "+when+" · Eigene Profile: "+s.players+
   " · Gefolgte Spieler: "+s.friends+" · Turnierfavoriten: "+s.tournaments+
   (s.calendarEvents===null
    ?" · Ältere Sicherung: private Kalendertermine sind nicht enthalten und werden nicht verändert."
    :" · Private Kalendertermine: "+s.calendarEvents)+
   ". Aktives Profil: "+s.activePlayer+
   ". Prüfe die Angaben vor der Wiederherstellung.");
  $("backup-restore").disabled=false;
 }catch(err){feedback(err?.message||"Sicherungsdatei nicht gültig.",true)}
}
function restore(){
 if(!pending)return;
 const s=pending.summary;
 const prompt="Vorhandene Profile, gefolgte Spieler und Turnierfavoriten auf DIESEM Gerät werden ersetzt."+
  (s.calendarEvents===null?" Private Kalendertermine bleiben unverändert.":" Auch die privaten Kalendertermine werden ersetzt.")+
  "\\n\\nIn der Sicherung: "+s.players+" eigene Profile, "+s.friends+
  " gefolgte Spieler, "+s.tournaments+" Turnierfavoriten"+
  (s.calendarEvents===null?" (alte Sicherung ohne Kalendertermine).":", "+s.calendarEvents+" private Kalendertermine.")+
  "\\n\\nWenn du die aktuellen Daten behalten möchtest, erstelle zuerst eine eigene Sicherung."+
  "\\n\\nJetzt wirklich wiederherstellen?";
 if(!window.confirm(prompt)){feedback("Wiederherstellung abgebrochen. Deine Daten sind unverändert.");return}
 const previousFamily=localStorage.getItem(LOCAL_STORE_KEY);
 const previousCalendar=localStorage.getItem(SPOND_STORE_KEY);
 try{
  // Preserve unrelated settings, cloud data and all private third-party caches.
  localStorage.setItem(LOCAL_STORE_KEY,JSON.stringify(pending.data));
  if(pending.calendarEvents!==null)
   localStorage.setItem(SPOND_STORE_KEY,JSON.stringify(pending.calendarEvents));
  feedback("Spieler, Favoriten und enthaltene Kalendertermine wiederhergestellt. Die App wird neu geladen.");
  window.location.hash="#start";
  window.location.reload();
 }catch(err){
  // Two localStorage keys are not transactional: best-effort rollback on errors.
  try{
   if(previousFamily===null)localStorage.removeItem(LOCAL_STORE_KEY);
   else localStorage.setItem(LOCAL_STORE_KEY,previousFamily);
   if(previousCalendar===null)localStorage.removeItem(SPOND_STORE_KEY);
   else localStorage.setItem(SPOND_STORE_KEY,previousCalendar);
  }catch{}
  feedback("Wiederherstellung fehlgeschlagen. Die bisherigen Daten wurden nach Möglichkeit beibehalten.",true);
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("backup-export"))return;
 $("backup-export").addEventListener("click",save);
 $("backup-file").addEventListener("change",e=>void preview(e.target.files?.[0]));
 $("backup-restore").addEventListener("click",restore);
});
