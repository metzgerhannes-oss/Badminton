/** Invited app members see the backed-up database coverage for the selected DBV ID.
 * This is a partial-source status, never a claim about all career matches. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
const root=document.getElementById("player-data-status");
const summary=document.getElementById("player-data-counts");
const detail=document.getElementById("player-data-coverage-note");
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const labels={complete:"Importlauf abgeschlossen",partial:"Quellen nur teilweise übernommen",
 awaiting_source:"Einzelmatch-Quelle noch ausstehend",loading:"Import läuft",queued:"Import vorgemerkt",
 checking:"Quellenabgleich läuft",error:"Letzter Quellenimport fehlgeschlagen"};
let selected="",revision=0,controller;
const fmt=n=>Number(n||0).toLocaleString("de-DE");
function setSelected(id){
 selected=String(id||"");
 const ticket=++revision;
 controller?.abort();
 if(!DBV.test(selected)||!window.badmintonAppAccess?.allowed){
  root.hidden=true;return;
 }
 root.hidden=false;
 summary.textContent="Datenbestand wird geprüft …";
 detail.textContent="Nur belegte Quellen werden ausgewertet.";
 controller=new AbortController();
 (async()=>{
  try{
   const token=await window.badmintonAppAccess?.getAccessToken?.();
   if(!token)throw Error("session expired");
   const response=await fetch(SUPABASE_ROOT+"rpc/app_access_player_coverage",{
    method:"POST",signal:controller.signal,cache:"no-store",
    headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({p_player_dbv_id:selected})
   });
   if(!response.ok)throw Error("data source not available");
   const data=await response.json();
   if(ticket!==revision||!data||data.dbv_id!==selected)return;
   const matches=Number(data.match_cards||0),places=Number(data.placements||0),
    trophies=Number(data.top_four||0);
   if(![matches,places,trophies].every(x=>Number.isSafeInteger(x)&&x>=0))throw Error("invalid coverage");
   summary.textContent=fmt(matches)+" belegte Matchkarten · "+fmt(places)+
     " Turnierplatzierungen · "+fmt(trophies)+" bestätigte Top-4-Ergebnisse";
   const status=labels[data.import_status]||"Quellenumfang nicht abschließend geprüft";
   const last=data.last_import?Date.parse(data.last_import):NaN;
   const date=Number.isFinite(last)?" · Letzter Importversuch: "+
    new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeZone:"Europe/Berlin"}).format(new Date(last)):"";
   detail.textContent=status+date+
     ". Das sind die in der App belegten Datensätze, nicht zwingend alle je gespielten Matches.";
  }catch(e){
   if(ticket!==revision||e?.name==="AbortError")return;
   summary.textContent="Datenstand vorübergehend nicht abrufbar";
   detail.textContent="Ein Abruffehler bedeutet nicht, dass Spiele oder Platzierungen fehlen.";
  }
 })();
}
window.addEventListener("badminton:profile-change",event=>setSelected(event.detail?.playerId));
window.addEventListener("badminton:app-access-granted",()=>setSelected(window.badmintonActivePlayerId||selected));
document.addEventListener("DOMContentLoaded",()=>{
 if(window.badmintonAppAccess?.allowed)setSelected(window.badmintonActivePlayerId||"");
});
