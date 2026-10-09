import {summarizeTrophies} from "./scripts/trophy-stats.mjs";
import {upcomingTournaments} from "./scripts/upcoming-tournaments.mjs";
"use strict";
const rankUrl="./data/ranking.json";
const historyUrl="./data/history.json";
const rankNames={HE:"Einzel",DE:"Einzel",HD:"Doppel",DD:"Doppel",HM:"Mixed",DM:"Mixed"};
let ranking=null,history=null,rankError=false,historyError=false,selection="",profiles=[],bookmarks=[],viewMode="own";
const $=id=>document.getElementById(id);
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=x=>typeof x==="number"&&Number.isFinite(x)?new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(x):"–";
const date=x=>x&&/^\d{4}-\d\d-\d\d$/.test(x)?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(x+"T12:00:00Z")):"";
function relevantResults(){
 const rows=history?.results??[];
 if(!selection)return [];
 const p=profiles.find(x=>x.id===selection);
 return rows.filter(x=>x.playerId===selection||(p&&selection.startsWith("local-")&&x.playerId===p.name&&x.playerName===p.name));
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
function renderRankDetails(entry,discipline,cohort,url){
 const modal=$("ranking-dialog"),body=$("ranking-detail-content");
 if(!modal||!body)return;
 const move=shortMovement(entry.bwAgeClassChange,entry.previousBwAgeClassRank,"BW-Plätze");
 body.innerHTML='<h2>'+escape(discipline)+' · '+escape(cohort)+'</h2>'+
  '<p class="ranking-dialog-lead">Altersklassenplätze (z. B. U11 mit mehreren Geburtsjahrgängen), aus den offiziellen DBV-Punkten errechnet.</p>'+
  '<div class="ranking-dialog-stats"><div><span>Baden-Württemberg</span><strong>'+(entry.bwAgeClassRank!=null?'#'+num(entry.bwAgeClassRank):'–')+'</strong><small>Vorwoche '+(entry.previousBwAgeClassRank!=null?'#'+num(entry.previousBwAgeClassRank):'–')+' · '+move+'</small></div>'+
  '<div><span>Deutschland</span><strong>'+(entry.ageClassRank!=null?'#'+num(entry.ageClassRank):'–')+'</strong><small>Vorwoche '+(entry.previousAgeClassRank!=null?'#'+num(entry.previousAgeClassRank):'–')+'</small></div></div>'+
  '<p class="ranking-dialog-small">'+num(entry.points)+' Punkte · BW-Vergleichsgruppe: '+num(entry.bwAgeClassSize)+' · Deutschland: '+num(entry.ageClassSize)+'</p>'+
  '<a class="ranking-dialog-link" href="'+escape(url)+'" rel="noopener noreferrer" target="_blank">Offizielle Excel-Rangliste ansehen ↗</a>';
 modal.showModal();
}
function renderRank(){
 const root=$("dashboard-rankings"),source=$("dashboard-rank-source"),label=$("dashboard-week");
 if(!root||!source||!label)return;
 const current=ranking?.current,prior=ranking?.previous;
 const working=ranking?.status==="available"&&current?.week&&current?.year;
 const today=new Date();
 const isoDate=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
 isoDate.setUTCDate(isoDate.getUTCDate()+4-(isoDate.getUTCDay()||7));
 const isoYear=isoDate.getUTCFullYear();
 const yearStart=new Date(Date.UTC(isoYear,0,1));
 const isoWeek=Math.ceil((((isoDate-yearStart)/86400000)+1)/7);
 const archiveBehind=Boolean(working&&(current.year<isoYear||(current.year===isoYear&&current.week<isoWeek)));
 label.textContent=working?"KW "+current.week+" / "+current.year:"DBV-Rangliste";
 source.innerHTML=working?'<span>Altersklasse · BW & Deutschland</span><span>'+escape(prior?"Vergleich KW "+prior.week:"Vergleich folgt")+'</span>':
 '<span>Ranglistenwerte noch nicht importiert</span>';
 if(archiveBehind)source.innerHTML+='<a class="ranking-stale-link" href="https://turniere.badminton.de/ranking" target="_blank" rel="noopener noreferrer">Aktuellere Webwerte möglich · DBV ansehen ↗</a>';
 const chosen=profiles.find(p=>p.id===selection&&/^\d{2}-\d{6}$/.test(p.id));
 if(!chosen){
  root.innerHTML='<a class="dashboard-empty-tile" href="#einstellungen"><strong>Rangliste einrichten</strong><small>Für deine Altersklassenränge bitte die DBV-Spieler-ID in den Einstellungen hinterlegen.</small><span>Einrichten ↗</span></a>';
  return;
 }
 const player=ranking?.players?.[chosen.id],discs=player?.disciplines??{};
 const known=Object.values(discs)[0];
 const birth=known?.birthYear??chosen.birthYear;
 if(!known&&viewMode==="friend"){
  const profileLink=chosen.url&&/^https:\/\//.test(chosen.url)?'<a class="friend-ranking-official" rel="noopener noreferrer" target="_blank" href="'+escape(chosen.url)+'">Offizielles Spielerprofil ↗</a>':"";
  root.innerHTML='<div class="dashboard-empty-tile friend-ranking-empty"><strong>Ranglisten-KPIs noch nicht verfügbar</strong><small>Für '+escape(chosen.name)+' wurde bisher kein offizieller Wochenstand in unsere Familien-Datenbasis übernommen.</small>'+profileLink+'</div>';
  return;
 }
 const keys=Object.keys(discs).some(k=>["HE","HD","HM"].includes(k))?["HE","HD","HM"]:Object.keys(discs).some(k=>["DE","DD","DM"].includes(k))?["DE","DD","DM"]:chosen.id==="05-070879"?["HE","HD","HM"]:["DE","DD","DM"];
 root.innerHTML=keys.map(key=>{
  const e=discs[key],title=rankNames[key],cohort=birth?(e?.ageClass||ageLabel(birth))+" · Jg. "+birth:"Jahrgang offen";
  const bw=e?.bwAgeClassRank!=null?'#'+num(e.bwAgeClassRank):"–",de=e?.ageClassRank!=null?'#'+num(e.ageClassRank):"–";
  const movement=e?shortMovement(e.bwAgeClassChange,e.previousBwAgeClassRank,"BW-Plätze"):'<span class="movement movement-unknown">–</span>';
  return '<button class="ranking-tile ranking-compact" type="button" data-rank-discipline="'+escape(key)+'" '+(e?'':'disabled')+' aria-label="'+escape(title)+': BW '+bw+', Deutschland '+de+'">'+
  '<span class="ranking-top"><span>'+escape(title)+'</span></span>'+
  '<span class="ranking-bw-title">BW · '+escape(e?.ageClass||"AK")+'</span>'+
  '<span class="ranking-bw-row"><strong>'+bw+'</strong>'+movement+'</span>'+
  '<span class="ranking-de-row"><span title="Deutschland">DE</span><strong>'+de+'</strong></span>'+
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
 const trophies=summarizeTrophies(results);
 const friendNoHistory=viewMode==="friend"&&results.length===0;
 const years=new Set(results.map(r=>r.date+"|"+r.event));
 const medals=trophies.counts;
 root.innerHTML='<a class="kpi-tile" href="#historie"><span class="kpi-label">Trophäenschrank</span><span class="kpi-value">'+(friendNoHistory?'–':num(trophies.total))+'</span><span class="kpi-sub">'+(friendNoHistory?'Für diesen Freund noch keine historischen Daten erfasst':'1. Platz '+medals[1]+' · 2. Platz '+medals[2]+' · 3. Platz '+medals[3]+' · 4. Platz '+medals[4])+'</span><span class="kpi-link">Zur Historie ↗</span></a>'+
 '<a class="kpi-tile" href="#historie"><span class="kpi-label">Erfasste Turniere</span><span class="kpi-value">'+(friendNoHistory?'–':num(years.size))+'</span><span class="kpi-sub">'+(friendNoHistory?'Keine öffentlichen Turnierdaten für diesen Freund in unserer Sammlung':'Auswahl: '+results.length+' belegte Platzierungen')+'</span><span class="kpi-link">Zur Historie ↗</span></a>';
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(p=>[p.type,p.value]));
 const today=parts.year+"-"+parts.month+"-"+parts.day;
 if(viewMode==="friend"){
  const p=profiles.find(x=>x.id===selection);
  const official=p?.url&&/^https:\/\//.test(p.url)?p.url:null;
  next.innerHTML='<a class="kpi-wide" href="'+escape(official||"#einstellungen")+'"'+(official?' target="_blank" rel="noopener noreferrer"':"")+'><span><strong>Offizielles Spielerprofil</strong><small>'+(official?'Spielerdaten beim DBV ansehen':'Bitte in den Freundeseinstellungen einen offiziellen Profil-Link ergänzen')+'</small></span><span class="kpi-next-date">'+(official?'Profil ↗':'Einstellungen ↗')+'</span></a>';
  return;
 }
 const upcoming=upcomingTournaments(bookmarks,selection,today);
 const undated=bookmarks.some(t=>(t.playerId==="all"||t.playerId===selection)&&!t.startDate);
 const list=upcoming.length?upcoming.map(t=>{
  const end=t.endDate&&t.endDate>=t.startDate?t.endDate:t.startDate;
  const active=t.startDate<=today&&end>=today;
  const range=t.endDate&&t.endDate!==t.startDate?date(t.startDate)+" – "+date(t.endDate):date(t.startDate);
  const owner=t.playerId==="all"?"Alle Spieler":(profiles.find(p=>p.id===t.playerId)?.name||"Mein Profil");
  return '<a class="upcoming-tournament-row" href="'+escape(t.url)+'" rel="noopener noreferrer" target="_blank" aria-label="'+escape(t.name)+', '+escape(range)+', offizielle DBV-Turnierseite öffnen">'+
   '<span class="upcoming-tournament-date"><time datetime="'+escape(t.startDate)+'">'+escape(date(t.startDate))+'</time>'+(active?'<small>Im Zeitraum</small>':'')+'</span>'+
   '<span class="upcoming-tournament-info"><strong>'+escape(t.name)+'</strong><small>'+escape(range)+' · '+escape(owner)+'</small></span>'+
   '<span class="upcoming-tournament-arrow" aria-hidden="true">↗</span></a>';
 }).join(""):'<div class="upcoming-tournaments-empty">'+(undated?'Keine bevorstehenden Turniere mit Datum. Bitte bei den gespeicherten Turnieren den Termin ergänzen.':'Noch keine bevorstehenden Turniere gespeichert.')+' <a href="#turniere">Turnier anlegen / bearbeiten ↗</a></div>';
 next.innerHTML='<section class="upcoming-tournaments-section" aria-labelledby="upcoming-tournaments-heading">'+
  '<div class="upcoming-tournaments-header"><h2 id="upcoming-tournaments-heading">Die nächsten Turniere</h2><a href="#turniere">Alle Turniere ↗</a></div>'+
  '<div class="upcoming-tournaments-list">'+list+'</div></section>';

}
function renderDashboard(){
 renderRank();renderOtherKpis();
}
window.renderDashboard=(selected,ps,links,options={})=>{
 selection=selected||"";profiles=Array.isArray(ps)?ps:[];bookmarks=Array.isArray(links)?links:[];viewMode=options.mode==="friend"?"friend":"own";
 renderDashboard();
};
async function load(){
 await Promise.all([
  fetch(rankUrl+"?v=2",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("ranking unavailable"))).then(d=>{if(d?.schemaVersion===2&&d?.type==="dbv-published-excel-derived-ageclass-rank")ranking=d;else rankError=true}).catch(()=>{rankError=true}),
  fetch(historyUrl+"?v=2",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("history unavailable"))).then(d=>{if(d?.schemaVersion===1)history=d;else historyError=true}).catch(()=>{historyError=true})
 ]);
 renderDashboard();
}
document.addEventListener("DOMContentLoaded",load);
