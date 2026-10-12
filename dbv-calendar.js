/** Public DBV calendar from Badminton Supabase, with static source fallback. */
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {AGE_OPTIONS,LEVEL_OPTIONS,calendarEntry,regionLabel,filterCalendar} from "./scripts/dbv-calendar-utils.mjs";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const formatDate=s=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"}).format(new Date(s+"T12:00:00Z"));
const localToday=()=>{
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const x=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
 return x.year+"-"+x.month+"-"+x.day;
};
const STORAGE="schmetterlinge.dbvCalendarFilters.v1";
const defaults={region:"all",age:"all",level:"all",q:"",period:"upcoming",group:"region"};
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
 selectOptions($("dbv-calendar-region"),regions,"Alle Bundesländer / Verbände");
 selectOptions($("dbv-calendar-age"),AGE_OPTIONS,"Alle Altersklassen");
 selectOptions($("dbv-calendar-level"),LEVEL_OPTIONS,"Alle Level");
 for(const key of ["region","age","level","group","period","q"]){
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
 message(selected.total+" von "+entries.length+" offiziellen Kalendereinträgen · Quelle DBV"+warning);
 if(!selected.total){
  host.innerHTML='<p class="settings-hint">Keine passenden Turniere im aktuell importierten Zeitraum. Filter anpassen oder den <a href="https://turniere.badminton.de/" target="_blank" rel="noopener noreferrer">DBV-Kalender öffnen ↗</a>.</p>';
  return;
 }
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
    '<div class="dbv-calendar-detail"><h5>'+esc(t.title)+'</h5><p>'+esc(t.place)+(t.organizer?' · '+esc(t.organizer):"")+'</p>'+
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
 for(const key of ["region","age","level","period","group","q"]){
  const node=$("dbv-calendar-"+key);
  node?.addEventListener(key==="q"?"input":"change",()=>{
   settings[key]=node.value;
   try{localStorage.setItem(STORAGE,JSON.stringify(settings))}catch{}
   batchLimit=36;render();
  });
 }
 $("dbv-calendar-more")?.addEventListener("click",()=>{batchLimit+=36;render()});
 $("dbv-calendar-refresh")?.addEventListener("click",()=>{loaded=false;batchLimit=36;void load()});
 void load();
});
