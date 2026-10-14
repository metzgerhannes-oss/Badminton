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
// Official BWBV youth framework dates for 2027, not confirmed DBV event records.
 // Ages, venue, registration and final disciplines require each event's invitation.
const BWBV_C_FRAMEWORK_2027=[
 {start:"2027-01-16",end:"2027-01-17",title:"1. BWBV/C-RLT Jugend · Einzel/Doppel"},
 {start:"2027-02-27",end:"2027-02-28",title:"2. BWBV/C-RLT Jugend · Einzel/Mixed"},
 {start:"2027-05-08",end:"2027-05-09",title:"3. BWBV/C-RLT Jugend · Einzel/Doppel"},
 {start:"2027-06-26",end:"2027-06-27",title:"4. BWBV/C-RLT Jugend · Hexen-Cup, Einzel/Doppel/Mixed"}
];
const BWBV_FRAMEWORK_SOURCE="https://bwbv.de/wp-content/uploads/2026/01/bj-2025-12-web.pdf";
function bwFrameworkDates(settings,today){
 if(settings.region!=="Baden-Württemberg"||settings.level!=="C"||
  !["all","U13"].includes(settings.age)||!["all","2027"].includes(settings.year))return [];
 const text=String(settings.q||"").toLowerCase().trim();
 return BWBV_C_FRAMEWORK_2027.filter(t=>(settings.period!=="upcoming"||t.end>=today)&&
  (!text||(t.title+" 2027 BWBV C-RLT Rangliste").toLowerCase().includes(text)));
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
 const selected=filterCalendar(entries,{...settings,today:localToday()});
 const fresh=entries.map(e=>Date.parse(e.checked)).filter(Number.isFinite);
 const newest=fresh.length?Math.max(...fresh):0;
 const warning=source==="supabase"&&newest&&Date.now()-newest>8*86400000?" · Letzter DB-Abgleich vor über 8 Tagen":"";
 const coverage=entries.length?formatDate(entries.reduce((earliest,t)=>t.start<earliest?t.start:earliest,entries[0].start))+
  "–"+formatDate(entries.reduce((latest,t)=>t.end>latest?t.end:latest,entries[0].end)):"";
 message(selected.total+" von "+entries.length+" offiziellen Kalendereinträgen · Erfasster Zeitraum: "+coverage+" · Quelle DBV"+warning);
 if(!selected.total){
  const region=settings.region==="all"?"allen Regionen":settings.region;
  const year=settings.year==="all"?"allen Jahren":"Jahr "+settings.year;
  const age=settings.age==="all"?"allen Altersklassen":settings.age;
  const level=settings.level==="all"?"allen Levels":"Level "+settings.level;
  const alternatives=alternativeCalendarLevels(entries,{...settings,today:localToday()});
  // A missing imported result is not proof that an official event does not exist.
  // BWBV publishes an independent youth calendar; only DBV source-backed rows
  // may enter this list, so do not invent records from older PDF schedules.
  const bwU13C=settings.region==="Baden-Württemberg"&&
    settings.age==="U13"&&settings.level==="C";
  const framework=bwFrameworkDates(settings,localToday());
  const frameworkHTML=framework.length
    ?'<section class="dbv-calendar-framework"><h4>BWBV · veröffentlichte C-Ranglisten-Rahmentermine 2027</h4>'+
     '<p>Diese Termine stammen aus dem BWBV-Jugendrahmenkalender, <strong>nicht</strong> aus dem DBV-Turnierimport. Ob U13 bei jedem Termin angeboten wird, Ort und Anmeldung stehen erst in der jeweiligen Ausschreibung.</p>'+
     '<ul>'+framework.map(t=>'<li><strong>'+esc(formatDate(t.start))+'–'+esc(formatDate(t.end))+'</strong> · '+esc(t.title)+'</li>').join("")+'</ul>'+
     '<a href="'+BWBV_FRAMEWORK_SOURCE+'" target="_blank" rel="noopener noreferrer">Offizieller BWBV-Jugendrahmenkalender ↗</a></section>'
    :"";
  const coverageNote=bwU13C
    ?'<p><strong>Quellenlücke möglich:</strong> Für die gewählte Filterauswahl sind im DBV-Import derzeit keine U13/C-Termine erfasst; andere Zeiträume können Treffer enthalten. Bitte den <a href="https://bwbv.de/kalender/" target="_blank" rel="noopener noreferrer">BWBV-Kalender ↗</a> als zweite offizielle Quelle prüfen.</p>'
    :'<p>Der Datenbestand kann unvollständig sein. Keine Treffer bedeuten nicht, dass keine Turniere stattfinden.</p>';
  const more=document.getElementById("dbv-calendar-more");
  if(more)more.hidden=true;
  host.innerHTML='<div class="dbv-calendar-no-results"><h4>Keine passenden Turniere im erfassten Zeitraum</h4>'+
   '<p>Für '+esc(year)+' · '+esc(region)+' · '+esc(age)+' · '+esc(level)+' liegen im aktuellen Datenbestand ('+esc(coverage)+') keine passenden Termine vor.</p>'+
   (alternatives.length?'<p>Mit denselben übrigen Filtern sind folgende Levels verfügbar:</p><div class="dbv-calendar-alternatives">'+
    alternatives.map(option=>'<button type="button" class="subtle-button" data-calendar-alternative-level="'+esc(option.level)+'">'+
      'Level '+esc(option.level)+' ('+option.count+')</button>').join("")+'</div>':"")+
   coverageNote+frameworkHTML+
   '<p class="settings-hint">Der Import umfasst nur den angegebenen Zeitraum; nicht alle DBV-/BWBV-Veranstaltungen sind vollständig erfasst.</p>'+
   '<a href="https://turniere.badminton.de/" target="_blank" rel="noopener noreferrer">Aktuellen DBV-Kalender öffnen ↗</a></div>';
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
 host.innerHTML=html;
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
