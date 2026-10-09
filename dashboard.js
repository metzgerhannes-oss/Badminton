import {summarizeTrophies} from "./scripts/trophy-stats.mjs";
"use strict";
const rankUrl="./data/ranking.json";
const historyUrl="./data/history.json";
const rankNames={HE:"Einzel",DE:"Einzel",HD:"Doppel",DD:"Doppel",HM:"Mixed",DM:"Mixed"};
let ranking=null,history=null,rankError=false,historyError=false,selection="all",profiles=[],bookmarks=[];
const $=id=>document.getElementById(id);
const escape=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=x=>typeof x==="number"&&Number.isFinite(x)?new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(x):"–";
const date=x=>x&&/^\d{4}-\d\d-\d\d$/.test(x)?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(x+"T12:00:00Z")):"";
function relevantResults(){
 const rows=history?.results??[];
 if(selection==="all")return rows;
 const p=profiles.find(x=>x.id===selection);
 return rows.filter(x=>x.playerId===selection||(p&&x.playerName===p.name));
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
function renderRank(){
 const root=$("dashboard-rankings"),source=$("dashboard-rank-source"),label=$("dashboard-week");
 if(!root||!source||!label)return;
 const current=ranking?.current;
 const prior=ranking?.previous;
 const working=ranking?.status==="available"&&current?.week&&current?.year;
 label.textContent=working?"DBV KW "+current.week+" / "+current.year:"DBV-Rangliste";
 source.innerHTML=working?'<span>Jahrgangsplatz · Deutschland</span><span>'+escape("KW "+current.week+(prior?" vs. KW "+prior.week:" · Vergleich folgt"))+'</span>':
 '<span>Ranglistenwerte noch nicht importiert</span>';
 const chosen=profiles.filter(p=>(selection==="all"||p.id===selection)&&/^\d{2}-\d{6}$/.test(p.id));
 if(!chosen.length){
  root.innerHTML='<a class="dashboard-empty-tile" href="#profil"><strong>Rangliste einrichten</strong><small>Bitte die DBV-Spieler-ID im Profil hinterlegen. Nur so kann die Rangliste passend zum Geburtsjahr geladen werden.</small><span>Zu den Profilen ↗</span></a>';
  return;
 }
 const out=[];
 for(const p of chosen){
  const player=ranking?.players?.[p.id];
  const discs=player?.disciplines??{};
  const known=Object.values(discs)[0];
  const birth=known?.birthYear??p.birthYear;
  const cohort=birth?"Jg. "+birth+" · "+ageLabel(birth):"Jahrgang noch offen";
  const keys=Object.keys(discs).some(k=>["HE","HD","HM"].includes(k))?["HE","HD","HM"]:Object.keys(discs).some(k=>["DE","DD","DM"].includes(k))?["DE","DD","DM"]:p.id==="05-070879"?["HE","HD","HM"]:["DE","DD","DM"];
  if(selection==="all"&&chosen.length>1)out.push('<div class="dashboard-group-name">'+escape(p.name)+' · '+escape(cohort)+'</div>');
  for(const key of keys){
   const entry=discs[key];
   const title=rankNames[key];
   const sub=entry?'Jahrgang '+entry.birthYear+' · '+escape(entry.ageClass||ageLabel(entry.birthYear)):(birth?cohort:"Jahrgang aus DBV noch nicht geladen");
   out.push('<article class="ranking-tile"><div class="ranking-top"><span>'+escape(title)+'</span><span class="ranking-disc">'+escape(key)+'</span></div><div class="ranking-place">'+(entry?'#'+num(entry.yearRank):'–')+'</div><div class="ranking-desc">'+sub+'</div><div class="ranking-bottom">'+(entry?displayMovement(entry.change,entry.previousYearRank):'<span class="movement movement-unknown">Noch keine Daten</span>')+'</div>'+(entry?'<div class="ranking-points">'+num(entry.points)+' Punkte · '+num(entry.cohortSize)+' im Jahrgang</div>':'')+'</article>');
  }
 }
 root.innerHTML=out.join("");
 if(!working)source.innerHTML+='<a href="https://turniere.badminton.de/ranking/history" rel="noopener noreferrer" target="_blank">DBV-Quelle ↗</a>';
 else source.innerHTML+='<a href="'+escape(current.url||"https://turniere.badminton.de/ranking/history")+'" rel="noopener noreferrer" target="_blank">Originaldaten ↗</a>';
}
function renderOtherKpis(){
 const root=$("dashboard-kpis"),next=$("dashboard-next");
 if(!root||!next)return;
 const results=relevantResults();
 const trophies=summarizeTrophies(results);
 const years=new Set(results.map(r=>r.date+"|"+r.event));
 const medals=trophies.counts;
 root.innerHTML='<a class="kpi-tile" href="#historie"><span class="kpi-label">Trophäenschrank</span><span class="kpi-value">'+num(trophies.total)+'</span><span class="kpi-sub">1. Platz '+medals[1]+' · 2. Platz '+medals[2]+' · 3. Platz '+medals[3]+' · 4. Platz '+medals[4]+'</span><span class="kpi-link">Auszeichnungen ansehen ↗</span></a>'+
 '<a class="kpi-tile" href="#historie"><span class="kpi-label">Erfasste Turniere</span><span class="kpi-value">'+num(years.size)+'</span><span class="kpi-sub">'+results.length+' belegte Platzierungen · historische Auswahl</span><span class="kpi-link">Zur Historie ↗</span></a>';
 const now=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const entries=bookmarks.filter(t=>selection==="all"||t.playerId===selection||t.playerId==="all");
 const upcoming=entries.filter(t=>t.startDate&&(!t.endDate||t.endDate>=now)&&t.startDate>=now||t.startDate&&t.endDate>=now)
 .sort((a,b)=>a.startDate.localeCompare(b.startDate));
 const t=upcoming[0];
 const href=t?escape(t.url):"#turniere";
 next.innerHTML='<a class="kpi-wide" href="'+href+'"'+(t?' target="_blank" rel="noopener noreferrer"':'')+'><span><strong>Nächstes Turnier</strong><small>'+(t?escape(t.name):"Noch kein bevorstehendes Turnier mit Datum gespeichert")+'</small></span><span class="kpi-next-date">'+(t?escape(date(t.startDate)):"Turnier anlegen ↗")+'</span></a>';
}
function renderDashboard(){
 renderRank();renderOtherKpis();
}
window.renderDashboard=(selected,ps,links)=>{
 selection=selected||"all";profiles=Array.isArray(ps)?ps:[];bookmarks=Array.isArray(links)?links:[];
 renderDashboard();
};
async function load(){
 await Promise.all([
  fetch(rankUrl+"?v=1",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("ranking unavailable"))).then(d=>{if(d?.schemaVersion===1)ranking=d;else rankError=true}).catch(()=>{rankError=true}),
  fetch(historyUrl+"?v=2",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject(Error("history unavailable"))).then(d=>{if(d?.schemaVersion===1)history=d;else historyError=true}).catch(()=>{historyError=true})
 ]);
 renderDashboard();
}
document.addEventListener("DOMContentLoaded",load);
