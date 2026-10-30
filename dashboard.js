import {summarizeTrophies} from "./scripts/trophy-stats.mjs";
import {resultEvidenceHash} from "./scripts/result-evidence-nav.mjs";
import {trophySnapshot,requestPrivateTrophies} from "./scripts/private-trophy-source.mjs";
import {upcomingTournaments} from "./scripts/upcoming-tournaments.mjs";
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
"use strict";
// Official ranking totals are read only for accepted app members. Public ranking.json is intentionally empty.
const rankNames={HE:"Einzel",DE:"Einzel",HD:"Doppel",DD:"Doppel",HM:"Mixed",DM:"Mixed"};
let ranking=null,rankStatus="idle",selection="",profiles=[],bookmarks=[],viewMode="own";
const rankingCache=new Map();
let rankingRequest=0;
const $=id=>document.getElementById(id);
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=x=>typeof x==="number"&&Number.isFinite(x)?new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(x):"–";
const date=x=>x&&/^\d{4}-\d\d-\d\d$/.test(x)?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(x+"T12:00:00Z")):"";
function relevantResults(){
 // Only exact DBV identity from an independently authorized private response.
 const snap=trophySnapshot(selection);
 return snap.state==="ready"?snap.results.filter(x=>x.playerId===selection):[];
}
function displayMovement(change,previous){
 if(previous==null)return '<span class="movement movement-unknown"><span aria-hidden="true">–</span> Kein Vorwochenwert</span>';
 if(change>0)return '<span class="movement movement-up" aria-label="'+change+' Plätze verbessert"><span aria-hidden="true">↑</span> '+change+' Plätze</span>';
 if(change<0)return '<span class="movement movement-down" aria-label="'+Math.abs(change)+' Plätze gefallen"><span aria-hidden="true">↓</span> '+Math.abs(change)+' Plätze</span>';
 return '<span class="movement movement-same"><span aria-hidden="true">→</span> Unverändert</span>';
}
function ageLabel(y){
 const age=ranking?.current?.year&&y?ranking.current.year-y:undefined;
 return age==null?"Jahrgang "+y:age<=10?"U11":age<=12?"U13":age<=14?"U15":age<=16?"U17":age<=18?"U19":"U"+String(age+1);
}
function shortMovement(change,previous,label){
 if(previous==null || change==null)return '<span class="movement movement-unknown" aria-label="Kein Vorwochenvergleich">–</span>';
 if(change>0)return '<span class="movement movement-up" aria-label="'+change+' '+label+' verbessert">↑'+num(change)+'</span>';
 if(change<0)return '<span class="movement movement-down" aria-label="'+Math.abs(change)+' '+label+' gefallen">↓'+num(Math.abs(change))+'</span>';
 return '<span class="movement movement-same" aria-label="Unverändert zum letzten Wochenstand">→</span>';
}
function renderFiveScores(entry){
 // Only explicitly verified individual DBV tournament valuations can be shown.
 // The published Excel feed contains aggregate total and tournament count, not these items.
 const raw=Array.isArray(entry.topFive)?entry.topFive:[];
 const valid=raw.length>0&&raw.length<=5&&raw.every(x=>x&&typeof x.name==="string"&&x.name.trim()
   &&Number.isFinite(x.points)&&x.points>=0&&typeof x.date==="string"
   &&/^\d{4}-\d\d-\d\d$/.test(x.date));
 const reconciled=valid&&Math.abs(raw.reduce((sum,x)=>sum+x.points,0)-entry.points)<0.011;
 const reference='https://dbv.turnier.de/ranking/ranking.aspx?rid=238';
 if(!reconciled){
  return '<section class="ranking-score-section ranking-score-unavailable" aria-label="Einzelwertungen ausstehend">'+
   '<div class="ranking-score-head"><h3>Die besten 5 Wertungen</h3><span>letzte 12 Monate</span></div>'+
   '<p class="ranking-score-note">Die Gesamtpunkte sind amtlich bestätigt. Die einzelnen Turnierwertungen stehen nicht im Excel-Export und wurden bisher nicht zuverlässig aus der DBV-Spielerrangliste übernommen. Es werden keine Punkte geschätzt.</p>'+
   '<a class="ranking-score-source-link" href="'+reference+'" target="_blank" rel="noopener noreferrer">Einzelwertungen bei DBV prüfen ↗</a></section>';
 }
 const rows=raw.map((result,i)=>{
  const href=/^https:\/\/(?:dbv\.turnier\.de|www\.turnier\.de|turnier\.de)\/tournament\/[a-f0-9-]+\/?$/i.test(result.url||"")?result.url:null;
  return '<div class="ranking-score-row'+(href?' card-open-surface':'')+'"><span class="ranking-score-position">'+(i+1)+'</span><span class="ranking-score-event"><strong>'+escape(result.name)+'</strong><small>'+escape(result.date)+'</small></span><strong class="ranking-score-value">'+num(result.points)+'</strong>'+(href?'<a class="ranking-score-link card-open-primary" href="'+escape(href)+'" target="_blank" rel="noopener noreferrer" aria-label="Turnier öffnen">↗</a>':'')+'</div>';
 }).join("");
 return '<section class="ranking-score-section" aria-label="Verifizierte Ranglistenwertungen">'+
  '<div class="ranking-score-head"><h3>Die besten '+raw.length+' Wertungen</h3><span>letzte 12 Monate</span></div>'+
  '<div class="ranking-score-list">'+rows+'</div>'+
  '<p class="ranking-score-note">Die belegten Einzelwertungen ergeben zusammen die offiziellen Gesamtpunkte.</p>'+
  '<a class="ranking-score-source-link" href="'+reference+'" target="_blank" rel="noopener noreferrer">DBV-Spielerrangliste öffnen ↗</a></section>';
}
function renderRankDetails(entry,discipline,cohort,url){
 const modal=$("ranking-dialog"),body=$("ranking-detail-content");
 if(!modal||!body)return;
 const move=shortMovement(entry.bwAgeClassChange,entry.previousBwAgeClassRank,"BW-Plätze");
 const nationalYouth=Number.isInteger(entry.nationalYouthOverallRank)?entry.nationalYouthOverallRank:null;
 const youthOverall=nationalYouth!=null&&entry.ageClassRank==null;
 const nationalTitle=youthOverall?"Jugend-Gesamtliste (DE)":"Deutschland";
 const nationalValue=entry.ageClassRank!=null?'#'+num(entry.ageClassRank):youthOverall?'#'+num(nationalYouth):'–';
 const lead=youthOverall
  ?"Belegte DBV-Jugend-Gesamtliste über mehrere Altersklassen. Ein DE-U17- oder BW-U17-Platz ist daraus nicht abgeleitet."
  :"Bestätigte Altersklassenplätze aus offiziellen DBV-Ranglistenwerten.";
 body.innerHTML='<h2>'+escape(discipline)+' · '+escape(cohort)+'</h2>'+
  '<p class="ranking-dialog-lead">'+lead+'</p>'+
  '<div class="ranking-dialog-stats"><div><span>Baden-Württemberg</span><strong>'+(entry.bwAgeClassRank!=null?'#'+num(entry.bwAgeClassRank):'–')+'</strong><small>'+(entry.bwAgeClassRank!=null?'Vorwoche '+(entry.previousBwAgeClassRank!=null?'#'+num(entry.previousBwAgeClassRank):'–')+' · '+move:'U17-Rang nicht verifiziert')+'</small></div>'+
  '<div><span>'+nationalTitle+'</span><strong>'+nationalValue+'</strong><small>'+(youthOverall?'Nicht U17-spezifisch':'Vorwoche '+(entry.previousAgeClassRank!=null?'#'+num(entry.previousAgeClassRank):'–'))+'</small></div></div>'+
  '<div class="ranking-score-total"><span>Gesamtpunkte</span><strong>'+num(entry.points)+'</strong><small>DBV · '+num(entry.tournaments)+' Turniere erfasst · beste 5 zählen</small></div>'+
  (entry.bwAgeClassSize!=null&&entry.ageClassSize!=null?
   '<p class="ranking-dialog-small">BW-Vergleichsgruppe: '+num(entry.bwAgeClassSize)+' · Deutschland: '+num(entry.ageClassSize)+'</p>':'')+
  renderFiveScores(entry)+
  '<a class="ranking-dialog-link" href="'+escape(url)+'" rel="noopener noreferrer" target="_blank">Offizielle Excel-Rangliste ansehen ↗</a>';
 modal.showModal();
}
function renderRank(){
 const root=$("dashboard-rankings"),source=$("dashboard-rank-source"),label=$("dashboard-week");
 if(!root||!source||!label)return;
 const current=ranking?.current,prior=ranking?.previous;
 const working=ranking?.status==="available"&&current?.week&&current?.year;
 const published=Boolean(current?.week&&current?.year&&(working||rankStatus==="not_listed"));
 const today=new Date();
 const isoDate=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
 isoDate.setUTCDate(isoDate.getUTCDate()+4-(isoDate.getUTCDay()||7));
 const isoYear=isoDate.getUTCFullYear();
 const yearStart=new Date(Date.UTC(isoYear,0,1));
 const isoWeek=Math.ceil((((isoDate-yearStart)/86400000)+1)/7);
 const archiveBehind=Boolean(working&&(current.year<isoYear||(current.year===isoYear&&current.week<isoWeek)));
 label.textContent=published?"KW "+current.week+" / "+current.year:"DBV-Rangliste";
 source.innerHTML=working?'<span>Bestätigte DBV-Ranglistenwerte</span>':
 rankStatus==="not_listed"?'<span>Im aktuellen DBV-Export nicht gelistet</span>':
 rankStatus==="loading"?'<span>Bestätigte DBV-Werte werden geladen …</span>':
 rankStatus==="protected"?'<span>Ranglistenwerte nach gültiger App-Einladung verfügbar</span>':
 rankStatus==="unavailable"?'<span>Ranglistenwerte momentan nicht abrufbar</span>':
 '<span>Für dieses Profil liegen noch keine bestätigten Ranglistenwerte vor</span>';
 if(archiveBehind)source.innerHTML+='<a class="ranking-stale-link" href="https://turniere.badminton.de/ranking" target="_blank" rel="noopener noreferrer">Aktuellere Webwerte möglich · DBV ansehen ↗</a>';
 const own=profiles.find(p=>p.id===selection&&/^\d{2}-\d{6}$/.test(p.id));
 // Followed profiles are viewed without becoming a device's own profiles.
 const chosen=own||(viewMode==="friend"&&/^\d{2}-\d{6}$/.test(selection)?{id:selection}:null);
 if(!chosen){
  root.innerHTML='<a class="dashboard-empty-tile" href="#einstellungen"><strong>Rangliste einrichten</strong><small>Für deine Altersklassenränge bitte die DBV-Spieler-ID in den Einstellungen hinterlegen.</small><span>Einrichten ↗</span></a>';
  return;
 }
 const player=ranking?.players?.[chosen.id],discs=player?.disciplines??{};
 const known=Object.values(discs)[0];
 const birth=known?.birthYear??chosen.birthYear;
 if(!known){
  const sourceLink='<a class="friend-ranking-official" rel="noopener noreferrer" target="_blank" href="https://turniere.badminton.de/ranking">DBV-Rangliste öffnen ↗</a>';
  const caption=rankStatus==="loading"?"Offizielle Werte werden geladen …":
   rankStatus==="protected"?"Bitte zuerst den App-Zugang mit einem Einladungslink freischalten.":
   rankStatus==="unavailable"?"Die bestätigten Ranglistenwerte können gerade nicht geladen werden.":
   rankStatus==="not_listed"?"Im vollständigen DBV-Ranglistenexport KW "+current.week+"/"+current.year+" ist dieses Profil nicht gelistet. Ältere Platzierungen gelten nicht als aktuelle Rangliste.":
   "Für dieses Profil ist noch kein offiziell belegter Ranglistenstand in der App vorhanden.";
  root.innerHTML='<div class="dashboard-empty-tile friend-ranking-empty"><strong>Rangliste</strong><small>'+escape(caption)+'</small>'+sourceLink+'</div>';
  return;
 }
 // Never render three giant empty cards for disciplines without a verified rank.
 const keys=["HE","HD","HM","DE","DD","DM"].filter(key=>discs[key]);
 root.innerHTML=keys.map(key=>{
  const e=discs[key],title=rankNames[key],cohort=birth?(e?.ageClass||ageLabel(birth))+" · Jg. "+birth:"Jahrgang offen";
  const bw=e?.bwAgeClassRank!=null?'#'+num(e.bwAgeClassRank):"–";
  const nationalYouth=Number.isInteger(e?.nationalYouthOverallRank)?e.nationalYouthOverallRank:null;
  const youthOverall=nationalYouth!=null&&e?.ageClassRank==null;
  const de=e?.ageClassRank!=null?'#'+num(e.ageClassRank):youthOverall?'#'+num(nationalYouth):"–";
  const deLabel=youthOverall?"DE Jugend gesamt":"DE";
  const movement=e?shortMovement(e.bwAgeClassChange,e.previousBwAgeClassRank,"BW-Plätze"):'<span class="movement movement-unknown">–</span>';
  return '<button class="ranking-tile ranking-compact" type="button" data-rank-discipline="'+escape(key)+'" '+(e?'':'disabled')+' aria-label="'+escape(title)+': BW '+bw+', '+deLabel+' '+de+'">'+
  '<span class="ranking-top"><span>'+escape(title)+'</span></span>'+
  '<span class="ranking-bw-title">BW · '+escape(e?.ageClass||"AK")+'</span>'+
  '<span class="ranking-bw-row"><strong>'+bw+'</strong>'+movement+'</span>'+
  '<span class="ranking-de-row"><span title="'+(youthOverall?'Bundesweite Jugendliste über alle Altersklassen':'Deutschland')+'">'+deLabel+'</span><strong>'+de+'</strong></span>'+
  '<span class="ranking-compact-points">'+(e&&Number.isFinite(e.points)?num(e.points)+' <small>Pts.</small>':'– <small>Pts.</small>')+'</span>'+
  '<span class="ranking-compact-footer">'+escape(cohort)+' <span aria-hidden="true">›</span></span></button>';
 }).join("");
 const sourceUrl=current?.url||"https://turniere.badminton.de/ranking/history";
 root.querySelectorAll("[data-rank-discipline]").forEach(button=>button.addEventListener("click",()=>{
  const key=button.dataset.rankDiscipline,e=discs[key];
  if(e)renderRankDetails(e,rankNames[key],(e.ageClass||ageLabel(e.birthYear))+" · Jg. "+e.birthYear,sourceUrl);
 }));
 source.innerHTML+='<a href="'+escape(sourceUrl)+'" rel="noopener noreferrer" target="_blank">DBV-Quelle ↗</a>';
}
function renderOtherKpis(){
 const root=$("dashboard-kpis"),next=$("dashboard-next");
 if(!root||!next)return;
 const results=relevantResults();
 const access=trophySnapshot(selection);
 const trophies=summarizeTrophies(results);
 const friendNoHistory=viewMode==="friend"&&results.length===0;
 const trophyUnknown=access.state!=="ready";
 const years=new Set(results.map(r=>r.date+"|"+r.event));
 const rankCounts=Object.entries(ranking?.players?.[selection]?.disciplines||{})
  .filter(([,entry])=>Number.isSafeInteger(entry?.tournaments)&&entry.tournaments>=0);
 // The official ranking counts rated tournaments by discipline, while the
 // trophy cabinet counts only individually sourced placements. Never add them.
 const countContext=rankCounts.length===1&&rankCounts[0][1].tournaments>years.size
  ?" DBV-Rangliste: "+num(rankCounts[0][1].tournaments)+
    " gewertete Turniere im "+(rankNames[rankCounts[0][0]]||rankCounts[0][0])+
    "; hiervon sind "+num(years.size)+" mit Einzelplatzierungen belegt."
  :"";
 const trophyNote=access.state==="ready"&&access.coverage==="device_snapshot"
  ?"Lokal übernommene, belegte Platzierungen (Stand "+new Date(access.fetchedAt).toLocaleDateString("de-DE")+"). Teilarchiv, keine automatische Aktualisierung."
  :access.state==="ready"
  ?(results.length===0
    ?"Keine belegten Top-4-Platzierungen in den bisher verfügbaren Quellen. Das Archiv ist nicht vollständig."
    :"Nur belegte Platzierungen aus den bisher erfassten Quellen. Die Historie ist nicht vollständig."+countContext)
  :access.state==="loading"?"Private Auszeichnungen werden geprüft. Noch keine Zahl verfügbar."
  :access.state==="protected"?"Trophäen sind geschützt. Ein Berechtigungslink oder eine unabhängig bestätigte Verwalterberechtigung ist erforderlich."
  :"Private Auszeichnungen sind momentan nicht abrufbar. Kein sportlicher Nullwert.";
 const medals=trophies.counts;
 const slots=[
  {place:1,label:"1. Platz",symbol:"🏆",style:"gold"},
  {place:2,label:"2. Platz",symbol:"🏆",style:"silver"},
  {place:3,label:"3. Platz",symbol:"🏆",style:"bronze"},
  {place:4,label:"4. Platz",symbol:"◉",style:"fourth"}
 ];
 const latest=trophyUnknown?[]:results.filter(r=>[1,2,3,4].includes(Number(r.place)))
  .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
  .slice(0,3);
 const total=slots.reduce((sum,slot)=>sum+(Number(medals[slot.place])||0),0);
 const status=trophyUnknown
  ?(access.state==="loading"?"Auszeichnungen werden geladen …":"Auszeichnungen derzeit nicht verfügbar.")
  :total===0
  ?"Im bisherigen Datenbestand sind noch keine Top-4-Platzierungen belegt."
  :num(total)+" belegte Auszeichnungen";
 root.innerHTML='<section class="home-trophy" aria-labelledby="home-trophy-heading">'+
  '<div class="home-trophy-heading"><h2 id="home-trophy-heading">Trophäenschrank</h2><a href="#historie">Alle anzeigen ↗</a></div>'+
  '<div class="home-trophy-grid" aria-label="Belegte Plätze 1 bis 4">'+slots.map(slot=>
   '<div class="home-trophy-slot '+slot.style+'"><span class="home-trophy-symbol" aria-hidden="true">'+slot.symbol+'</span>'+
   '<strong>'+(trophyUnknown?"–":num(medals[slot.place]))+'</strong><small>'+slot.label+'</small></div>'
  ).join("")+'</div>'+
  '<p class="home-trophy-status" role="status">'+escape(status)+'</p>'+
  (latest.length?'<div class="home-trophy-latest" aria-label="Jüngste belegte Platzierungen">'+
   latest.map(result=>'<a href="'+escape(resultEvidenceHash(result.id))+'" class="home-trophy-result">'+
    '<span class="home-trophy-medal">'+escape(result.place)+'.</span>'+
    '<span><strong>'+escape(result.event||"Turnier")+'</strong><small>'+escape(date(result.date))+
    (result.discipline?' · '+escape(result.discipline):'')+'</small></span><span aria-hidden="true">›</span></a>').join("")+
   '</div>':"")+
  '<details class="home-trophy-coverage"><summary>Datenstand</summary><p>'+escape(trophyNote)+'</p></details></section>';
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const today=parts.year+"-"+parts.month+"-"+parts.day;
 if(viewMode==="friend"){
  const p=profiles.slice().reverse().find(x=>x.id===selection);
  const official=p?.url&&/^https:\/\//.test(p.url)?p.url:null;
  next.innerHTML='<a class="kpi-wide" href="'+escape(official||"#einstellungen")+'"'+(official?' target="_blank" rel="noopener noreferrer"':"")+'><span><strong>Offizielles Spielerprofil</strong><small>'+(official?'Spielerdaten beim DBV ansehen':'Bitte in den Freundeseinstellungen einen offiziellen Profil-Link ergänzen')+'</small></span><span class="kpi-next-date">'+(official?'Profil ↗':'Einstellungen ↗')+'</span></a>';
  return;
 }
 const upcoming=upcomingTournaments(bookmarks,selection,today);
 const undated=bookmarks.some(t=>(t.playerId==="all"||t.playerId===selection)&&!t.startDate);
 const list=upcoming.length?upcoming.slice(0,3).map(t=>{
  const end=t.endDate&&t.endDate>=t.startDate?t.endDate:t.startDate;
  const active=t.startDate<=today&&end>=today;
  const range=t.endDate&&t.endDate!==t.startDate?date(t.startDate)+" – "+date(t.endDate):date(t.startDate);
  const owner=t.playerId==="all"?"Alle Spieler":(profiles.find(p=>p.id===t.playerId)?.name||"Mein Profil");
  const calendar=t.source==="spond"||t.source==="dbv-calendar"||t.source==="bwbv-framework"||!t.url;
  const label=t.source==="bwbv-framework"?"Rahmentermin · keine Anmeldung":t.source==="dbv-calendar"?"Vorgemerkt · keine Anmeldung":calendar?"Kalendertermin · keine Anmeldung":"Gespeicherter Turnierlink";
  const location=typeof t.place==="string"&&t.place.trim()?t.place.trim():typeof t.location==="string"&&t.location.trim()?t.location.trim():"";
  const title=location&&!String(t.name||"").toLocaleLowerCase("de").includes(location.toLocaleLowerCase("de"))?String(t.name||"")+" · "+location:t.name;
  const target="#turniere/"+encodeURIComponent(String(t.id))+"/"+encodeURIComponent(String(t.playerId));
  const month=new Intl.DateTimeFormat("de-DE",{month:"short",timeZone:"UTC"})
   .format(new Date(t.startDate+"T12:00:00Z")).replace(".","").toUpperCase();
  return '<a class="upcoming-tournament-row" href="'+escape(target)+'"'+
   ' aria-label="'+escape(title)+', '+escape(range)+', direkt zur gespeicherten Turnierkarte">'+
   '<span class="upcoming-tournament-date"><time datetime="'+escape(t.startDate)+'"><span class="upcoming-tournament-month">'+escape(month)+'</span><strong class="upcoming-tournament-day">'+escape(t.startDate.slice(8,10))+'</strong></time>'+(active?'<small>Termin heute</small>':'')+'</span>'+
   '<span class="upcoming-tournament-info"><strong>'+escape(title)+'</strong><small>'+
   escape([range,owner].filter(Boolean).join(" · "))+'</small>'+
   (location?"":'<small class="upcoming-tournament-venue">Austragungsort nicht erfasst</small>')+
   '<span class="upcoming-tournament-label">'+escape(label)+'</span></span>'+
   '<span class="upcoming-tournament-arrow" aria-hidden="true">›</span></a>';
 }).join(""):'<div class="upcoming-tournaments-empty">'+(undated?'Keine bevorstehenden Turniere mit Datum. Bitte bei den gespeicherten Turnieren den Termin ergänzen.':'Für diesen Spieler sind noch keine zukünftigen Turniere mit Datum gespeichert. Du kannst Turniere mit + direkt aus dem DBV-Kalender vormerken. Eine Vormerkung bestätigt keine Anmeldung.')+' <a href="#turniere">Turnier anlegen / bearbeiten ↗</a></div>';
 next.innerHTML='<section class="upcoming-tournaments-section" aria-labelledby="upcoming-tournaments-heading">'+
  '<div class="upcoming-tournaments-header"><h2 id="upcoming-tournaments-heading">Nächste Turniere</h2><a href="#turniere">Alle ansehen ↗</a></div>'+
  '<div class="upcoming-tournaments-list">'+list+'</div></section>';

}
function renderDashboard(){
 renderRank();renderOtherKpis();
}
// No profile or ranking is persisted. Switching profiles cannot display stale values.
async function requestPrivateRankings(){
 const id=selection,ticket=++rankingRequest;
 ranking=null;
 if(!/^\d{2}-\d{6}$/.test(id)){
  rankStatus="idle";renderDashboard();return;
 }
 const cached=rankingCache.get(id);
 if(cached&&Date.now()-cached.checkedAt<120000){
  ranking=cached.ranking;rankStatus=cached.status;renderDashboard();return;
 }
 rankStatus="loading";renderDashboard();
 try{
  const token=await window.badmintonAppAccess?.getAccessToken?.();
  if(ticket!==rankingRequest||selection!==id)return;
  if(!token){rankStatus="protected";renderDashboard();return;}
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
  let response;
  try{
   response=await fetch(SUPABASE_ROOT+"rpc/app_access_rankings_read",{
    method:"POST",cache:"no-store",signal:abort.signal,
    headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({p_player_dbv_id:id})
   });
  }finally{clearTimeout(timeout)}
  if(!response.ok)throw Error("ranking unavailable");
  const data=await response.json();
  if(ticket!==rankingRequest||selection!==id)return;
  if(!data||data.player_dbv_id!==id||!["available","no_verified_ranking"].includes(data.status))
   throw Error("invalid ranking payload");
  if(data.status==="available"&&data.current&&data.disciplines&&
    Number.isInteger(data.current.year)&&Number.isInteger(data.current.week)){
   ranking={status:"available",current:data.current,players:{[id]:{disciplines:data.disciplines}}};
   rankStatus="ready";
  }else if(data.reason==="not_listed_in_latest_official_export"&&
   Number.isInteger(data.current?.year)&&Number.isInteger(data.current?.week)){
   ranking={status:"no_ranking",current:data.current,players:{}};rankStatus="not_listed";
  }else{ranking=null;rankStatus="no_data";}
  rankingCache.set(id,{ranking,status:rankStatus,checkedAt:Date.now()});
 }catch{
  if(ticket!==rankingRequest||selection!==id)return;
  ranking=null;rankStatus="unavailable";
 }
 if(ticket===rankingRequest&&selection===id)renderDashboard();
}
window.renderDashboard=(selected,ps,links,options={})=>{
 const next=selected||"",changed=next!==selection;
 selection=next;profiles=Array.isArray(ps)?ps:[];bookmarks=Array.isArray(links)?links:[];viewMode=options.mode==="friend"?"friend":"own";
 requestPrivateTrophies(selection);
 renderDashboard();
 if(changed||rankStatus==="idle"||rankStatus==="protected")void requestPrivateRankings();
};
document.addEventListener("DOMContentLoaded",()=>{if(selection)void requestPrivateRankings()});
window.addEventListener("badminton:app-access-granted",()=>{if(selection)void requestPrivateRankings()});
window.addEventListener("badminton:private-player-revoked",()=>{
 rankingCache.clear();ranking=null;rankStatus="protected";++rankingRequest;renderDashboard();
});

window.addEventListener("badminton:private-trophies-updated",event=>{
 if(event.detail?.playerId===selection)renderDashboard();
});
