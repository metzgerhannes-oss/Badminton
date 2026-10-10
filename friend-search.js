/** Friend picker: read-only DBV name search; follows stay on this device. */
import {friendSearchUrl,normalizeFriendSearch,asFriendCandidate,classifyFriendCandidate,SEARCH_LIMIT} from "./scripts/friend-search.mjs";

const APIKEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const normalize=v=>String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de");
let timer,controller,sequence=0,found=[],source="",lastTerm="";
let backupPromise;
function localState(){
 return window.badmintonLibraryGetState?.()||{own:[],following:[]};
}
function showMessage(message){
 const el=$("friend-search-status");
 if(el)el.textContent=message;
}
function render(){
 const root=$("friend-search-results");
 if(!root)return;
 const own=localState();
 root.innerHTML=found.map(candidate=>{
  const state=classifyFriendCandidate(candidate,own);
  const status=state==="own"?"Eigenes Profil":state==="following"?"Bereits gefolgt":"+ Folgen";
  return '<article class="friend-search-hit">'+
   '<span class="friend-search-avatar" aria-hidden="true">'+esc(candidate.name.trim().charAt(0).toUpperCase())+'</span>'+
   '<span class="friend-search-person"><strong>'+esc(candidate.name)+'</strong>'+
    '<small>'+esc(candidate.club||"Verein nicht angegeben")+
      (candidate.ageClass?" · "+esc(candidate.ageClass):"")+
      (candidate.birthYear?" · Jg. "+esc(candidate.birthYear):"")+'</small>'+
    '<small>DBV '+esc(candidate.id)+'</small></span>'+
   '<button type="button" data-friend-follow="'+esc(candidate.id)+'"'+(state!=="available"?' disabled':'')+
    ' aria-label="'+esc(candidate.name)+': '+esc(status)+'">'+esc(status)+'</button></article>';
 }).join("");
 root.querySelectorAll("[data-friend-follow]").forEach(button=>button.addEventListener("click",()=>{
  const candidate=found.find(x=>x.id===button.dataset.friendFollow);
  if(!candidate||classifyFriendCandidate(candidate,localState())!=="available")return;
  const result=window.badmintonLibraryToggleFollow?.(candidate);
  if(result?.ok)showMessage(candidate.name+" wurde zu deinen Freunden hinzugefügt.");
  else if(result?.message)showMessage(result.message);
  else showMessage("Das Hinzufügen ist derzeit nicht möglich.");
  render();
 }));
}
async function backupAll(){
 if(!backupPromise){
  backupPromise=(async()=>{
   const index=await fetch("./data/player-library/index.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Index nicht erreichbar");return r.json()});
   if(index.schemaVersion!==1||!Array.isArray(index.ageGroups))throw Error("Index ungültig");
   const pages=await Promise.all(index.ageGroups.map(async group=>{
    const age=String(group.age||"");
    if(!/^U(?:11|13|15|17|19|22)$/.test(age))return [];
    const r=await fetch("./data/player-library/"+age+".json",{cache:"no-store"});
    if(!r.ok)throw Error("Backup fehlt");
    const data=await r.json();
    return Array.isArray(data.players)?data.players:[];
   }));
   const dedupe=new Map();
   for(const entry of pages.flat()){
    const candidate=asFriendCandidate(entry);
    if(candidate)dedupe.set(candidate.id,candidate);
   }
   return [...dedupe.values()];
  })().catch(error=>{backupPromise=null;throw error});
 }
 return backupPromise;
}
async function runSearch(text){
 const term=normalizeFriendSearch(text);
 const current=++sequence;
 controller?.abort();
 controller=new AbortController();
 const query=friendSearchUrl(term);
 lastTerm=term;
 if(!query){
  found=[];source="";render();
  showMessage("Bitte mindestens zwei Zeichen eingeben.");return;
 }
 showMessage("Suche im offiziellen DBV-Spielerverzeichnis …");
 found=[];render();
 try{
  const response=await fetch(query,{signal:controller.signal,cache:"no-store",headers:{apikey:APIKEY,accept:"application/json"}});
  if(!response.ok)throw Error("Supabase HTTP "+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error("Ungültige Suchantwort");
  if(current!==sequence)return;
  const dedupe=new Map();
  for(const entry of rows){const candidate=asFriendCandidate(entry);if(candidate)dedupe.set(candidate.id,candidate)}
  found=[...dedupe.values()];
  source="supabase";
 }catch(error){
  if(current!==sequence||error?.name==="AbortError")return;
  try{
   const available=await backupAll();
   if(current!==sequence)return;
   const needle=normalize(term);
   found=available.filter(p=>normalize(p.name).includes(needle)||p.id.includes(term)).slice(0,SEARCH_LIMIT);
   source="backup";
  }catch{
   if(current!==sequence)return;
   showMessage("Suche derzeit nicht erreichbar. Bitte Internetverbindung prüfen oder den Freund manuell per DBV-ID hinzufügen.");
   return;
  }
 }
 if(current!==sequence)return;
 render();
 if(!found.length){
  showMessage("Keinen Spieler gefunden. Suche nach dem vollständigen Namen oder verwende die manuelle DBV-ID.");
 }else{
  showMessage(found.length+" Treffer"+(found.length===SEARCH_LIMIT?" (maximal 30 sichtbar; Namen genauer eingeben)":"")+
   (source==="backup"?" · GitHub-Ausfallsicherung":"")+" · mit „+ Folgen“ hinzufügen.");
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 const input=$("friend-search");
 if(!input)return;
 input.addEventListener("input",()=>{
  clearTimeout(timer);
  const value=normalizeFriendSearch(input.value);
  if(value.length<2){++sequence;controller?.abort();found=[];render();showMessage("Bitte mindestens zwei Zeichen eingeben.");return}
  showMessage("Suche wird vorbereitet …");
  timer=setTimeout(()=>runSearch(input.value),300);
 });
 input.addEventListener("search",()=>{clearTimeout(timer);runSearch(input.value)});
 window.addEventListener("badminton:friends-changed",render);
});
