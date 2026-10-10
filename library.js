/** Shared DBV player directory, generated weekly from the official published Excel. */
import {selectPlayers,clubGroups,normalizeText,sortClubs} from "./scripts/library-utils.mjs";

const ROOT="./data/player-library/";
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
function filtered(){
 return selectPlayers(entries,{
  query:$("library-search")?.value||"",
  club:$("library-club")?.value||"",
  association:$("library-association")?.value||"all"
 });
}
function updateClubSuggestions(){
 const list=$("library-club-suggestions");if(!list)return;
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
 const own=new Set(localSelection().own),following=new Set(localSelection().following);
 const people=filtered(),count=$("library-count"),area=$("library-results");
 const shown=people.slice(0,visible);
 if(count)count.textContent=people.length.toLocaleString("de-DE")+" Spieler · "+new Set(people.map(x=>x.club).filter(Boolean)).size.toLocaleString("de-DE")+" Vereine";
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
 $("library-more").hidden=people.length<=visible;
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
async function load(){
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
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("library-results"))return;
 $("library-age").addEventListener("change",load);
 for(const id of ["library-search","library-club"]){
  $(id).addEventListener("input",()=>{visible=40;if(id==="library-club")updateClubSuggestions();render();});
 }
 $("library-association").addEventListener("change",()=>{visible=40;render();});
 $("library-more").addEventListener("click",()=>{visible+=40;render();});
 $("library-reload").addEventListener("click",()=>{summary=null;memory.clear();load();});
 window.addEventListener("hashchange",()=>{if(location.hash==="#spieler"&&!loaded)load();});
 window.addEventListener("badminton:library-following",()=>render());
 if(location.hash==="#spieler")load();
});
