/** Shared DBV player directory, generated weekly from the official published Excel. */
import {selectPlayers,clubGroups,normalizeText,sortClubs,localLibraryPlayers} from "./scripts/library-utils.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {searchDbvIdentities,validDbvLookup} from "./scripts/targeted-player-search.mjs";

const ROOT="./data/player-library/";
let dbMode=false,localMode=false,rosterDenied=true,dbTotal=0,associationsLoaded=false,filterTimer=null,suggestionTicket=0;
const safePattern=x=>String(x||"").trim().replace(/[*,().%:"\\]/g," ").slice(0,85);
async function dbGet(path){
 return readPublicRows(path);
}
// Player records use the DBV abbreviation (e.g. "SpVgg. Mössingen"),
// while the clubs directory contains the official full name.
// Resolve the club relation instead of comparing these different labels.
const safeClubPattern=x=>String(x||"").trim().replace(/[*,()%:"\\\\]/g," ").slice(0,85);
async function dbClubIds(){
 const term=safeClubPattern($("library-club")?.value);
 if(!term)return [];
 const qs=new URLSearchParams({select:"id",name:"ilike.*"+term+"*",limit:"100"});
 const {rows}=await dbGet("clubs?"+qs);
 return [...new Set(rows.map(row=>String(row.id||"")).filter(id=>/^[a-zA-Z0-9_-]{1,90}$/.test(id)))];
}
function dbPath(offset,clubIds=[]){
 const qs=new URLSearchParams({select:"dbv_id,name,birth_year,age_class,club,association,last_ranking_week",
  order:"club.asc.nullslast,name.asc,dbv_id.asc",limit:"40",offset:String(offset)});
 const age=$("library-age")?.value||"all",association=$("library-association")?.value||"all";
 const term=safePattern($("library-search")?.value),club=safePattern($("library-club")?.value);
 if(age!=="all")qs.set("age_class","eq."+age);
 if(association!=="all")qs.set("association","eq."+association);
 if(club){
  if(clubIds.length)qs.set("club_id","in.("+clubIds.join(",")+")");
  else qs.set("club","ilike.*"+safeClubPattern($("library-club")?.value)+"*");
 }
 if(term)qs.set("or","(name.ilike.*"+term+"*,dbv_id.ilike.*"+term+"*)");
 return "players?"+qs;
}
async function dbPage(offset){
 const clubIds=await dbClubIds();
 const {rows,range}=await dbGet(dbPath(offset,clubIds));
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
 const values=[...new Set(rows.map(x=>x.association==="BWBV"?"BAW-Baden-Württemberg":x.association).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,"de"));
 box.innerHTML='<option value="all">Alle Landesverbände</option>'+values.map(v=>
  '<option value="'+escape(v)+'">'+escape(v)+'</option>').join("");
 box.value=values.includes(old)?old:"all";
 associationsLoaded=true;
}
async function dbClubs(){
 const term=safeClubPattern($("library-club")?.value),list=$("library-club-suggestions");
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
function error(msg,state="empty"){
 const box=$("library-results");if(!box)return;
 box.dataset.state=state;
 box.setAttribute("aria-busy",state==="loading"?"true":"false");
 box.innerHTML='<div class="library-message">'+escape(msg)+'</div>';
}
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
 if(area){area.dataset.state="idle";area.setAttribute("aria-busy","false");}
 if(area)area.innerHTML='<div class="library-message library-idle"><strong>Spieler suchen</strong>'+
  '<span>Name oder DBV-ID eingeben oder nach Verein, Altersklasse bzw. Landesverband filtern.</span></div>';
 if(more)more.hidden=true;
 if(reset)reset.hidden=true;
 if($("library-message"))$("library-message").textContent="";
 if($("library-source"))$("library-source").textContent="Spielersuche: Name oder DBV-ID ab 3 Zeichen; nur bestätigte Identitätstreffer";
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
 const people=filtered().filter(p=>!own.has(p.id)&&!following.has(p.id)),count=$("library-count"),area=$("library-results");
 const shown=dbMode?people:people.slice(0,visible);
 if(count)count.textContent=people.length.toLocaleString("de-DE")+(localMode?" passende lokale Profile":" passende Spieler")+" · nach Verein gruppiert";
 if(!area)return;
 if(!people.length){
  error(localMode?"Nur deine bereits bekannten Profile gefunden.":"Keine weiteren DBV-Spieler für diese Suche gefunden.",localMode?"limited":"empty");
  $("library-more").hidden=true;return;
 }
 area.dataset.state=localMode?"limited":"ready";
 area.setAttribute("aria-busy","false");
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
       '<button type="button" data-library-toggle="'+escape(p.id)+'" aria-label="'+escape(p.name)+' '+(isFollowed?"bereits gefolgt":"folgen")+'" class="'+(isFollowed?"following":"")+'"'+(isFollowed?' disabled':'')+'>'+(isFollowed?"✓ Gefolgt":"+ Folgen")+'</button>')+
      (isFollowed?'<button type="button" class="library-view" data-library-open="'+escape(p.id)+'">Ansehen ↗</button>':"")+
    '</div></article>';
  }).join("")+'</section>'
 ).join("");
 area.querySelectorAll("[data-library-toggle]").forEach(button=>button.addEventListener("click",()=>{
  const p=people.find(x=>x.id===button.dataset.libraryToggle);
  if(!p)return;
  const result=window.badmintonLibraryToggleFollow?.(p);
  const msg=$("library-message");if(msg&&result?.message)msg.textContent=result.message;
  // iOS can retain a focused search field/keyboard when the result button is
  // replaced. Close only after a successful follow; leave the search open.
  if(result?.ok){
   // The only visible search now lives above the followed list, outside discovery.
   // Dismiss the iPhone keyboard without changing the search query or viewport.
   $("followed-player-search")?.blur();
   if($("player-discover")?.contains(document.activeElement)&&
      document.activeElement?.matches?.("input,select,textarea"))document.activeElement.blur();
  }
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
function loadLocalDirectory(){
 // Device-local data, previously explicitly selected by the user. Never imply a
 // central roster search was successful, and never infer ownership from a DBV ID.
 let storage={};
 try{storage=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}")}catch{}
 const candidates=localLibraryPlayers(storage);
 const age=ageChoice();
 entries=age==="all"?candidates:candidates.filter(p=>p.ageClass===age);
 dbMode=false;localMode=true;dbTotal=entries.length;visible=40;loaded=true;
 const source=$("library-source");
 if(source)source.textContent="Nur gespeicherte Profile auf diesem Gerät · "+candidates.length+" vorhanden · die zentrale DBV-Spielersuche ist eingeschränkt";
 updateClubSuggestions();updateAssociations();
 render();
}
async function loadBackup(){
 if(!hasCriteria()){showIdle();return;}
 const ticket=++pending;
 $("library-more").hidden=true;
 loaded=false;
 error("Die öffentliche DBV-Spielerbibliothek wird geladen …","loading");
 try{
  if(!summary){
   summary=await fetchJson(ROOT+"index.json");
   if(summary.schemaVersion!==1||!Array.isArray(summary.ageGroups)||!summary.ageGroups.length)throw Error("Ungültiger Verzeichnisindex");
   if(summary.privacyMode==="private"){loadLocalDirectory();return;}
   const available=Number.isInteger(summary.total)?summary.total:0;
   const period=Number.isInteger(summary.week)&&Number.isInteger(summary.year)?"KW "+summary.week+"/"+summary.year:"Stand nicht angegeben";
   $("library-source").textContent="Offizielle DBV-Rangliste · "+period+" · "+available.toLocaleString("de-DE")+" bestätigte Spieler";
  }
  if(summary.privacyMode==="private"){loadLocalDirectory();return;}
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
  loadLocalDirectory();
 }
}
async function loadIdentityDirectory(){
 const name=String($("library-search")?.value||"").trim();
 if(!validDbvLookup(name)){
  loadLocalDirectory();
  if($("library-message"))$("library-message").textContent="Für die zentrale DBV-Namenssuche mindestens drei Zeichen eingeben. Ohne Namen werden nur lokal gespeicherte Profile gesucht.";
  return;
 }
 const ticket=++pending;
 loaded=false;$("library-more").hidden=true;
 error("Gezielte DBV-Spielersuche wird geladen …","loading");
 try{
  const people=await searchDbvIdentities(name,{
   ageClass:ageChoice()==="all"?null:ageChoice(),
   club:$("library-club")?.value||null,
   association:$("library-association")?.value||null
  });
  if(ticket!==pending)return;
  entries=people;dbTotal=people.length;dbMode=false;localMode=false;
  loaded=true;visible=40;
  $("library-source").textContent="Gezielte offizielle DBV-Identitätssuche · maximal 12 Treffer · keine persönlichen Statistiken freigegeben";
  render();
 }catch(error){
  if(ticket!==pending)return;
  loadLocalDirectory();
  const box=$("library-message");
  if(box)box.textContent="Die zentrale DBV-Spielersuche ist derzeit nicht erreichbar. Angezeigt werden nur lokal gespeicherte Profile.";
 }
}
async function load(){
 if(!hasCriteria()){showIdle();return;}
 if(rosterDenied){loadIdentityDirectory();return;}
 const ticket=++pending;
 loaded=false;$("library-more").hidden=true;
 error("Die Spielerbibliothek wird aus Supabase geladen …","loading");
 try{
  const {people,total}=await dbPage(0);
  if(ticket!==pending)return;
  entries=people;dbTotal=total;dbMode=true;localMode=false;loaded=true;
  $("library-source").textContent="Supabase · offizieller DBV-Ranglistenbestand";
  if(!associationsLoaded)dbAssociations().catch(e=>console.warn("Vereinsfilter:",e?.message));
  render();
 }catch(e){
  if(ticket!==pending)return;
  // Privacy cutover revoked SELECT on personal rows. Never claim that the
  // deliberately blank static privacy stub is a functional roster backup.
  dbMode=false;
  if(e?.status===401||e?.status===403){rosterDenied=true;await loadIdentityDirectory();return;}
  await loadBackup();
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
 // Do not send member-only Supabase requests before app access is verified.
 if(window.badmintonAppAccess?.allowed)void dbAssociations().catch(()=>{});
 window.addEventListener("badminton:app-access-granted",()=>{
  void dbAssociations().catch(()=>{});
 });
 $("library-age").addEventListener("change",()=>{load()});
 
 
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
  clearTimeout(filterTimer);
  // The visible unified input owns the query. Reset both fields together.
  const search=$("followed-player-search");
  if(search){search.value="";search.dispatchEvent(new Event("input",{bubbles:true}));search.focus({preventScroll:true})}
  else{$("library-search").focus();showIdle()}
  showIdle();
 });
 $("library-reload").addEventListener("click",()=>{summary=null;memory.clear();load();});
 window.addEventListener("hashchange",()=>{if(location.hash==="#spieler"&&hasCriteria()&&!loaded)load();});
 window.addEventListener("badminton:library-following",()=>{if(localMode&&hasCriteria())loadLocalDirectory();else render()});
 // Initial page load deliberately does not fetch the full roster.
});
