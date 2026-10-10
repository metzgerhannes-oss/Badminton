import {computeMatchStats,availableYears} from "./scripts/match-stats.mjs";
import {computeExternalStats,sourceMatchYears,importCompleteness} from "./scripts/external-match-stats.mjs";
import {matchAvailability} from "./scripts/match-availability.mjs";
import {ageContextBreakdown} from "./scripts/match-age-context.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateLabel=s=>{
 if(!/^\d{4}-\d\d-\d\d$/.test(s||""))return "Datum nicht angegeben";
 return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"})
  .format(new Date(s+"T12:00:00Z"));
};
const sourceUrl=x=>{try{let u=new URL(x);return u.protocol==="https:"&&
 ["badhub.de","dbv.turnier.de","turnier.de"].includes(u.hostname)?u.href:""}catch{return ""}};
const ownScore=m=>(Array.isArray(m.games)?m.games:[])
 .map(g=>m.player_side===2?g[1]+":"+g[0]:g[0]+":"+g[1]).join(" · ");
let selected="",official=[],external=[],progress=null,officialError=false,externalError=false,
 status="idle",partialOfficial=false,partialExternal=false,seq=0,lastLoadedAt=0;
let selectedYear="all",selectedDiscipline="all",selectedAgeClass="all",birthYear=null;
const PAGE_LIMIT=400,MAX_ROWS=10000;
let controller;
async function getPage(path,signal){
 const {rows}=await readPublicRows(path,{signal,count:false});
 return rows;
}
async function queryOfficial(id,signal){
 const rows=[];
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE_LIMIT){
  const qs=new URLSearchParams({
   select:"dbv_id,match_id,tournament_name,match_date,event_code,discipline,match_status,player_side,winning_side,source_url,last_synced_at,opponent_names,game_score,countable,exclusion_reason",
   dbv_id:"eq."+id,order:"match_date.desc.nullslast,match_id.asc",
   limit:String(PAGE_LIMIT),offset:String(offset)
  });
  const data=await getPage("player_match_observations?"+qs,signal);
  rows.push(...data);
  if(data.length<PAGE_LIMIT)return {rows,partial:false};
 }
 return {rows,partial:true};
}
async function queryExternal(id,signal){
 const [status]=await getPage("player_external_match_imports?"+
  new URLSearchParams({select:"status,cursor_offset,verified_count,rejected_count,detail,last_finished_at",
   dbv_id:"eq."+id,limit:"1"}),signal);
 const rows=[];
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE_LIMIT){
  const qs=new URLSearchParams({
   select:"source_key,category,competition,discipline,event,round_label,match_date,match_year,player_side,winning_side,opponent_names,partner_names,games,source_url",
   dbv_id:"eq."+id,order:"match_year.desc,match_date.desc.nullslast,source_key.asc",
   limit:String(PAGE_LIMIT),offset:String(offset)
  });
  const data=await getPage("player_external_match_facts?"+qs,signal);
  rows.push(...data);
  if(data.length<PAGE_LIMIT)return {rows,progress:status||null,partial:false};
 }
 return {rows,progress:status||null,partial:true};
}
async function queryBirthYear(id,signal){
 const [profile]=await getPage("players?"+
  new URLSearchParams({select:"birth_year",dbv_id:"eq."+id,limit:"1"}),signal);
 const birth=profile?.birth_year;
 return Number.isInteger(birth)&&birth>=1900&&birth<=2100?birth:null;
}
async function fetchProfile(id,force=false){
 if(!/^\d{2}-\d{6}$/.test(id||"")){
  controller?.abort();++seq;selected=id||"";official=[];external=[];
  progress=null;birthYear=null;status="missing-id";render();return;
 }
 if(id===selected&&!force&&status==="loaded")return;
 if(id!==selected){
  selectedYear="all";selectedDiscipline="all";selectedAgeClass="all";
  if($("match-stats-discipline"))$("match-stats-discipline").value="all";
   if($("match-stats-age"))$("match-stats-age").value="all";
 }
 selected=id;status="loading";official=[];external=[];progress=null;birthYear=null;
 officialError=false;externalError=false;partialOfficial=false;partialExternal=false;
 controller?.abort();controller=new AbortController();
 const ticket=++seq,signal=controller.signal;
 render();
 const results=await Promise.allSettled([queryOfficial(id,signal),queryExternal(id,signal),queryBirthYear(id,signal)]);
 if(ticket!==seq||signal.aborted)return;
 if(results[0].status==="fulfilled"){
  official=results[0].value.rows;partialOfficial=results[0].value.partial;
 }else{officialError=true;console.warn("Official DBV match source unavailable",results[0].reason)}
 if(results[1].status==="fulfilled"){
  external=results[1].value.rows;progress=results[1].value.progress;
  partialExternal=results[1].value.partial;
 }else{externalError=true;console.warn("Sourced Badhub match history unavailable",results[1].reason)}
 if(results[2].status==="fulfilled")birthYear=results[2].value;
 else console.warn("Player birth year unavailable for age class breakdown",results[2].reason);
 status="loaded";lastLoadedAt=Date.now();render();
}
function ageProof(m){
 const a=m.ageContext;
 if(!a||a.category==="unclassified")return '<span class="match-age-proof muted-age">AK nicht zuordenbar</span>';
 return '<span class="match-age-proof">'+esc(a.event)+
  (a.category==="higher"?" · höhere AK (eigene "+esc(a.own)+")":" · eigene AK")+'</span>';
}
function externalProof(m){
 const u=sourceUrl(m.source_url);
 const when=m.match_date
  ?m.category==="tournament"?"Turnierbeginn "+dateLabel(m.match_date):dateLabel(m.match_date)
  :"Jahr "+esc(m.match_year);
 const opp=(m.opponent_names||[]).join(" / ");
 const partner=(m.partner_names||[]).join(" / ");
 return '<article class="match-proof"><div class="match-proof-head"><span class="'+
  (m.won?"match-win":"match-loss")+'">'+(m.won?"Sieg":"Niederlage")+
  '</span><time>'+esc(when)+'</time><span>'+esc(m.discipline)+'</span>'+ageProof(m)+'</div>'+
  '<strong>'+esc(m.competition||"Öffentlich belegtes Turnier")+'</strong>'+
  '<p>Gegen '+esc(opp)+(partner?' · mit '+esc(partner):'')+
  ' · Sätze aus Spielersicht '+esc(ownScore(m))+'</p>'+
  (u?'<a href="'+esc(u)+'" rel="noopener noreferrer" target="_blank">Badhub-Quellbeleg ↗</a>':'')+
  '</article>';
}
function officialProof(m){
 const url=sourceUrl(m.source_url);
 return '<article class="match-proof"><div class="match-proof-head"><span class="'+
 (m.won?"match-win":"match-loss")+'">'+(m.won?"Sieg":"Niederlage")+
 '</span><time>'+esc(dateLabel(m.match_date))+'</time><span>'+esc(m.discipline)+'</span>'+ageProof(m)+'</div>'+
 '<strong>'+esc(m.tournament_name||"Turnier nicht benannt")+'</strong>'+
 '<p>Gegen '+esc(m.opponent_names)+(m.game_score?' · Sätze '+esc(m.game_score):'')+'</p>'+
 (url?'<a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">Originalbeleg ↗</a>':'')+
 '</article>';
}
function render(){
 const values=$("match-stats-values"),note=$("match-stats-note"),details=$("match-stats-details"),
  list=$("match-stats-list"),counter=$("match-stats-detail-count"),year=$("match-stats-year"),
  source=$("match-stats-source"),sourceDetails=$("match-stats-provenance-copy"),
  retry=$("match-stats-retry"),ageSummary=$("match-stats-age-summary");
 if(!values||!note||!details||!list||!year||!source||!sourceDetails||!retry||!ageSummary)return;
 ageSummary.hidden=true;
 // The public original is an optional cross-check, never evidence of a match.
 const lookup=$("match-stats-source-link");
 if(lookup){
  const validId=/^\d{2}-\d{6}$/.test(selected);
  lookup.hidden=!validId;
  if(validId)lookup.href="https://badhub.de/spieler/"+selected+"?saison=all&src=gesamt";
  else lookup.removeAttribute("href");
 }
 retry.hidden=true;
 if(status==="loading"||status==="idle"){
  source.textContent="Belegte Spiele";
  values.innerHTML='<p class="match-stats-empty">Einzelspiele werden geladen …</p>';
  note.textContent="Belegte Ergebnisse werden geprüft.";
  sourceDetails.textContent="Es werden ausschließlich einzelne Matches mit belastbaren Quellenbelegen berücksichtigt.";
  details.hidden=true;return;
 }
 if(status==="missing-id"){
  source.textContent="DBV-Spieler-ID benötigt";
  values.innerHTML='<p class="match-stats-empty">Für Matchzahlen wird eine DBV-Spieler-ID benötigt.</p>';
  note.textContent="Bitte unter Spieler eine DBV-ID ergänzen.";
  sourceDetails.textContent="Nur mit einer eindeutigen Spieler-ID können fremde Matches sicher zugeordnet werden.";
  details.hidden=true;return;
 }
 const officialCount=computeMatchStats(official);
 // Never add official and third-party matches: same match may be in both sources.
 const sourced=officialCount.total===0&&external.length>0;
 const rows=sourced?external:official;
 const years=sourced?sourceMatchYears(rows):availableYears(rows);
 year.innerHTML='<option value="all">Gesamt</option>'+years.map(v=>
  '<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");
 if(!years.includes(selectedYear))selectedYear="all";
 year.value=selectedYear;
 const stats=sourced?
  computeExternalStats(rows,{year:selectedYear,discipline:selectedDiscipline}):
  computeMatchStats(rows,{year:selectedYear,discipline:selectedDiscipline});
 const context=ageContextBreakdown(stats,birthYear,{official:!sourced,filter:selectedAgeClass});
 const byAge=context.buckets;
 if(stats.total){
  ageSummary.hidden=false;
  ageSummary.textContent="Niederlagen nach gespielter AK · eigene: "+
   byAge.own.losses+" · höhere: "+byAge.higher.losses+
   " · nicht zuordenbar: "+byAge.unclassified.losses+
   (birthYear===null?" · Spielerjahrgang nicht hinterlegt.":"");
 }
 const missing=context.total===0;
 const availability=matchAvailability({officialFailed:officialError,externalFailed:externalError});
 retry.hidden=!availability.retry;
 source.textContent=!sourced&&!official.length&&availability.retry
  ?"Datenabgleich unvollständig":sourced?"Badhub · Einzelbelege":"Offizielle Matches";
 values.innerHTML=[
  ["Gesamtspiele",missing?"–":context.total,"matches"],
  ["Siege",missing?"–":context.wins,"wins"],
  ["Niederlagen",missing?"–":context.losses,"losses"],
  ["Siegquote",missing?"–":context.rate+" %","rate"]
 ].map(([name,value,key])=>'<div class="match-stat '+key+'"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong></div>').join("");
 if(sourced){
  note.textContent=context.total
   ? "Belegte Spiele aus Badhub · derzeit verfügbarer Teilbestand."
   : availability.retry?availability.emptyNote:"Für diese Auswahl liegen noch keine belegten Spiele vor.";
  sourceDetails.textContent="Die Werte stammen aus einzelnen Badhub-Matchkarten, nicht aus einer vollständigen offiziellen DBV-Karriere. "+
   importCompleteness(progress,external.length)+
   (partialExternal?" Diese Liste ist derzeit unvollständig.":"")+
   (stats.excluded?" "+stats.excluded+" zusätzliche unklare Einträge wurden ausgeschlossen.":"")+
   (availability.detail?" "+availability.detail:"")+
   " Ergebnisse aus verschiedenen Quellen werden nicht addiert.";
 }else if(official.length){
  const last=official.map(x=>x.last_synced_at).filter(Boolean).sort().at(-1);
  const published=last?" · letzte offizielle Übernahme "+dateLabel(last.slice(0,10)):"";
  note.textContent=missing
   ?availability.retry?availability.emptyNote:"Für diese Auswahl liegen keine einzeln geprüften Spiele vor."
   :"Einzeln geprüfte DBV-Spiele · Quelle: offizielle Matchbelege.";
  sourceDetails.textContent="Gezählt werden nur abgeschlossene, eindeutig belegte Begegnungen."+
    (stats.excluded?" "+stats.excluded+" unklare oder offene Begegnungen ausgeschlossen.":"")+
    (partialOfficial?" Der Datenbestand ist aktuell unvollständig.":"")+
    published+(availability.detail?" "+availability.detail:"")+
    " Externe Badhub-Spiele werden nicht zu diesen Werten addiert.";
 }else{
  note.textContent=availability.emptyNote;
  sourceDetails.textContent=(availability.detail?availability.detail+" ":"")+
   "Ranglistenpunkte und Platzierungen zählen nicht als einzelne Spiele. Falls Quellen nachgetragen werden, erscheinen geprüfte Ergebnisse hier automatisch.";
 }
 if(stats.total)sourceDetails.textContent+=" Die Einordnung als höhere AK bezieht sich auf das Turnierfeld und belegt nicht das Alter einzelner Gegner.";
 details.hidden=missing;
 counter.textContent="("+context.total+")";
 list.innerHTML=context.details.slice(0,150).map(sourced?externalProof:officialProof).join("");
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("match-stats"))return;
 $("match-stats-discipline").addEventListener("change",e=>{selectedDiscipline=e.target.value;render()});
 $("match-stats-year").addEventListener("change",e=>{selectedYear=e.target.value;render()});
 $("match-stats-age").addEventListener("change",e=>{selectedAgeClass=e.target.value;render()});
 $("match-stats-retry")?.addEventListener("click",()=>fetchProfile(selected,true));
 window.addEventListener("badminton:network-restored",()=>{
  if(location.hash==="#start"&&selected&&status==="loaded"&&(officialError||externalError))
   fetchProfile(selected,true);
 });
 window.addEventListener("badminton:profile-change",e=>{fetchProfile(String(e.detail?.playerId||""))});
 // When returning to a long-open Home view, refresh read-only public snapshots.
 // No periodic polling, importer write, third-party request or new background work.
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&location.hash==="#start"&&selected&&
   status==="loaded"&&Date.now()-lastLoadedAt>=5*60000)fetchProfile(selected,true);
 });
 window.addEventListener("badminton:external-matches-updated",e=>{
  if(String(e.detail?.playerId||"")===selected)fetchProfile(selected,true);
 });
 window.addEventListener("hashchange",()=>{
  if(location.hash==="#start"&&selected&&status==="loaded")fetchProfile(selected,true);
 });
 fetchProfile(window.badmintonActivePlayerId||"");
});
