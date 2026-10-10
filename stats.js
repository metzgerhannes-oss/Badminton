import {computeMatchStats,availableYears,DISCIPLINES} from "./scripts/match-stats.mjs";
const API="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/player_match_observations";
const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const $=id=>document.getElementById(id);
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const officialDate=s=>{if(!/^\d{4}-\d\d-\d\d$/.test(s||""))return "Datum nicht bekannt";return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));};
const sourceUrl=x=>{try{const u=new URL(x);return u.protocol==="https:"?u.href:""}catch{return ""}};
let selected="",records=[],status="idle",partial=false,seq=0;
let selectedYear="all",selectedDiscipline="all";
const PAGE_LIMIT=400,MAX_ROWS=10000;
async function query(dbvId,signal){
 const rows=[];
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE_LIMIT){
  const qs=new URLSearchParams({select:"dbv_id,match_id,tournament_name,match_date,event_code,discipline,match_status,player_side,winning_side,source_url,last_synced_at,opponent_names,game_score,countable,exclusion_reason",dbv_id:"eq."+dbvId,order:"match_date.desc.nullslast,match_id.asc",limit:String(PAGE_LIMIT),offset:String(offset)});
  const response=await fetch(API+"?"+qs,{signal,cache:"no-store",headers:{apikey:KEY,accept:"application/json"}});
  if(!response.ok)throw Error("Matchabfrage HTTP "+response.status);
  const data=await response.json();
  if(!Array.isArray(data))throw Error("Ungültige Matchdaten");
  rows.push(...data);
  if(data.length<PAGE_LIMIT)return {rows,partial:false};
 }
 return {rows,partial:true};
}
let controller;
async function fetchProfile(id,force=false){
 if(!/^\d{2}-\d{6}$/.test(id||"")){
  controller?.abort();++seq;
  selected=id||"";records=[];partial=false;status="missing-id";render();return;
 }
 if(id===selected&&!force&&status!=="error")return;
 if(id!==selected){selectedYear="all";selectedDiscipline="all";if($("match-stats-discipline"))$("match-stats-discipline").value="all";}
 selected=id;status="loading";records=[];partial=false;
 controller?.abort();
 controller=new AbortController();
 const ticket=++seq;
 render();
 try{
  const result=await query(id,controller.signal);
  if(ticket!==seq)return;
  records=result.rows;partial=result.partial;status="loaded";
 }catch(error){
  if(ticket!==seq||error?.name==="AbortError")return;
  console.warn("DBV match statistics unavailable:",error?.message);
  status="error";
 }
 if(ticket===seq)render();
}
function render(){
 const values=$("match-stats-values"),note=$("match-stats-note"),details=$("match-stats-details"),list=$("match-stats-list"),counter=$("match-stats-detail-count"),year=$("match-stats-year");
 if(!values||!note||!details||!list||!year)return;
 if(status==="loading"||status==="idle"){
  values.innerHTML='<p class="match-stats-empty">Offizielle Matchbelege werden geladen …</p>';
  note.textContent="Es werden nur belegte Ergebnisse gezählt.";details.hidden=true;return;
 }
 if(status==="error"){
  values.innerHTML='<p class="match-stats-empty">Die Matchstatistik ist derzeit nicht erreichbar.</p>';
  note.textContent="Keine geschätzten Ergebnisse. Die Datenquelle lässt sich später erneut laden.";details.hidden=true;return;
 }
 if(status==="missing-id"){
  values.innerHTML='<p class="match-stats-empty">Für Matchzahlen wird eine offizielle DBV-Spieler-ID benötigt.</p>';
  note.textContent="Eine manuelle Profilanlage erzeugt noch keine Spielstatistik.";details.hidden=true;return;
 }
 const yearOptions=availableYears(records);
 year.innerHTML='<option value="all">Gesamt</option>'+yearOptions.map(v=>'<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
 if(!yearOptions.includes(selectedYear))selectedYear="all";
 year.value=selectedYear;
 const stats=computeMatchStats(records,{year:selectedYear,discipline:selectedDiscipline});
 const missing=stats.total===0;
 values.innerHTML=[
  ["Gesamtspiele",missing?"–":stats.total,"matches"],
  ["Siege",missing?"–":stats.wins,"wins"],
  ["Niederlagen",missing?"–":stats.losses,"losses"],
  ["Siegquote",missing?"–":stats.rate+" %","rate"]
 ].map(([name,value,key])=>'<div class="match-stat '+key+'"><span>'+escape(name)+'</span><strong>'+escape(value)+'</strong></div>').join("");
 const last=records.map(x=>x.last_synced_at).filter(Boolean).sort().at(-1);
 const published=last?" · letzte geprüfte Übernahme "+officialDate(last.slice(0,10)):"";
 const situation=missing
  ?(records.length===0
    ?"Die detaillierte Spielhistorie wird noch ergänzt."
    :"Für diese Auswahl liegen keine einzeln geprüften Matches vor.")
  :"Gezählt: "+stats.total+" eindeutig abgeschlossene Begegnungen.";
 note.textContent=situation+
  (stats.excluded?" · "+stats.excluded+" offene oder unklare Begegnungen nicht berücksichtigt.":"")+
  (partial?" · Mehr als 10.000 Treffer: Anzeige unvollständig.":"")+
  published;
 details.hidden=stats.total===0;
 counter.textContent="("+stats.total+")";
 list.innerHTML=stats.details.map(m=>{
  const url=sourceUrl(m.source_url);
  return '<article class="match-proof"><div class="match-proof-head"><span class="'+(m.won?"match-win":"match-loss")+'">'+(m.won?"Sieg":"Niederlage")+'</span><time>'+escape(officialDate(m.match_date))+'</time><span>'+escape(m.discipline)+'</span></div>'+
   '<strong>'+escape(m.tournament_name||"Turnier nicht benannt")+'</strong>'+
   '<p>Gegen '+escape(m.opponent_names)+(m.game_score?' · Sätze (Seite 1:2) '+escape(m.game_score):' · Satzergebnis nicht erfasst')+'</p>'+
   (url?'<a href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">Originalbeleg ↗</a>':'<span>Originalbeleg nicht verfügbar</span>')+
   '</article>';
 }).join("");
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("match-stats"))return;
 $("match-stats-discipline").addEventListener("change",e=>{selectedDiscipline=e.target.value;render();});
 $("match-stats-year").addEventListener("change",e=>{selectedYear=e.target.value;render();});
 window.addEventListener("badminton:profile-change",e=>{fetchProfile(String(e.detail?.playerId||""));});
 fetchProfile(window.badmintonActivePlayerId||"");
});
