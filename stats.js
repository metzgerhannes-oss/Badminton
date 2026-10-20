import {computeMatchStats,availableYears} from "./scripts/match-stats.mjs";
import {computeExternalStats,sourceMatchYears,importCompleteness} from "./scripts/external-match-stats.mjs";
import {getBadhubMatchReference} from "./scripts/dbv-match-reference.mjs";
import {matchAvailability} from "./scripts/match-availability.mjs";
import {ageContextBreakdown} from "./scripts/match-age-context.mjs";
import {readPublicRows,readMatchImportProgress} from "./scripts/supabase-read.mjs";
import {matchArchiveSnapshot,requestPrivateMatches} from "./scripts/private-match-source.mjs";
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
// Progressive details: never confuse a render limit with the number of matches.
const DETAIL_PAGE=50;
let detailLimit=DETAIL_PAGE;
let resultOutcome="all",proofActivated=false;
const PAGE_LIMIT=400,MAX_ROWS=10000;
let controller,privateMode=false;
async function getPage(path,signal){
 const {rows}=await readPublicRows(path,{signal,count:false});
 return rows;
}
// Official match observations are not readable by invited app members and
// have no usable rows. Do not query their restricted endpoint on Home.
// Display only member-authorized, individually sourced match facts.
async function queryExternal(id,signal){
 const status=await readMatchImportProgress(id,{signal}).catch(()=>null);
 const rows=[];
 for(let offset=0;offset<MAX_ROWS;offset+=PAGE_LIMIT){
  const qs=new URLSearchParams({
   select:"source_key,category,competition,discipline,event,round_label,match_date,match_year,player_side,winning_side,opponent_names,partner_names,games,outcome_evidence,source_name,source_kind,source_url",
   dbv_id:"eq."+id,order:"match_year.desc,match_date.desc.nullslast,source_key.asc",
   limit:String(PAGE_LIMIT),offset:String(offset)
  });
  const data=await getPage("player_external_match_facts?"+qs,signal);
  rows.push(...data);
  if(data.length<PAGE_LIMIT)return {rows,progress:status||null,partial:false};
 }
 return {rows,progress:status||null,partial:true};
}
// The private, existing player-coverage RPC already provides this value.
// Direct /players reads are blocked by RLS; that made all games "unclassified".
function queryBirthYear(coverage,id){
 const valid=value=>Number.isInteger(value)&&value>=1900&&value<=2100?value:null;
 const fromServer=valid(coverage?.birth_year);
 if(fromServer!==null)return fromServer;
 // The selected profile may already carry its verified birth year locally.
 // This avoids an empty "eigene AK" filter when the coverage RPC times out.
 try{
  const local=JSON.parse(localStorage.getItem("shuttleboard-v1")||"null");
  const profile=local?.players?.find(p=>p?.id===id||p?.dbv_id===id);
  return valid(profile?.birthYear??profile?.birth_year);
 }catch{return null}
}
async function fetchProfile(id,force=false){
 if(privateMode&&id===selected&&!force)return;
 if(id!==selected)privateMode=false;
 if(/^\d{2}-\d{6}$/.test(id||"")&&!window.badmintonAppAccess?.allowed)requestPrivateMatches(id,{force});
 if(!/^\d{2}-\d{6}$/.test(id||"")){
  controller?.abort();++seq;selected=id||"";official=[];external=[];
  resultOutcome="all";proofActivated=false;
  progress=null;birthYear=null;status="missing-id";render();return;
 }
 if(id===selected&&!force&&status==="loaded")return;
 if(id!==selected){
  selectedYear="all";selectedDiscipline="all";selectedAgeClass="all";
  detailLimit=DETAIL_PAGE;resultOutcome="all";proofActivated=false;
  if($("match-stats-discipline"))$("match-stats-discipline").value="all";
   if($("match-stats-age"))$("match-stats-age").value="all";
 }
 selected=id;status="loading";official=[];external=[];progress=null;birthYear=null;
 officialError=false;externalError=false;partialOfficial=false;partialExternal=false;
 controller?.abort();controller=new AbortController();
 const ticket=++seq,signal=controller.signal;
 render();
 // One authorized source, one coherent result; an empty unused official table
 // must never hide the 1,974 imported Badhub cards or trigger a false outage.
 try{
  const data=await queryExternal(id,signal);
  if(ticket!==seq||signal.aborted)return;
  external=data.rows;progress=data.progress;partialExternal=data.partial;
  birthYear=queryBirthYear(progress,id);
 }catch(error){
  if(ticket!==seq||signal.aborted)return;
  externalError=true;
  birthYear=queryBirthYear(null,id);
  console.warn("Sourced match history temporarily unavailable",error);
 }
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
  ' · '+esc(m.scoring?.ruleSource==="badhub-bold-no-scores"
   ?"Ergebnis laut Badhub-Hervorhebung, ohne Satzstände"
   :"Sätze aus Spielersicht "+ownScore(m))+'</p>'+
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
  retry=$("match-stats-retry"),
  referenceSection=$("match-stats-reference");
 if(!values||!note||!details||!list||!year||!source||!sourceDetails||!retry)return;
 const provenance=$("match-stats-provenance");
 values.hidden=false;
 note.hidden=false;
 if(provenance)provenance.hidden=false;
 if(referenceSection){referenceSection.hidden=true;referenceSection.innerHTML="";}
 // The public original is an optional cross-check, never evidence of a match.
 const lookup=$("match-stats-source-link");
 if(lookup){
  const validId=/^\d{2}-\d{6}$/.test(selected);
  const awaitingMatchSource=progress?.status==="awaiting_source"&&!external.length&&!official.length;
  lookup.hidden=!validId;
  if(validId){
   // Do not send families to a known-unavailable Badhub profile.
   // The DBV ranking is a reference, not evidence for individual matches.
   lookup.href=awaitingMatchSource?"https://turniere.badminton.de/ranking":
    "https://badhub.de/spieler/"+selected+"?saison=all&src=gesamt";
   lookup.textContent=awaitingMatchSource?"DBV-Rangliste öffnen ↗":"Badhub-Spielerprofil öffnen ↗";
  }else lookup.removeAttribute("href");
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
 const sourced=privateMode||(officialCount.total===0&&external.length>0);
 const rows=sourced?external:official;
 const years=sourced?sourceMatchYears(rows):availableYears(rows);
 year.innerHTML='<option value="all">Gesamt</option>'+years.map(v=>
  '<option value="'+esc(v)+'">'+esc(v)+'</option>').join("");
 if(!years.includes(selectedYear))selectedYear="all";
 year.value=selectedYear;
 const stats=sourced?
  computeExternalStats(rows,{year:selectedYear,discipline:selectedDiscipline}):
  computeMatchStats(rows,{year:selectedYear,discipline:selectedDiscipline});
 // In an offline/older session the server birth year can be unavailable.
 // Preserve the match totals and show all instead of an unexplained blank panel.
 if(birthYear===null&&selectedAgeClass!=="all"){
  selectedAgeClass="all";
  if($("match-stats-age"))$("match-stats-age").value="all";
 }
 const context=ageContextBreakdown(stats,birthYear,{official:!sourced,filter:selectedAgeClass});
 const missing=context.total===0;
 const availability=matchAvailability({officialFailed:officialError,externalFailed:externalError});
 // Member views show only one set of match counters. Keep the dated public
 // Badhub snapshot solely as fallback when no app membership is available.
 const badhub=getBadhubMatchReference(selected,{
  year:selectedYear,discipline:selectedDiscipline,ageClass:selectedAgeClass
 });
 // A dated Badhub total is a public fallback, not a second member KPI panel.
 // Authorized members already see their documented games in the primary totals.
 if(referenceSection&&badhub&&!privateMode&&!window.badmintonAppAccess?.allowed){
  referenceSection.hidden=false;
  referenceSection.innerHTML=
   '<div class="dbv-reference-heading"><strong>Badhub · veröffentlichte Karrierebilanz</strong>'+
   '<time datetime="'+esc(badhub.capturedOn)+'">Stand '+esc(dateLabel(badhub.capturedOn))+'</time></div>'+
   '<div class="dbv-reference-totals"><span class="matches"><strong>'+esc(badhub.total)+
   '</strong> Spiele</span><span class="wins"><strong>'+esc(badhub.wins)+
   '</strong> Siege</span><span class="losses"><strong>'+esc(badhub.losses)+
   '</strong> Niederlagen</span><span class="rate"><strong>'+esc(new Intl.NumberFormat("de-DE",{
    style:"percent",minimumFractionDigits:1,maximumFractionDigits:1
   }).format(badhub.total?badhub.wins/badhub.total:0))+
   '</strong> Siegquote</span></div>'+
   '<a href="'+esc(badhub.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Aktuellen Badhub-Stand öffnen ↗</a>';
 }
 retry.hidden=!availability.retry;
 source.textContent=privateMode?"Bisher belegte Spiele":!sourced&&!official.length&&availability.retry
  ?"Datenabgleich unvollständig":sourced?"Bisher belegte Spiele":"Offizielle Einzelmatches";
 values.innerHTML=[
  ["Spiele",missing?"–":context.total,"matches"],
  ["Siege",missing?"–":context.wins,"wins"],
  ["Niederlagen",missing?"–":context.losses,"losses"],
  ["Siegquote",missing?"–":context.rate+" %","rate"]
 ].map(([name,value,key])=>{
  const outcome=key==="wins"?"wins":key==="losses"?"losses":"all";
  const active=!missing&&(outcome==="wins"?context.wins>0:outcome==="losses"?context.losses>0:true);
  const tag=active?"button":"div";
  return '<'+tag+' class="match-stat '+key+(active?' match-stat-action':'')+'"'+
   (active?' type="button" data-result-outcome="'+outcome+'" aria-pressed="'+
    (proofActivated&&resultOutcome===outcome)+'" aria-label="'+esc(name)+': '+esc(value)+
    '. Passende Einzelnachweise anzeigen"':'')+'>'+
   '<span>'+esc(name)+'</span><strong>'+esc(value)+'</strong></'+tag+'>';
 }).join("");
 if(sourced){
  note.textContent=context.total
   ? "Bisher belegte Spiele. Weitere Ergebnisse können fehlen."
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
  const awaitingMatchSource=progress?.status==="awaiting_source"&&!officialError&&!externalError;
  note.textContent=awaitingMatchSource
   ?"Spieler erkannt, aber noch keine auswertbaren Einzelmatches importiert. Belegte Turnierergebnisse stehen unter Historie."
   :availability.emptyNote;
  sourceDetails.textContent=(awaitingMatchSource
   ?"Für diese DBV-ID liefert die externe Quelle derzeit keine auswertbaren Matchkarten. Der Import wartet auf eine belastbare Quelle. "
   :"")+(availability.detail?availability.detail+" ":"")+
   "Ranglistenpunkte und Platzierungen zählen nicht als einzelne Spiele. Falls Quellen nachgetragen werden, erscheinen geprüfte Ergebnisse hier automatisch.";
 }
 if(stats.total)sourceDetails.textContent+=" Die Einordnung als höhere AK bezieht sich auf das Turnierfeld und belegt nicht das Alter einzelner Gegner.";
 // Do not display a second, partial set of career counters under Badhub's
 // published total. Filtering switches back to individually evidenced figures.
 if(badhub&&referenceSection&&!privateMode&&!window.badmintonAppAccess?.allowed){
  values.hidden=true;
  note.hidden=true;
  if(provenance)provenance.hidden=true;
  if(lookup)lookup.hidden=true;
  retry.hidden=true;
  source.textContent="Badhub · Karrierebilanz";
 }
 details.hidden=missing;
 const proofRows=context.details.filter(row=>resultOutcome==="all"||
  (resultOutcome==="wins"?row.won:!row.won));
 const available=proofRows.length;
 const visible=Math.min(detailLimit,available);
 counter.textContent=available?"("+visible+" von "+available+" Belegen)":"(0)";
 const selectionNote=$("match-stats-selection-note");
 if(selectionNote){
  selectionNote.hidden=!proofActivated||missing;
  selectionNote.textContent=resultOutcome==="wins"?"Einzelnachweise: Siege ("+available+")":
   resultOutcome==="losses"?"Einzelnachweise: Niederlagen ("+available+")":
   "Einzelnachweise: Alle Spiele ("+available+")";
 }
 list.innerHTML=proofRows.slice(0,visible).map(sourced?externalProof:officialProof).join("");
 const more=$("match-stats-more");
 if(more){
  more.hidden=missing||visible>=available;
  more.textContent="Weitere Matchkarten anzeigen ("+(available-visible)+" übrig)";
 }
}
window.addEventListener("badminton:private-matches-updated",e=>{
 const id=String(e.detail?.playerId||"");
 if(id!==selected||window.badmintonAppAccess?.allowed)return;
 const snap=matchArchiveSnapshot(id);
 if(snap.state==="ready"){
  controller?.abort();++seq;privateMode=true;
  official=[];external=snap.rows;progress={status:"partial",verified_count:external.length};
  officialError=false;externalError=false;partialOfficial=false;partialExternal=false;
  status="loaded";lastLoadedAt=Date.now();render();
 }else if(privateMode){
  controller?.abort();++seq;privateMode=false;official=[];external=[];
  officialError=true;externalError=true;progress=null;status="loaded";render();
 }
});
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("match-stats"))return;
 $("match-stats-values").addEventListener("click",event=>{
  const button=event.target.closest?.("button[data-result-outcome]");
  if(!button||!$("match-stats-values").contains(button))return;
  resultOutcome=button.dataset.resultOutcome;proofActivated=true;detailLimit=DETAIL_PAGE;
  render();
  const details=$("match-stats-details"),list=$("match-stats-list");
  if(details.hidden)return;
  details.open=true;
  requestAnimationFrame(()=>{
   const target=$("match-stats-selection-note")||list;
   target.setAttribute("tabindex","-1");
   target.scrollIntoView({block:"center",behavior:"auto"});
   target.focus({preventScroll:true});
  });
 });
 $("match-stats-discipline").addEventListener("change",e=>{selectedDiscipline=e.target.value;resultOutcome="all";proofActivated=false;detailLimit=DETAIL_PAGE;render()});
 $("match-stats-year").addEventListener("change",e=>{selectedYear=e.target.value;resultOutcome="all";proofActivated=false;detailLimit=DETAIL_PAGE;render()});
 $("match-stats-age").addEventListener("change",e=>{selectedAgeClass=e.target.value;resultOutcome="all";proofActivated=false;detailLimit=DETAIL_PAGE;render()});
 $("match-stats-more")?.addEventListener("click",()=>{detailLimit+=DETAIL_PAGE;render()});
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

// A newly accepted app invitation unlocks server-authorized match reads.
window.addEventListener("badminton:app-access-granted",()=>{privateMode=false;if(selected)fetchProfile(selected,true)});
