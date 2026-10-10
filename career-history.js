/** Source-marked career snapshots; never merge aggregate wins into official DBV match rows. */
import {validateExternalCareer,seasonYears,chooseHistory,lifetimeRate,externalProfileLink} from "./scripts/external-history.mjs";
import {PUBLIC_KEY,overviewUrl} from "./scripts/history-demand.mjs";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>Number(x).toLocaleString("de-DE");
const safeLink=x=>{try{const url=new URL(x);return url.protocol==="https:"&&url.hostname==="badhub.de"?url.href:""}catch{return ""}};
let indexPromise,selected="",data=null,token=0,year="all",discipline="all";
const cache=new Map();
async function readJson(path){
 const r=await fetch(path,{cache:"no-store"});
 if(!r.ok)throw Error("HTTP "+r.status);
 return r.json();
}
async function registry(){
 if(!indexPromise)indexPromise=readJson("./data/player-history/index.json").catch(err=>{indexPromise=null;throw err});
 const info=await indexPromise;
 if(info.schemaVersion!==1||!Array.isArray(info.profiles))throw Error("Invalid career index");
 return info;
}
async function snapshot(id){
 if(cache.has(id))return cache.get(id);
 // Central on-demand Supabase import is the primary verified store.
 // The existing curated GitHub feed remains the free offline fallback.
 try{
  const response=await fetch(overviewUrl(id),{cache:"no-store",headers:{apikey:PUBLIC_KEY,Accept:"application/json"}});
  if(response.ok){
   const rows=await response.json();
   if(Array.isArray(rows)&&rows.length===1&&validateExternalCareer(rows[0]?.summary,id)){
    cache.set(id,rows[0].summary);
    return rows[0].summary;
   }
  }
 }catch(error){console.warn("Central career overview unavailable; using curated fallback",error?.message)}
 const index=await registry();
 const entry=index.profiles.find(p=>p.dbvId===id);
 if(!entry||entry.path!==id+".json")return null;
 const obj=await readJson("./data/player-history/"+entry.path);
 if(!validateExternalCareer(obj,id))throw Error("Invalid historical career source");
 cache.set(id,obj);
 return obj;
}
function sourceLink(url,label){
 const href=safeLink(url);
 return href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>':"";
}
function renderHome(){
 const panel=$("external-match-summary");if(!panel)return;
 if(!data){panel.hidden=true;panel.innerHTML="";return}
 const t=data.totals;
 panel.hidden=false;
 panel.innerHTML='<div class="career-home-heading"><strong>Historisch erfasste Spiele · '+esc(data.source.name)+'</strong><span>externe Zusammenfassung</span></div>'+
  '<div class="career-home-grid">'+[
   ["Erfasste Spiele",fmt(t.matches)],
   ["Siege",fmt(t.wins)],
   ["Niederlagen",fmt(t.losses)],
   ["Siegquote",lifetimeRate(data)+" %"]
  ].map(([label,value])=>'<div><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join("")+'</div>'+
  '<div class="career-home-breakdown">Turnier: '+fmt(t.tournament.wins)+' von '+fmt(t.tournament.matches)+' gewonnen · Liga: '+
   fmt(t.league.wins)+' von '+fmt(t.league.matches)+' gewonnen</div>'+
  '<p>Quelle: '+esc(data.source.name)+' · Stand '+esc(data.retrievedOn)+'. Extern aggregierte Ergebnisse; noch nicht als einzelne DBV-Matches in unserer Datenbank nachgeprüft. <strong>Nicht mit den offiziellen Match-KPIs addieren.</strong></p>'+
  '<div class="career-home-links">'+sourceLink(data.source.url,"Ergebnisse bei Badhub prüfen")+
   '<a href="#historie">Historische Jahresübersicht ansehen ↗</a></div>';
}
function renderHistory(){
 const root=$("career-history"),summary=$("career-summary"),years=$("career-years"),
  highlight=$("career-highlights"),note=$("career-citation"),yearField=$("career-year"),disField=$("career-discipline");
 if(!root)return;
 const profileLink=externalProfileLink(selected);
 if(!profileLink){root.hidden=true;return}
 root.hidden=false;
 if(!data){
  root.classList.add("career-empty");
  summary.innerHTML='<p>Für diesen Spieler liegt derzeit noch keine extern übernommene Jahresübersicht vor. In einer öffentlichen Ergebnisquelle kannst du ältere Turniere recherchieren.</p>'+
   sourceLink(profileLink,"Bei Badhub nach dieser DBV-ID suchen");
  yearField.closest(".career-history-filters").hidden=true;
  years.innerHTML="";highlight.innerHTML="";
  note.textContent="Der Link ist eine Suchmöglichkeit, kein Nachweis für eine vorhandene oder vollständige Historie.";
  return;
 }
 root.classList.remove("career-empty");
 yearField.closest(".career-history-filters").hidden=false;
 const options=seasonYears(data),known=new Set(options.map(String));
 if(year!=="all"&&!known.has(year))year="all";
 yearField.innerHTML='<option value="all">Alle Jahre</option>'+options.map(y=>'<option value="'+y+'">'+y+'</option>').join("");
 yearField.value=year;disField.value=discipline;
 const t=data.totals;
 summary.innerHTML='<div class="career-summary-head"><strong>'+esc(data.name)+' · erfasste Karriere</strong><span>'+esc(data.source.name)+' · Stand '+esc(data.retrievedOn)+'</span></div>'+
  '<div class="career-summary-metrics">'+[
   ["Spiele",fmt(t.matches)],["Siege",fmt(t.wins)],["Niederlagen",fmt(t.losses)],["Siegquote",lifetimeRate(data)+" %"]
  ].map(([label,value])=>'<div><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join("")+'</div>'+
  '<p>Turniere: '+fmt(t.tournament.matches)+' Spiele / '+fmt(t.tournament.wins)+' Siege · Liga: '+
   fmt(t.league.matches)+' Spiele / '+fmt(t.league.wins)+' Siege.</p>';
 const selectedYears=chooseHistory(data,{year,discipline});
 years.innerHTML='<h4>Jahresübersicht · Turnierplatzierungen</h4><div class="career-years-grid">'+
  selectedYears.years.map(y=>'<article class="career-year-card"><strong>'+y.year+'</strong>'+
    '<span>'+fmt(y.tournaments)+' Turniere · '+fmt(y.placements)+' Platzierungen</span>'+
    '<div><span>🥇 '+fmt(y.gold)+'</span><span>🥈 '+fmt(y.silver)+'</span><span>🥉 '+fmt(y.bronze)+'</span></div></article>'
  ).join("")+'</div>';
 highlight.innerHTML='<h4>Ausgewählte historische Ergebnisse</h4>'+
  (selectedYears.highlights.length?selectedYears.highlights.map(h=>
    '<article class="career-highlight"><div><strong>'+esc(h.place)+'. Platz</strong>'+
      '<span>'+esc(h.startDate.slice(0,4))+' · '+esc(h.discipline)+' · '+esc(h.ageGroup)+'</span></div>'+
    '<p>'+esc(h.event)+(h.partner?' · mit '+esc(h.partner):'')+'</p>'+
    '<small>Turnierbeginn '+esc(h.startDate)+' · '+esc(data.source.name)+'</small></article>'
   ).join(""):'<p class="career-no-highlight">Für die gewählte Auswahl sind keine einzelnen Beispielergebnisse übertragen. Die Jahresgesamtzahlen gelten unabhängig vom Disziplinfilter.</p>');
 note.innerHTML='Erfasst sind öffentliche Jahresaggregate 2019–2026; die Quellseite führt auch 2018 auf. Die Jahre bilden nicht zwingend sämtliche Karriereergebnisse ab. '+
  'Die Zahlen sind <strong>externe Badhub-Auswertungen</strong>, keine einzeln validierten DBV-Matchimporte. '+
  'Die Auszeichnungen im separaten Trophäenschrank bleiben auf unsere eigenen belegten Einträge beschränkt. '+
  sourceLink(data.source.url,"Originalübersicht öffnen");
}
async function chooseProfile(id){
 if(!/^\d{2}-\d{6}$/.test(id||"")){++token;selected=id||"";data=null;renderHome();renderHistory();return}
 const ticket=++token;
 selected=id;data=null;year="all";discipline="all";
 renderHome();renderHistory();
 try{
  const found=await snapshot(id);
  if(ticket!==token)return;
  data=found;
 }catch(err){
  if(ticket!==token)return;
  console.warn("Historische Quelle vorübergehend nicht verfügbar:",err?.message);
 }
 if(ticket===token){renderHome();renderHistory();}
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("career-history"))return;
 $("career-year").addEventListener("change",e=>{year=e.target.value;renderHistory()});
 $("career-discipline").addEventListener("change",e=>{discipline=e.target.value;renderHistory()});
 window.addEventListener("badminton:profile-change",e=>chooseProfile(String(e.detail?.playerId||"")));
 chooseProfile(String(window.badmintonActivePlayerId||""));
});
