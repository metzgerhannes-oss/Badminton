/** Public DBV calendar from Badminton Supabase, with static source fallback. */
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {AGE_OPTIONS,LEVEL_OPTIONS,calendarEntry,regionLabel,filterCalendar,alternativeCalendarLevels} from "./scripts/dbv-calendar-utils.mjs";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate=s=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));
const localToday=()=>{
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const x=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return x.year+"-"+x.month+"-"+x.day;
};
// Separate official schedule announcements from event-ID backed DBV records.
// These are source-backed planning/award dates, NOT confirmed sign-up events.
const BWBV_C_FRAMEWORK_2027=[
 {start:"2027-01-16",end:"2027-01-17",level:"C",title:"1. BWBV/C-RLT Jugend · Einzel/Doppel",ageCertain:false},
 {start:"2027-02-27",end:"2027-02-28",level:"C",title:"2. BWBV/C-RLT Jugend · Einzel/Mixed",ageCertain:false},
 {start:"2027-05-08",end:"2027-05-09",level:"C",title:"3. BWBV/C-RLT Jugend · Einzel/Doppel",ageCertain:false},
 {start:"2027-06-26",end:"2027-06-27",level:"C",title:"4. BWBV/C-RLT Jugend · Hexen-Cup, Einzel/Doppel/Mixed",ageCertain:false}
];
const BWBV_FRAMEWORK_SOURCE="https://bwbv.de/wp-content/uploads/2025/11/BWBV-U19-Turnierkalender_2027.pdf";
const BWBV_B_FRAMEWORK_2027=[
 {start:"2027-01-30",end:"2027-01-31",level:"B",title:"Gruppe SüdOst · B-RLT U13–U19",ageCertain:true,
  source:"https://bwbv.de/wp-content/uploads/2025/11/bj-2025-11-web.pdf"}
];
const DBV_A_VERGABE_2027=[
 {start:"2027-04-24",end:"2027-04-25",level:"A",title:"4. DBV-A-RLT U11/U13 · BSV Eggenstein",ageCertain:true,
  source:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"}
];
const BW_U13_FRAMEWORK_2027=[
 ...BWBV_C_FRAMEWORK_2027.map(t=>({...t,source:BWBV_FRAMEWORK_SOURCE})),
 ...BWBV_B_FRAMEWORK_2027,...DBV_A_VERGABE_2027
].sort((a,b)=>a.start.localeCompare(b.start));
function bwFrameworkDates(filters,today){
 if(filters.region!=="Baden-Württemberg"||filters.age!=="U13"||
  !["all","2027"].includes(filters.year))return [];
 const search=String(filters.q||"").normalize("NFKC").toLocaleLowerCase("de").trim();
 return BW_U13_FRAMEWORK_2027.filter(t=>
  (filters.level==="all"||filters.level===t.level)&&
  (filters.period!=="upcoming"||t.end>=today)&&
  (!search||(t.title+" "+t.level+" 2027 BWBV DBV Eggenstein").normalize("NFKC").toLocaleLowerCase("de").includes(search)));
}
function bwFrameworkHTML(filters,today){
 const planned=bwFrameworkDates(filters,today);
 if(!planned.length)return "";
 return '<section class="dbv-calendar-cluster dbv-calendar-sourced-plan" aria-label="Offizielle Termine 2027">'+
  '<h4>Turniere 2027 <small>'+planned.length+'</small></h4>'+
  planned.map(t=>'<article class="dbv-calendar-entry dbv-calendar-external-plan">'+
    '<div class="dbv-calendar-date"><strong>'+esc(formatDate(t.start))+'</strong><small>bis '+esc(formatDate(t.end))+'</small></div>'+
    '<div class="dbv-calendar-detail"><h5>'+esc(t.title)+'</h5>'+
    '<p>Level '+esc(t.level)+' · '+esc(t.level==="A"?"Ausrichter vergeben":t.ageCertain?"U13 vorgesehen":"U13 noch offen")+'</p>'+
    '<a href="'+esc(t.source)+'" target="_blank" rel="noopener noreferrer">Terminquelle ↗</a></div>'+
  '</article>').join("")+'</section>';
}
function bwNextYearHint(filters){
 if(filters.region!=="Baden-Württemberg"||filters.age!=="U13"||
  filters.year!=="2026"||!["all","A","B","C"].includes(filters.level))return "";
 const planned=bwFrameworkDates({...filters,year:"2027"},localToday());
 if(!planned.length)return "";
 return '<button type="button" class="subtle-button dbv-calendar-year-jump" data-calendar-show-2027>'+
   '2027: '+planned.length+' Termine ansehen ↗</button>';
}
// Verified completed 2026 tournaments are displayed as real result cards,
// never masquerading as imported DBV event IDs or registration opportunities.
const BW_U13_ARCHIVE_2026=[
 {level:"C",start:"2026-01-17",end:"2026-01-18",title:"1. C-RLT U11–U19",place:"Reutlingen",detail:"Einzel/Doppel",
  source:"https://dbv.turnier.de/tournament/52b3b803-279b-48cf-8143-f5078f5236db",sourceKind:"results"},
 {level:"C",start:"2026-02-28",end:"2026-03-01",title:"2. C-RLT U11–U19",place:"Friedrichshafen",detail:"Einzel/Mixed",
  source:"https://bwbv.de/2026/03/22/erfolgreiches-c-ranglistenturnier-in-friedrichshafen/",sourceKind:"results"},
 {level:"C",start:"2026-04-25",end:"2026-04-26",title:"3. C-RLT U11–U19",place:"Mössingen",detail:"Einzel/Doppel",
  source:"https://dbv.turnier.de/tournament/DBB7AC20-FAD9-43A4-8842-6FA838623F35",sourceKind:"results"},
 {level:"A",start:"2026-05-02",end:"2026-05-03",title:"4. A-RLT U11/U13",place:"Eggenstein-Leopoldshafen",detail:"",
  source:"https://bwbv.de/2026/05/07/4-a-rlt-in-eggenstein-leopoldshafen-silber-fuer-den-bsv/",sourceKind:"results"},
 {level:"B",start:"2026-06-13",end:"2026-06-14",title:"3. B-RLT SüdOst U13–U19",place:"Waghäusel",detail:"",
  source:"https://badminton-rlp.de/aktuelles/33-globus-oliver-cup-jugend-badminton-in-waghaeusel",sourceKind:"report"},
 // 2026 Hexen-Cup has A-ranking for U13, and C-ranking ONLY for U15/17/19.
 {level:"A",start:"2026-06-27",end:"2026-06-28",title:"6. A-RLT U11/U13 · Hexen-Cup",place:"Konstanz",detail:"Einzel/Doppel/Mixed",
  source:"https://dbv.turnier.de/tournament/35299a0c-11f6-4ffd-85c2-3aca6dd1c0aa",sourceKind:"results"}
];
function bwArchiveDates(filters){
 if(filters.region!=="Baden-Württemberg"||filters.age!=="U13"||
  filters.year!=="2026"||filters.period!=="all")return [];
 const search=String(filters.q||"").normalize("NFKC").toLocaleLowerCase("de").trim();
 return BW_U13_ARCHIVE_2026.filter(t=>
  (filters.level==="all"||filters.level===t.level)&&
  (!search||(t.title+" "+t.place+" "+t.level+" "+t.detail).normalize("NFKC").toLocaleLowerCase("de").includes(search)));
}
function bwArchiveHTML(filters){
 const found=bwArchiveDates(filters);
 if(!found.length)return "";
 return '<section class="dbv-calendar-cluster dbv-calendar-sourced-results" aria-label="Verifizierte Turniere 2026">'+
  '<h4>Turniere 2026 <small>'+found.length+'</small></h4>'+
  found.map(t=>'<article class="dbv-calendar-entry dbv-calendar-external-result">'+
   '<div class="dbv-calendar-date"><strong>'+esc(formatDate(t.start))+'</strong>'+
     '<small>bis '+esc(formatDate(t.end))+'</small></div>'+
   '<div class="dbv-calendar-detail"><h5>'+esc(t.title)+'</h5>'+
   '<p>'+esc(t.place)+' · Level '+esc(t.level)+(t.detail?' · '+esc(t.detail):'')+'</p>'+
   '<a href="'+esc(t.source)+'" target="_blank" rel="noopener noreferrer">'+
      (t.sourceKind==="results"?"Ergebnisse ansehen ↗":"Turnierbericht ↗")+'</a></div>'+
   '</article>').join("")+'</section>';
}
const STORAGE="schmetterlinge.dbvCalendarFilters.v1";
const defaults={year:"all",region:"all",age:"all",level:"all",q:"",period:"upcoming",group:"region"};
function readPreference(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE)||"{}");return {...defaults,...Object.fromEntries(Object.entries(x).filter(([k,v])=>k in defaults&&typeof v==="string"))}}catch{return {...defaults}}
}
let settings=readPreference(),entries=[],source="supabase",loading=false,loaded=false,problem="",batchLimit=36;
function message(s){const n=$("dbv-calendar-status");if(n)n.textContent=s}
function selectOptions(node,values,placeholder){
 if(!node)return;
 node.innerHTML='<option value="all">'+esc(placeholder)+'</option>'+values.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
}
function updateControls(){
 const regions=[...new Set(entries.map(regionLabel))].sort((a,b)=>a.localeCompare(b,"de"));
 const years=[...new Set(entries.map(t=>t.start.slice(0,4)))].sort();
 selectOptions($("dbv-calendar-year"),years,"Alle Jahre");
 selectOptions($("dbv-calendar-region"),regions,"Alle Bundesländer / Verbände");
 selectOptions($("dbv-calendar-age"),AGE_OPTIONS,"Alle Altersklassen");
 selectOptions($("dbv-calendar-level"),LEVEL_OPTIONS,"Alle Level");
 for(const key of ["year","region","age","level","group","period","q"]){
  const node=$("dbv-calendar-"+key);
  if(!node)continue;
  if(key==="q"){node.value=settings.q;continue;}
  const choices=Array.from(node.options||[]);
  node.value=choices.some(option=>option.value===settings[key])?settings[key]:defaults[key];
 }
}
function render(){
 if(!loaded)return;
 const host=$("dbv-calendar-results");
 if(!host)return;
 const today=localToday();
 const selected=filterCalendar(entries,{...settings,today});
 const frameworkHTML=bwFrameworkHTML(settings,today);
 const nextYearHint=bwNextYearHint(settings);
 const archiveHTML=bwArchiveHTML(settings);
 const archiveCount=bwArchiveDates(settings).length;
 const plansCount=bwFrameworkDates(settings,today).length;
 const sourcedCount=archiveCount+plansCount;
 const fresh=entries.map(e=>Date.parse(e.checked)).filter(Number.isFinite);
 const newest=fresh.length?Math.max(...fresh):0;
 const warning=source==="supabase"&&newest&&Date.now()-newest>8*86400000?" · DBV-Abgleich älter als 8 Tage":"";
 const coverage=entries.length?formatDate(entries.reduce((earliest,t)=>t.start<earliest?t.start:earliest,entries[0].start))+
  "–"+formatDate(entries.reduce((latest,t)=>t.end>latest?t.end:latest,entries[0].end)):"";
 const hits=selected.total+sourcedCount;
 message(hits+" passende Turniere"+(plansCount?" / Termine":"")+
  (sourcedCount?" · "+sourcedCount+" zusätzlich aus offiziellen Quellen":"")+
  (selected.total?" · "+selected.total+" DBV":"")+warning);
 if(!selected.total){
  const more=$("dbv-calendar-more");if(more)more.hidden=true;
  if(sourcedCount){
   host.innerHTML=archiveHTML+frameworkHTML+nextYearHint;
   return;
  }
  const alternatives=alternativeCalendarLevels(entries,{...settings,today});
  const switchPeriod=settings.period==="upcoming"&&settings.year==="2026"&&
     settings.region==="Baden-Württemberg"&&settings.age==="U13"
    ?'<button type="button" class="subtle-button" data-calendar-show-history>Ergebnisse 2026 ansehen ↗</button>':"";
  host.innerHTML='<div class="dbv-calendar-no-results"><h4>Keine passenden Turniere</h4>'+
    '<p>In dieser Auswahl sind keine bestätigten Einträge verfügbar.</p>'+
    switchPeriod+
    (alternatives.length?'<div class="dbv-calendar-alternatives">'+
     alternatives.map(option=>'<button type="button" class="subtle-button" data-calendar-alternative-level="'+esc(option.level)+'">'+
      'Level '+esc(option.level)+' ('+option.count+')</button>').join("")+'</div>':"")+
    '</div>'+nextYearHint;
  return;
 }
 const bookmarkState=window.badmintonCalendarBookmarkState?.()||{playerId:"",playerName:"",savedKeys:[]};
 const savedKeys=new Set(bookmarkState.savedKeys||[]);
 let remaining=batchLimit;
 let html="";
 for(const cluster of selected.groups){
  if(remaining<=0)break;
  const visible=cluster.items.slice(0,remaining);
  remaining-=visible.length;
  if(!visible.length)continue;
  html+='<section class="dbv-calendar-cluster"><h4>'+esc(cluster.label)+' <small>'+cluster.items.length+'</small></h4>';
  html+=visible.map(t=>{
   const closed=t.deadline&&t.deadline<localToday();
   return '<article class="dbv-calendar-entry"><div class="dbv-calendar-date"><strong>'+esc(formatDate(t.start))+'</strong>'+(t.end!==t.start?'<small>bis '+esc(formatDate(t.end))+'</small>':"")+'</div>'+
    '<div class="dbv-calendar-detail"><div class="dbv-calendar-card-head"><h5>'+esc(t.title)+'</h5>'+
    '<button type="button" class="dbv-calendar-save'+(savedKeys.has(t.key)?' is-saved':'')+'" data-calendar-toggle="'+esc(t.key)+'"'+
    ' aria-pressed="'+(savedKeys.has(t.key)?'true':'false')+'"'+
    ' aria-label="'+esc(bookmarkState.playerId?(savedKeys.has(t.key)?'Vormerkung entfernen: ':'Für '+bookmarkState.playerName+' vormerken: ')+t.title:'Bitte zuerst ein eigenes Spielerprofil auswählen')+'"'+
    (bookmarkState.playerId?'':' disabled title="Eigenes Spielerprofil auswählen"')+'>'+
    (savedKeys.has(t.key)?'✓':'+')+'</button></div><p>'+esc(t.place)+(t.organizer?' · '+esc(t.organizer):"")+'</p>'+
    '<div class="dbv-calendar-badges"><span>'+esc(t.category)+'</span>'+t.ages.map(a=>'<span>'+esc(a)+'</span>').join("")+'</div>'+
    (t.deadline?'<p class="dbv-calendar-deadline">Meldeschluss: '+esc(formatDate(t.deadline))+(closed?' · abgelaufen':'')+'</p>':"")+
    '<a href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">'+(t.hasDirectLink?"Turnier beim Anbieter öffnen ↗":"DBV-Kalender öffnen ↗")+'</a></div></article>';
  }).join("");
  html+='</section>';
 }
 host.innerHTML=archiveHTML+frameworkHTML+html+nextYearHint;
 const more=$("dbv-calendar-more");
 if(more)more.hidden=selected.groups.reduce((n,g)=>n+g.items.length,0)<=batchLimit;
}
async function readSnapshot(){
 const res=await fetch("./data/dbv-calendar.json",{cache:"no-store"});
 if(!res.ok)throw Error("Kein DBV-Snapshot verfügbar");
 const data=await res.json();
 if(data.schemaVersion!==1||data.source!=="https://turniere.badminton.de/"||
  !Array.isArray(data.entries)||!data.entries.length)throw Error("DBV-Snapshot ungültig");
 const rows=data.entries.map(calendarEntry).filter(Boolean);
 if(rows.length!==data.entries.length)throw Error("Unvollständiger DBV-Snapshot");
 return {rows,timestamp:Date.parse(data.capturedAt)||0};
}
async function load(){
 if(loading)return;
 loading=true;problem="";message("Offizieller DBV-Kalender wird geladen …");
 try{
  const collected=[];
  for(let offset=0;offset<1200;offset+=400){
   const params=new URLSearchParams({select:"source_key,title,start_date,end_date,location_text,organizer,bundesland,region_scope,category,level_group,age_groups,disciplines,registration_deadline,event_url,last_seen_at",order:"start_date.asc",limit:"400",offset:String(offset)});
   const {rows}=await readPublicRows("dbv_calendar_entries?"+params,{retries:1,timeoutMs:9500,count:false});
   collected.push(...rows);
   if(rows.length<400)break;
  }
  entries=collected.map(calendarEntry).filter(Boolean);
  source="supabase";
  if(!entries.length)throw Error("DB ohne Kalendereinträge");
  const dbChecked=Math.max(0,...entries.map(e=>Date.parse(e.checked)||0));
  // A source-backed published snapshot may be newer if GitHub's secure DB writer is not configured.
  if(Date.now()-dbChecked>12*3600000){
   try{
    const snapshot=await readSnapshot();
    if(snapshot.timestamp>dbChecked+3600000){
     entries=snapshot.rows;source="snapshot";
    }
   }catch{ /* keep valid Supabase data when snapshot is absent */ }
  }
 }catch{
  try{
   const snapshot=await readSnapshot();
   entries=snapshot.rows;source="snapshot";
  }catch{entries=[];source="offline";problem="Der Kalender ist derzeit nicht erreichbar."}
 }
 loading=false;loaded=true;
 updateControls();render();
 if(!entries.length&&problem)message(problem+" Offiziellen DBV-Kalender bei Bedarf direkt öffnen.");
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("dbv-calendar-results"))return;
 for(const key of ["year","region","age","level","period","group","q"]){
  const node=$("dbv-calendar-"+key);
  node?.addEventListener(key==="q"?"input":"change",()=>{
   settings[key]=node.value;
   try{localStorage.setItem(STORAGE,JSON.stringify(settings))}catch{}
   batchLimit=36;render();
  });
 }
 $("dbv-calendar-results")?.addEventListener("click",event=>{
  const history=event.target.closest("button[data-calendar-show-history]");
  if(history){
   settings.period="all";
   $("dbv-calendar-period").value="all";
   try{localStorage.setItem(STORAGE,JSON.stringify(settings))}catch{}
   batchLimit=36;render();return;
  }
  const future=event.target.closest("button[data-calendar-show-2027]");
  if(future){
   settings.year="2027";
   $("dbv-calendar-year").value="2027";
   try{localStorage.setItem(STORAGE,JSON.stringify(settings))}catch{}
   batchLimit=36;render();return;
  }
  const alternative=event.target.closest("button[data-calendar-alternative-level]");
  if(alternative&&LEVEL_OPTIONS.includes(alternative.dataset.calendarAlternativeLevel)){
   settings.level=alternative.dataset.calendarAlternativeLevel;
   $("dbv-calendar-level").value=settings.level;
   try{localStorage.setItem(STORAGE,JSON.stringify(settings))}catch{}
   batchLimit=36;render();return;
  }
  const button=event.target.closest("button[data-calendar-toggle]");
  if(!button)return;
  const found=entries.find(t=>t.key===button.dataset.calendarToggle);
  if(!found)return;
  const result=window.badmintonCalendarToggle?.(found);
  if(!result?.ok)message(result?.message||"Turnier konnte nicht vorgemerkt werden.");
 });
 window.addEventListener("badminton:tournament-bookmarks",()=>{if(loaded)render()});
 $("dbv-calendar-more")?.addEventListener("click",()=>{batchLimit+=36;render()});
 $("dbv-calendar-refresh")?.addEventListener("click",()=>{loaded=false;batchLimit=36;void load()});
 void load();
});
