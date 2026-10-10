/** Shared DBV player directory, generated weekly from the official published Excel. */
import {selectPlayers,clubGroups,normalizeText,sortClubs} from "./scripts/library-utils.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";

const ROOT="./data/player-library/";
let dbMode=false,dbTotal=0,associationsLoaded=false,filterTimer=null,suggestionTicket=0;
const safePattern=x=>String(x||"").trim().replace(/[*,().%:"\\]/g," ").slice(0,85);
async function dbGet(path){
 return readPublicRows(path);
}
function dbPath(offset){
 const qs=new URLSearchParams({select:"dbv_id,name,birth_year,age_class,club,association,last_ranking_week",
  order:"club.asc.nullslast,name.asc,dbv_id.asc",limit:"40",offset:String(offset)});
 const age=$("library-age")?.value||"all",association=$("library-association")?.value||"all";
 const term=safePattern($("library-search")?.value),club=safePattern($("library-club")?.value);
 if(age!=="all")qs.set("age_class","eq."+age);
 if(association!=="all")qs.set("association","eq."+association);
 if(club)qs.set("club","ilike.*"+club+"*");
 if(term)qs.set("or","(name.ilike.*"+term+"*,dbv_id.ilike.*"+term+"*)");
 return "players?"+qs;
}
async function dbPage(offset){
 const {rows,range}=await dbGet(dbPath(offset));
 if(!Array.isArray(rows))throw Error("Invalid database response");
 const m=range.match(/\/(\d+)$/);
 return {people:rows.filter(p=>/^\d{2}-\d{6}$/.test(p.dbv_id)&&p.name&&p.age_class).map(p=>({
   id:p.dbv_id,name:p.name,birthYear:p.birth_year,ageClass:p.age_class,club:p.club||"",
   association:p.association||"",lastSeen:p.last_ranking_week||""
 })),total:m?Number(m[1]):offset+rows.length};
}
async function dbAssociations(){
 const {rows}=await dbGet("clubs?select=association&dbv_club_id=not.is.null&limit=1000");
 const box=$("library-association"),old=box.value;
 const values=[...new Set(rows.map(x=>x.association).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
 box.innerHTML='<option value="all">Alle Landesverbände</option>'+values.map(v=>
  '<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
 box.value=values.includes(old)?old:"all";
 associationsLoaded=true;
}
async function dbClubs(){
 const term=safePattern($("library-club")?.value),list=$("library-club-suggestions");
 if(term.length<2){list.innerHTML="";return}
 const ticket=++suggestionTicket;
 try{
  const qs=new URLSearchParams({select:"name",dbv_club_id:"not.is.null",name:"ilike.*"+term+"*",order:"name.asc",limit:"60"});
  const {rows}=await dbGet("clubs?"+qs);
  if(ticket===suggestionTicket)list.innerHTML=rows.map(x=>'<option value="'+escape(x.name)+'"></option>').join("");
 }catch{if(ticket===suggestionTicket)list.innerHTML=""}
}

const $=id=>document.getElementById(id);
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ageNames=["U11","U13","U15","U17","U19","U22"];
const memory=new Map();
let summary=null,entries=[],lastAge="",pending=0,visible=40,loaded=false;
async function fetchJson(path){
 const response=await fetch(path,{cache:"no-store"});
 if(!response.ok)throw Error("HTTP "+response.status);
 return response.json();
}
function error(msg){const box=$("library-results");if(box)box.innerHTML='<div class="library-message">'+escape(msg)+'</div>'}
function ageChoice(){return $("library-age")?.value||"all"}
function hasCriteria(){
 return Boolean(
  String($("library-search")?.value||"").trim() ||
  String($("library-club")?.value||"").trim() ||
  ageChoice()!=="all" ||
  ($("library-association")?.value||"all")!=="all"
 );
}
// No public player cards or whole-roster request before an explicit filter.
function showIdle(){
 ++pending; // Ignore a search response that finished after filters were cleared.
 entries=[];dbTotal=0;visible=40;loaded=true;
 const count=$("library-count"),area=$("library-results"),more=$("library-more"),reset=$("library-reset");
 if(count)count.textContent="Spieler suchen";
 if(area)area.innerHTML='<div class="library-message library-idle"><strong>Spieler suchen</strong>'+
  '<span>Name oder DBV-ID eingeben oder nach Verein, Altersklasse bzw. Landesverband filtern.</span></div>';
 if(more)more.hidden=true;
 if(reset)reset.hidden=true;
 if($("library-message"))$("library-message").textContent="";
 if($("library-source"))$("library-source").textContent="Öffentliches DBV-Verzeichnis · Ergebnisse erst nach Suche oder Filterauswahl";
}
function filtered(){
 return dbMode?entries:selectPlayers(entries,{
  query:$("library-search")?.value||"",
  club:$("library-club")?.value||"",
  association:$("library-association")?.value||"all"
 });
}
function updateClubSuggestions(){
 const list=$("library-club-suggestions");if(!list)return;
 if(dbMode){dbClubs();return;}
 const query=normalizeText($("library-club")?.value||"");
 const clubs=sortClubs(entries.map(p=>p.club).filter(Boolean));
 const relevant=clubs.filter(c=>!query||normalizeText(c).includes(query)).slice(0,90);
 list.innerHTML=relevant.map(name=>'<option value="'+escape(name)+'"></option>').join("");
}
function updateAssociations(){
 const chooser=$("library-association");if(!chooser)return;
 const previous=chooser.value||"all";
 const values=[...new Set(entries.map(x=>x.association).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
 chooser.innerHTML='<option value="all">Alle Landesverbände</option>'+
  values.map(v=>'<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
 chooser.value=values.includes(previous)?previous:"all";
}
function localSelection(){
 return window.badmintonLibraryGetState?.()||{own:[],following:[]};
}
function render(){
 if(!loaded)return;
 if(!hasCriteria()){showIdle();return;}
 if($("library-reset"))$("library-reset").hidden=false;
 const own=new Set(localSelection().own),following=new Set(localSelection().following);
 const people=filtered(),count=$("library-count"),area=$("library-results");
 const shown=dbMode?people:people.slice(0,visible);
 if(count)count.textContent=(dbMode?dbTotal:people.length).toLocaleString("de-DE")+" passende Spieler · nach Verein gruppiert";
 if(!area)return;
 if(!people.length){
  error("Keine passenden bestätigten DBV-Spieler gefunden. Andere Filter wählen oder bei einem neuen Profil die DBV-ID ergänzen.");
  $("library-more").hidden=true;return;
 }
 area.innerHTML=clubGroups(shown).map(group=>
  '<section class="library-club-group"><h3>'+escape(group.club||"Verein nicht ausgewiesen")+
  '<span>'+group.players.length+' Spieler'+(group.players.length===1?"":"innen und Spieler")+'</span></h3>'+
  group.players.map(p=>{
   const isOwn=own.has(p.id),isFollowed=following.has(p.id);
   return '<article class="library-player">'+
    '<div class="library-player-avatar" aria-hidden="true">'+escape(p.name.slice(0,1).toUpperCase())+'</div>'+
    '<div class="library-player-info"><strong>'+escape(p.name)+'</strong>'+
    '<span>'+escape(p.ageClass)+(p.birthYear?' · Jahrgang '+escape(p.birthYear):"")+'</span>'+
    '<small>DBV '+escape(p.id)+(p.lastSeen?' · Stand '+escape(p.lastSeen):"")+'</small></div>'+
    '<div class="library-player-action">'+
      (isOwn?'<span class="library-own">Eigenes Profil</span>':
       '<button type="button" data-library-toggle="'+escape(p.id)+'" aria-label="'+escape(p.name)+' '+(isFollowed?"entfolgen":"folgen")+'" class="'+(isFollowed?"following":"")+'">'+(isFollowed?"✓ Folge ich":"+ Folgen")+'</button>')+
      (isFollowed?'<button type="button" class="library-view" data-library-open="'+escape(p.id)+'">Ansehen ↗</button>':"")+
    '</div></article>';
  }).join("")+'</section>'
 ).join("");
 area.querySelectorAll("[data-library-toggle]").forEach(button=>button.addEventListener("click",()=>{
  const p=people.find(x=>x.id===button.dataset.libraryToggle);
  if(!p)return;
  const result=window.badmintonLibraryToggleFollow?.(p);
  const msg=$("library-message");if(msg&&result?.message)msg.textContent=result.message;
  render();
 }));
 area.querySelectorAll("[data-library-open]").forEach(button=>button.addEventListener("click",()=>{
  window.badmintonLibraryView?.(button.dataset.libraryOpen);
 }));
 $("library-more").hidden=dbMode?people.length>=dbTotal:people.length<=visible;
}
async function fetchAge(age){
 if(memory.has(age))return memory.get(age);
 const index=summary.ageGroups.find(a=>a.age===age);
 if(!index)return [];
 const data=await fetchJson(ROOT+encodeURIComponent(index.file));
 if(data.schemaVersion!==1||data.ageClass!==age||!Array.isArray(data.players))throw Error("Ungültige DBV-Spielerdatei für "+age);
 const records=data.players.filter(x=>x&&/^\d{2}-\d{6}$/.test(x.id)&&x.ageClass===age&&typeof x.name==="string"&&x.name.trim());
 memory.set(age,records);
 return records;
}
async function loadBackup(){
 if(!hasCriteria()){showIdle();return;}
 const ticket=++pending;
 $("library-more").hidden=true;
 loaded=false;
 error("Die öffentliche DBV-Spielerbibliothek wird geladen …");
 try{
  if(!summary){
   summary=await fetchJson(ROOT+"index.json");
   if(summary.schemaVersion!==1||!Array.isArray(summary.ageGroups)||!summary.ageGroups.length)throw Error("Ungültiger Verzeichnisindex");
   $("library-source").textContent="Offizielle DBV-Rangliste · KW "+summary.week+"/"+summary.year+" · "+summary.total.toLocaleString("de-DE")+" bestätigte Spieler";
  }
  const chosen=ageChoice();
  const ages=chosen==="all"?ageNames:[chosen];
  const files=await Promise.all(ages.map(fetchAge));
  if(ticket!==pending)return;
  const byId=new Map();
  for(const row of files.flat())byId.set(row.id,row);
  entries=[...byId.values()];
  visible=40;lastAge=chosen;loaded=true;
  updateClubSuggestions();
  updateAssociations();
  render();
 }catch(e){
  if(ticket!==pending)return;
  error("Die Spielerbibliothek konnte derzeit nicht geladen werden. Internetverbindung prüfen und erneut versuchen.");
  console.warn("DBV directory unavailable:",e?.message);
 }
}
async function load(){
 if(!hasCriteria()){showIdle();return;}
 const ticket=++pending;
 loaded=false;$("library-more").hidden=true;
 error("Die Spielerbibliothek wird aus Supabase geladen …");
 try{
  const {people,total}=await dbPage(0);
  if(ticket!==pending)return;
  entries=people;dbTotal=total;dbMode=true;loaded=true;
  $("library-source").textContent="Supabase · offizieller DBV-Ranglistenbestand · "+total.toLocaleString("de-DE")+" Spieler";
  if(!associationsLoaded)dbAssociations().catch(e=>console.warn("Vereinsfilter:",e?.message));
  render();
 }catch(e){
  if(ticket!==pending)return;
  console.warn("Supabase nicht erreichbar – GitHub-Ausfallsicherung:",e?.message);
  dbMode=false;await loadBackup();
  if(loaded)$("library-source").textContent="GitHub-Ausfallsicherung · "+$("library-source").textContent;
 }
}
async function nextPage(){
 if(!hasCriteria()){showIdle();return;}
 if(!dbMode){visible+=40;render();return}
 const ticket=++pending,offset=entries.length;
 try{
  const {people,total}=await dbPage(offset);
  if(ticket!==pending)return;
  entries.push(...people);dbTotal=total;render();
 }catch{const box=$("library-message");if(box)box.textContent="Weitere Spieler momentan nicht erreichbar."}
}
function delayedFilter(){
 clearTimeout(filterTimer);
 if(!hasCriteria()){showIdle();return;}
 filterTimer=setTimeout(()=>{visible=40;load()},280);
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("library-results"))return;
 showIdle();
 // Small club metadata fetch may populate the Landesverband filter, never the 9,246-player list.
 dbAssociations().catch(e=>console.warn("Landesverbände derzeit nicht abrufbar:",e?.message));
 $("library-age").addEventListener("change",load);
 for(const id of ["library-search","library-club"]){
  $(id).addEventListener("input",()=>{if(id==="library-club")updateClubSuggestions();delayedFilter();});
 }
 $("library-association").addEventListener("change",()=>{visible=40;load();});
 $("library-more").addEventListener("click",nextPage);
 $("library-reset").addEventListener("click",()=>{
  $("library-search").value="";
  $("library-club").value="";
  $("library-age").value="all";
  $("library-association").value="all";
  $("library-club-suggestions").innerHTML="";
  clearTimeout(filterTimer);showIdle();
  $("library-search").focus();
 });
 $("library-reload").addEventListener("click",()=>{summary=null;memory.clear();load();});
 window.addEventListener("hashchange",()=>{if(location.hash==="#spieler"&&hasCriteria()&&!loaded)load();});
 window.addEventListener("badminton:library-following",()=>render());
 // Initial page load deliberately does not fetch the full roster.
});
