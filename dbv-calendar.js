/** Public DBV calendar from Badminton Supabase, with static source fallback. */
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {AGE_OPTIONS,LEVEL_OPTIONS,calendarEntry,regionLabel,filterCalendar,alternativeCalendarLevels,isNationalU11Masters,isVerifiedCalendarDuplicate,mergeOfficialCalendarRows} from "./scripts/dbv-calendar-utils.mjs";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate=s=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));
const localToday=()=>{
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const x=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return x.year+"-"+x.month+"-"+x.day;
};
function venueLabel(place){const value=String(place||"").trim();return value?"Austragungsort: "+value:"Austragungsort noch nicht veröffentlicht";}
const BW_YOUTH_AGES=["U11","U13","U15","U17","U19"];
// Separate official schedule announcements from event-ID backed DBV records.
// These are source-backed planning/award dates, NOT confirmed sign-up events.
const BWBV_C_FRAMEWORK_2027=[
 {key:"bwbv-2027-c-1",start:"2027-01-16",end:"2027-01-17",level:"C",title:"1. BWBV/C-RLT Jugend · Einzel/Doppel",ages:["U11","U13","U15","U17","U19"],ageCertain:false},
 {key:"bwbv-2027-c-2",start:"2027-02-27",end:"2027-02-28",level:"C",title:"2. BWBV/C-RLT Jugend · Einzel/Mixed",ages:["U13","U15","U17","U19"],ageCertain:false},
 {key:"bwbv-2027-c-3",start:"2027-05-08",end:"2027-05-09",level:"C",title:"3. BWBV/C-RLT Jugend · Einzel/Doppel",ages:["U11","U13","U15","U17","U19"],ageCertain:false},
 // The fourth C round does not generally offer U11 according to BWBV youth rules.
 {key:"bwbv-2027-c-4",start:"2027-06-26",end:"2027-06-27",level:"C",title:"4. BWBV/C-RLT Jugend · Hexen-Cup",ages:["U13","U15","U17","U19"],ageCertain:false}
];
const BWBV_FRAMEWORK_SOURCE="https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf";
const BWBV_B_FRAMEWORK_2027=[
 {key:"bwbv-2027-b-3",start:"2027-01-30",end:"2027-01-31",level:"B",title:"Gruppe SüdOst · B-RLT U13–U19",ages:["U13","U15","U17","U19"],ageCertain:true,
  source:BWBV_FRAMEWORK_SOURCE}
];
const DBV_A_VERGABE_2027=[
 {key:"dbv-bw-a-2027-2",start:"2027-02-20",end:"2027-02-21",level:"A",title:"2. A-RLT U11/U13 · BC Lörrach-Brombach",ages:["U11","U13"],ageCertain:true,
  source:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"},
 {key:"dbv-bw-a-2027-4",start:"2027-04-24",end:"2027-04-25",level:"A",title:"4. DBV-A-RLT U11/U13 · BSV Eggenstein",ages:["U11","U13"],ageCertain:true,
  source:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"}
];
let BW_YOUTH_FRAMEWORK_2027=[
 ...BWBV_C_FRAMEWORK_2027.map(t=>({...t,source:BWBV_FRAMEWORK_SOURCE})),
 ...BWBV_B_FRAMEWORK_2027,...DBV_A_VERGABE_2027
].sort((a,b)=>a.start.localeCompare(b.start));
function bwFrameworkDates(filters,today){
 if(filters.region!=="Baden-Württemberg"||!BW_YOUTH_AGES.includes(filters.age)||
  !["all","2027"].includes(filters.year))return [];
 const search=String(filters.q||"").normalize("NFKC").toLocaleLowerCase("de").trim();
 return BW_YOUTH_FRAMEWORK_2027.filter(t=>
  t.ages.includes(filters.age)&&
  (filters.level==="all"||filters.level===t.level)&&
  (filters.period!=="upcoming"||t.end>=today)&&
  (!search||(t.title+" "+(t.place||"")+" "+t.level+" 2027 BWBV DBV").normalize("NFKC").toLocaleLowerCase("de").includes(search)));
}
function bwFrameworkHTML(filters,today){
 const planned=bwFrameworkDates(filters,today);
 if(!planned.length)return "";
 const bookmarks=window.badmintonCalendarBookmarkState?.()||{playerId:"",playerName:"",savedKeys:[]};
 const saved=new Set(bookmarks.savedKeys||[]);
 return '<section class="dbv-calendar-cluster dbv-calendar-sourced-plan" aria-label="Offizielle Termine 2027">'+
  '<h4>Turniere 2027 <small>'+planned.length+'</small></h4>'+
  planned.map(t=>'<article class="dbv-calendar-entry dbv-calendar-external-plan card-open-surface">'+
    '<div class="dbv-calendar-date"><strong>'+esc(formatDate(t.start))+'</strong><small>bis '+esc(formatDate(t.end))+'</small></div>'+
    '<div class="dbv-calendar-detail"><div class="dbv-calendar-card-head"><h5>'+esc(t.title)+'</h5>'+
    '<button type="button" class="dbv-calendar-save'+(saved.has(t.key)?' is-saved':'')+'" data-framework-toggle="'+esc(t.key)+'"'+
    ' aria-pressed="'+(saved.has(t.key)?'true':'false')+'"'+
    ' aria-label="'+esc(bookmarks.playerId?(saved.has(t.key)?'Vormerkung entfernen: ':'Für '+bookmarks.playerName+' vormerken: ')+t.title:'Bitte zuerst ein eigenes Spielerprofil auswählen')+'"'+
    (bookmarks.playerId?'':' disabled title="Eigenes Spielerprofil auswählen"')+'>'+
    (saved.has(t.key)?'✓':'+')+'</button></div>'+
    '<p class="dbv-calendar-place">'+esc(venueLabel(t.place))+'</p>'+
    '<p>Level '+esc(t.level)+' · '+esc(t.level==="A"?"Ausrichter vergeben":t.ageCertain?filters.age+" vorgesehen":filters.age+" noch offen")+' · Rahmentermin</p>'+
    '<a class="card-open-primary" href="'+esc(t.source)+'" target="_blank" rel="noopener noreferrer">Terminquelle ↗</a></div>'+
  '</article>').join("")+'</section>';
}
function bwNextYearHint(filters){
 if(filters.region!=="Baden-Württemberg"||!BW_YOUTH_AGES.includes(filters.age)||
  filters.year!=="2026"||!["all","A","B","C"].includes(filters.level))return "";
 const planned=bwFrameworkDates({...filters,year:"2027"},localToday());
 if(!planned.length)return "";
 return '<button type="button" class="subtle-button dbv-calendar-year-jump" data-calendar-show-2027>'+
   '2027: '+planned.length+' A-/B-/C-Termine ansehen ↗</button>';
}
// Verified completed 2026 tournaments are displayed as real result cards,
// never masquerading as imported DBV event IDs or registration opportunities.
const BW_YOUTH_ARCHIVE_2026=[
 {level:"C",start:"2026-01-17",end:"2026-01-18",title:"1. C-RLT BAW Einzel/Doppel U11–U19",ages:["U11","U13","U15","U17","U19"],place:"Reutlingen",detail:"Einzel/Doppel",
  source:"https://dbv.turnier.de/tournament/52b3b803-279b-48cf-8143-f5078f5236db",sourceKind:"results",
  report:"https://bwbv.de/2026/02/02/1-c-rlt-baw-e-d-u11-u19-vom-17-18-01-2026-in-reutlingen/"},
 {level:"A",start:"2026-02-07",end:"2026-02-08",title:"1. A-RLT U15/U19",ages:["U15","U19"],place:"Waghäusel",detail:"",
  source:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2026/",sourceKind:"announcement"},
 {level:"C",start:"2026-02-28",end:"2026-03-01",title:"2. C-RLT U11–U19",ages:["U11","U13","U15","U17","U19"],place:"Friedrichshafen",detail:"Einzel/Mixed",
  source:"https://bwbv.de/2026/03/22/erfolgreiches-c-ranglistenturnier-in-friedrichshafen/",sourceKind:"results"},
 {level:"C",start:"2026-04-25",end:"2026-04-26",title:"3. C-RLT U11–U19",ages:["U11","U13","U15","U17","U19"],place:"Mössingen",detail:"Einzel/Doppel",
  source:"https://dbv.turnier.de/tournament/DBB7AC20-FAD9-43A4-8842-6FA838623F35",sourceKind:"results"},
 {level:"A",start:"2026-05-02",end:"2026-05-03",title:"4. A-RLT U11/U13",ages:["U11","U13"],place:"Eggenstein-Leopoldshafen",detail:"",
  source:"https://bwbv.de/2026/05/07/4-a-rlt-in-eggenstein-leopoldshafen-silber-fuer-den-bsv/",sourceKind:"results"},
 {level:"B",start:"2026-06-13",end:"2026-06-14",title:"3. B-RLT SüdOst U13–U19",ages:["U13","U15","U17","U19"],place:"Waghäusel",detail:"",
  source:"https://badminton-rlp.de/aktuelles/33-globus-oliver-cup-jugend-badminton-in-waghaeusel",sourceKind:"announcement"},
 {level:"A",start:"2026-06-27",end:"2026-06-28",title:"5. A-RLT U17/U19",ages:["U17","U19"],place:"Lörrach-Brombach",detail:"",
  source:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2026/",sourceKind:"announcement"},
 // The official 2026 Hexen-Cup invitation distinguishes A U11/U13 from C U15/U17/U19.
 {level:"A",start:"2026-06-27",end:"2026-06-28",title:"6. A-RLT U11/U13 · Hexen-Cup",ages:["U11","U13"],place:"Konstanz",detail:"Einzel/Doppel/Mixed",
  source:"https://dbv.turnier.de/tournament/35299a0c-11f6-4ffd-85c2-3aca6dd1c0aa",sourceKind:"results"},
 {level:"C",start:"2026-06-27",end:"2026-06-28",title:"Hexen-Cup · C-RLT U15/U17/U19",ages:["U15","U17","U19"],place:"Konstanz",detail:"Einzel/Doppel/Mixed",
  source:"https://bwbv.de/wp-content/uploads/2026/04/hx26-ausschreibung-de_nachbearbeitet.pdf",sourceKind:"announcement"}
];
function bwArchiveDates(filters){
 const search=String(filters.q||"").normalize("NFKC").toLocaleLowerCase("de").trim();
 const normal=filters.region==="Baden-Württemberg"&&BW_YOUTH_AGES.includes(filters.age)&&
  filters.year==="2026"&&filters.period==="all";
 // The primary name/place search must also find an already verified 2026
 // result without requiring four hidden filter changes. Never call it a
 // future registration or silently relabel a 2027 planning date.
 const discover=search.length>=3&&["all","Baden-Württemberg"].includes(filters.region)&&
  ["all","2026"].includes(filters.year)&&
  (filters.age==="all"||BW_YOUTH_AGES.includes(filters.age));
 if(!normal&&!discover)return [];
 return BW_YOUTH_ARCHIVE_2026.filter(t=>
  (filters.age==="all"||t.ages.includes(filters.age))&&
  (filters.level==="all"||filters.level===t.level)&&
  (!discover||filters.period!=="upcoming"||t.sourceKind==="results")&&
  (!search||(t.title+" "+t.place+" "+t.level+" "+t.detail).normalize("NFKC").toLocaleLowerCase("de").includes(search)));
}
function bwArchiveHTML(filters){
 const found=bwArchiveDates(filters);
 if(!found.length)return "";
 return '<section class="dbv-calendar-cluster dbv-calendar-sourced-results" aria-label="Verifizierte Turniere 2026">'+
  '<h4>'+(String(filters.q||"").trim().length>=3&&filters.period==="upcoming"?'Vergangene Turniere 2026 · Ergebnisse':'Turniere 2026')+' <small>'+found.length+'</small></h4>'+
  found.map(t=>{
  const direct=t.sourceKind==="results"?window.SchmetterlingeBookmarks?.parseDbvTournamentLink?.(t.source):null;
  const own=window.badmintonCalendarBookmarkState?.()||{playerId:"",playerName:"",savedKeys:[]};
  const saved=Boolean(direct&&(own.savedKeys||[]).includes(direct.id));
  return '<article class="dbv-calendar-entry dbv-calendar-external-result card-open-surface">'+
   '<div class="dbv-calendar-date"><strong>'+esc(formatDate(t.start))+'</strong>'+
     '<small>bis '+esc(formatDate(t.end))+'</small></div>'+
   '<div class="dbv-calendar-detail"><div class="dbv-calendar-card-head"><h5>'+esc(t.title)+'</h5>'+
   (direct?'<button type="button" class="dbv-calendar-save'+(saved?' is-saved':'')+'" data-official-toggle="'+esc(direct.id)+'" aria-pressed="'+(saved?'true':'false')+'" aria-label="'+
    esc(own.playerId?(saved?'Gespeichertes Turnier entfernen: ':'Für '+own.playerName+' speichern: ')+t.title:'Bitte zuerst ein eigenes Spielerprofil auswählen')+'"'+
    (own.playerId?'':' disabled title="Eigenes Spielerprofil auswählen"')+'>'+(saved?'✓':'+')+'</button>':'')+'</div>'+
   '<p class="dbv-calendar-place">'+esc(venueLabel(t.place))+'</p>'+ 
    '<p>Level '+esc(t.level)+(t.detail?' · '+esc(t.detail):'')+'</p>'+
   '<a class="card-open-primary" href="'+esc(t.source)+'" target="_blank" rel="noopener noreferrer">'+
      (t.sourceKind==="results"?"Ergebnisse ansehen ↗":"Turnierinfo ↗")+'</a>'+ (t.report?'<a href="'+esc(t.report)+'" target="_blank" rel="noopener noreferrer">BWBV-Bericht ↗</a>':'')+'</div>'+
   '</article>';}).join("")+'</section>';
}
const STORAGE="schmetterlinge.dbvCalendarFilters.v1";
const defaults={year:"all",region:"all",age:"all",level:"all",q:"",period:"upcoming",group:"region"};
function readPreference(){
 try{const x=JSON.parse(localStorage.getItem(STORAGE)||"{}");return {...defaults,...Object.fromEntries(Object.entries(x).filter(([k,v])=>k in defaults&&typeof v==="string"))}}catch{return {...defaults}}
}
let settings=readPreference(),entries=[],source="supabase",loading=false,loaded=false,problem="",batchLimit=36;
function message(s,state="ready"){
 const n=$("dbv-calendar-status");if(!n)return;
 n.textContent=s;n.dataset.state=state;
 n.setAttribute("aria-busy",state==="loading"?"true":"false");
}
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
 const activeFilters=["year","region","age","level","period","group"].filter(key=>settings[key]!==defaults[key]).length;
 const summary=$("dbv-calendar-advanced-summary");
 if(summary)summary.textContent=activeFilters?"Weitere Filter · "+activeFilters+" aktiv":"Weitere Filter";
 if(!loaded)return;
 const host=$("dbv-calendar-results");
 if(!host)return;
 const today=localToday();
 // Prefer direct result cards when DBV's archive contains the same tournament.
 // Public events are not counted twice.
 // Collapse only matching official DBV UUIDs, never similar city/date/level.
 const selected=filterCalendar(entries.filter(t=>
  !BW_YOUTH_ARCHIVE_2026.some(curated=>isVerifiedCalendarDuplicate(t,curated))),
  {...settings,today,includeNationalU11Masters:true});
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
 const mastersVisible=settings.age==="U11"&&settings.region!=="all"&&
   selected.groups.some(group=>group.items.some(isNationalU11Masters));
 const unavailable=source==="offline",snapshotOnly=source==="snapshot";
 const details=(sourcedCount?" · "+sourcedCount+" zusätzlich aus offiziellen Quellen":"")+
  (selected.total?" · "+selected.total+" DBV":"")+
  (mastersVisible?" · inkl. German Masters U11 (DBV, bundesweit)":"")+warning;
 if(unavailable){
  message("Aktuelle DBV-Kalenderquelle nicht erreichbar"+
   (sourcedCount?" · nur separat belegte Termine und Ergebnisse":" · keine aktuellen DBV-Ergebnisse")+
   ". Bitte später erneut aktualisieren.","offline");
 }else{
  message((snapshotOnly?"Gespeicherter offizieller DBV-Stand · ":"")+
   hits+" passende Turniere"+(plansCount?" / Termine":"")+details,
   snapshotOnly?"limited":hits?"ready":"empty");
 }
 if(!selected.total){
  const more=$("dbv-calendar-more");if(more)more.hidden=true;
  if(sourcedCount){
   host.innerHTML=nextYearHint+archiveHTML+frameworkHTML;
   return;
  }
  const alternatives=alternativeCalendarLevels(entries,{...settings,today,includeNationalU11Masters:true});
  const switchPeriod=settings.period==="upcoming"&&settings.year==="2026"&&
     settings.region==="Baden-Württemberg"&&BW_YOUTH_AGES.includes(settings.age)
    ?'<button type="button" class="subtle-button" data-calendar-show-history>Ergebnisse 2026 ansehen ↗</button>':"";
  host.innerHTML=nextYearHint+'<div class="dbv-calendar-no-results"><h4>'+(unavailable?"Kalenderquelle nicht erreichbar":"Keine passenden Turniere")+'</h4>'+
    '<p>'+(unavailable?"Aktuelle Turnierdaten konnten nicht geprüft werden. Das ist kein Nachweis für fehlende Turniere.":"In dieser Auswahl sind keine bestätigten Einträge verfügbar.")+'</p>'+
    switchPeriod+
    (alternatives.length?'<div class="dbv-calendar-alternatives">'+
     alternatives.map(option=>'<button type="button" class="subtle-button" data-calendar-alternative-level="'+esc(option.level)+'">'+
      'Level '+esc(option.level)+' ('+option.count+')</button>').join("")+'</div>':"")+
    '</div>';
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
   return '<article class="dbv-calendar-entry card-open-surface'+(t.historicalArchive?' dbv-calendar-entry--history':'')+'"><div class="dbv-calendar-date"><strong>'+esc(formatDate(t.start))+'</strong>'+(t.end!==t.start?'<small>bis '+esc(formatDate(t.end))+'</small>':"")+'</div>'+
    '<div class="dbv-calendar-detail"><div class="dbv-calendar-card-head"><h5>'+esc(t.title)+'</h5>'+
    (t.historicalArchive?'':'<button type="button" class="dbv-calendar-save'+(savedKeys.has(t.key)?' is-saved':'')+'" data-calendar-toggle="'+esc(t.key)+'"'+
    ' aria-pressed="'+(savedKeys.has(t.key)?'true':'false')+'"'+
    ' aria-label="'+esc(bookmarkState.playerId?(savedKeys.has(t.key)?'Vormerkung entfernen: ':'Für '+bookmarkState.playerName+' vormerken: ')+t.title:'Bitte zuerst ein eigenes Spielerprofil auswählen')+'"'+
    (bookmarkState.playerId?'':' disabled title="Eigenes Spielerprofil auswählen"')+'>'+
    (savedKeys.has(t.key)?'✓':'+')+'</button>')+'</div><p class="dbv-calendar-place">'+esc(venueLabel(t.place))+'</p>'+
    (t.organizer?'<p>Veranstalter: '+esc(t.organizer)+'</p>':"")+
    '<div class="dbv-calendar-badges"><span>'+esc(t.category)+'</span>'+t.ages.map(a=>'<span>'+esc(a)+'</span>').join("")+(isNationalU11Masters(t)?'<span>DBV · bundesweit</span>':'')+'</div>'+
    (!t.historicalArchive&&t.deadline?'<p class="dbv-calendar-deadline">Meldeschluss: '+esc(formatDate(t.deadline))+(closed?' · abgelaufen':'')+'</p>':"")+
    '<a class="card-open-primary" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">'+(t.hasDirectLink?"Turnier beim Anbieter öffnen ↗":"DBV-Kalender öffnen ↗")+'</a></div></article>';
  }).join("");
  html+='</section>';
 }
 host.innerHTML=nextYearHint+archiveHTML+frameworkHTML+html;
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
// Independent DBV historical source archive (public only; no personal data).
// An independent, source-backed BWBV/DBV plan supersedes hand-maintained 2027 cards.
async function readBWBVFramework(){
 const response=await fetch("./data/bwbv-youth-framework-2027.json",{cache:"no-store"});
 if(!response.ok)throw Error("BWBV Planungsdatei nicht verfügbar");
 const data=await response.json();
 if(data.schemaVersion!==1||data.scope!=="bw-youth-abc-planning-2027"||
  data.year!==2027||!Array.isArray(data.entries)||data.entries.length!==7||
  !Array.isArray(data.sourceFamilies)||data.sourceFamilies.length!==2)throw Error("BWBV Datenformat");
 const allowedSources=new Set([
  "https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf",
  "https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"
 ]);
 if(data.sourceFamilies.some(source=>!allowedSources.has(source))||
  data.entries.some(t=>!t||typeof t.title!=="string"||t.title.length>150||
   !["A","B","C"].includes(t.level)||!/^2027-\d{2}-\d{2}$/.test(t.start)||
   !/^2027-\d{2}-\d{2}$/.test(t.end)||t.end<t.start||
   !Array.isArray(t.ages)||!t.ages.length||t.ages.some(age=>!BW_YOUTH_AGES.includes(age))||
   typeof t.ageCertain!=="boolean"||t.status!=="planned"||
   !allowedSources.has(t.source)||typeof t.key!=="string"||t.key.length>70||
   "event_url" in t||"registration_deadline" in t)){
  throw Error("BWBV Planungsdatensatz unvollständig");
 }
 if(new Set(data.entries.map(x=>x.key)).size!==7||
  ["A","B","C"].some((l,i)=>data.entries.filter(x=>x.level===l).length!==[2,1,4][i])){
  throw Error("BWBV Planung enthält doppelte oder fehlende Termine");
 }
 return data.entries.map(t=>({...t})).sort((a,b)=>a.start.localeCompare(b.start));
}
async function readBWArchive(){
 const res=await fetch("./data/bw-youth-calendar-archive.json",{cache:"no-store"});
 if(!res.ok)throw Error("Kein historisches BW-Archiv verfügbar");
 const data=await res.json();
 if(data.schemaVersion!==1||data.source!=="https://turniere.badminton.de/"||
   data.scope!=="historical-bw-youth-abc"||!Array.isArray(data.entries))throw Error("Archiv-Metadaten ungültig");
 const rows=data.entries.map(raw=>{const parsed=calendarEntry(raw);return parsed&&{...parsed,historicalArchive:true};});
 if(rows.some(row=>!row||row.bundesland!=="Baden-Württemberg"||
   !["A","B","C"].includes(row.level)||!row.ages.some(age=>BW_YOUTH_AGES.includes(age))||
   !(Array.isArray(data.years)?data.years:[data.year]).map(String).includes(row.start.slice(0,4))||
   row.end>=localToday())){
  throw Error("Archiv enthält nicht passende oder zukünftige DBV-Daten");
 }
 if(new Set(rows.map(t=>t.key)).size!==rows.length)throw Error("Doppelte DBV-Archivkennungen");
 return rows;
}
async function load(){
 if(loading)return;
 loading=true;problem="";message("Offizieller DBV-Kalender wird geladen …","loading");
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
 // Guard against a temporarily incomplete read-only DBV mirror. Only use a
 // recently captured *official* static snapshot, and only for the verified
 // U11 national Masters entry. No broad stale-calendar overwrite.
 if(!entries.some(isNationalU11Masters)){
  try{
   const snapshot=await readSnapshot();
   if(snapshot.timestamp>Date.now()-14*86400000){
    const missing=snapshot.rows.filter(t=>isNationalU11Masters(t)&&!entries.some(e=>e.key===t.key));
    if(missing.length)entries=[...entries,...missing].sort((a,b)=>a.start.localeCompare(b.start));
   }
  }catch{ /* no extra provider polling or speculative event */ }
 }
 // The archive is supplemental. Current DBV data and the six hand-verified
 // source cards remain visible if the independent archive is unavailable.
 try{
  const historical=await readBWArchive();
  entries=mergeOfficialCalendarRows(entries,historical);
 }catch{ /* keep current source and directly verified entries */ }
 // Display independently published BW/DBV planning instead of stale hardcoded cards.
 try{BW_YOUTH_FRAMEWORK_2027=await readBWBVFramework()}
 catch{ /* remain on vetted official fallback when source refresh is unavailable */ }
 loading=false;loaded=true;
 updateControls();render();
 // Only public, already loaded source metadata. No new provider call and no user data.
 window.dispatchEvent(new CustomEvent("badminton:dbv-calendar-loaded",{detail:{entries:entries.map(t=>({
  key:t.key,url:t.url,hasDirectLink:t.hasDirectLink,title:t.title,start:t.start,end:t.end,
  place:t.place,deadline:t.deadline
 }))}}));
 if(!entries.length&&problem)message(problem+" Offiziellen DBV-Kalender bei Bedarf direkt öffnen.","offline");
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("dbv-calendar-results"))return;
 $("tournament-shortcuts")?.addEventListener("click",event=>{
  const button=event.target.closest("button[data-tournament-shortcut]");
  if(!button)return;
  const find=button.dataset.tournamentShortcut==="find";
  const target=find?$("dbv-calendar-q"):$("my-tournaments-title");
  if(!target)return;
  target.scrollIntoView({block:"start",behavior:"auto"});
  if(!find)target.setAttribute("tabindex","-1");
  target.focus({preventScroll:true});
 });
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
  const official=event.target.closest("button[data-official-toggle]");
   if(official){
    const found=BW_YOUTH_ARCHIVE_2026.find(t=>window.SchmetterlingeBookmarks?.parseDbvTournamentLink?.(t.source)?.id===official.dataset.officialToggle);
    if(!found)return;
    const result=window.badmintonOfficialTournamentToggle?.(found);
    if(!result?.ok)message(result?.message||"Turnier konnte nicht gespeichert werden.");
    return;
   }
   const planning=event.target.closest("button[data-framework-toggle]");
   if(planning){
    const found=BW_YOUTH_FRAMEWORK_2027.find(t=>t.key===planning.dataset.frameworkToggle);
    if(!found)return;
    const result=window.badmintonFrameworkToggle?.(found);
    if(!result?.ok)message(result?.message||"Rahmentermin konnte nicht vorgemerkt werden.");
    return;
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
 // Initial guest view may show a vetted static snapshot. Once the family JWT
 // is confirmed, retry the member-only DB source without racing the first load.
 window.addEventListener("badminton:app-access-granted",()=>{
  const refresh=()=>{
   if(loading){setTimeout(refresh,100);return;}
   loaded=false;void load();
  };
  refresh();
 });
 void load();
});
