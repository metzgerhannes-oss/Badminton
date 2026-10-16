/** Targeted, read-only official DBV identity lookup for device-local own profiles. */
import {searchDbvIdentities,validDbvLookup} from "./scripts/targeted-player-search.mjs";
const el=id=>document.getElementById(id);
let debounce,request,serial=0;
function stop(){
 clearTimeout(debounce);
 request?.abort();
 request=null;
 serial++;
}
function status(text){if(el("own-player-search-status"))el("own-player-search-status").textContent=text;}
function render(found){
 const host=el("own-player-search-results");if(!host)return;
 host.replaceChildren();
 const selected=window.badmintonLibraryGetState?.()||{own:[],following:[]};
 const own=new Set(selected.own),friends=new Set(selected.following);
 for(const person of found){
  const row=document.createElement("div");row.className="own-player-result";
  const label=document.createElement("div");label.className="own-player-result-label";
  const name=document.createElement("strong");name.textContent=person.name;
  const meta=document.createElement("small");
  meta.textContent="DBV "+person.id+" · "+(person.club||"Verein unbekannt")+
   (person.birthYear?" · Jg. "+person.birthYear:"");
  label.append(name,meta);
  const button=document.createElement("button");button.type="button";button.className="outline-button";
  button.textContent=own.has(person.id)?"Bereits gespeichert":friends.has(person.id)?"Als eigenes Profil":"+ Profil hinzufügen";
  button.disabled=own.has(person.id);
  button.setAttribute("aria-label",person.name+": "+button.textContent);
  button.addEventListener("click",()=>window.dispatchEvent(
   new CustomEvent("badminton:own-profile-selected",{detail:person})
  ));
  row.append(label,button);host.append(row);
 }
}
async function run(raw){
 const ticket=++serial;
 request?.abort();request=new AbortController();
 const term=validDbvLookup(raw);
 if(!term){render([]);status("Bitte mindestens drei Zeichen eingeben.");return}
 render([]);status("Suche im DBV-Spielerverzeichnis …");
 try{
  const found=await searchDbvIdentities(term,{signal:request.signal});
  if(ticket!==serial||!el("player-dialog")?.open)return;
  render(found);
  status(found.length?found.length+" Treffer · Spieler auswählen und hinzufügen."
   :"Keine Treffer. Anderen Namen oder die DBV-ID versuchen.");
 }catch(error){
  if(ticket!==serial||error?.name==="AbortError")return;
  render([]);status("DBV-Suche aktuell nicht erreichbar. Manuelle Eingabe bleibt möglich.");
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 const input=el("own-player-search"),panel=el("own-profile-lookup");
 const manual=el("own-player-manual");
 if(!input||!panel||!manual)return;
 input.addEventListener("input",()=>{
  stop();render([]);
  if(!validDbvLookup(input.value)){status("Mindestens drei Zeichen eingeben.");return}
  status("Suche wird vorbereitet …");
  debounce=setTimeout(()=>run(input.value),300);
 });
 input.addEventListener("keydown",event=>{
  if(event.key!=="Enter")return;
  event.preventDefault();stop();run(input.value);
 });
 window.addEventListener("badminton:own-profile-dialog",event=>{
  stop();input.value="";render([]);
  const editing=event.detail?.editing===true;
  panel.hidden=editing;manual.open=editing;
  manual.querySelector("summary").textContent=editing?"Spielerangaben bearbeiten":"Spieler ohne Suche manuell hinzufügen";
  status("Mindestens drei Zeichen eingeben.");
  if(!editing)requestAnimationFrame(()=>{if(el("player-dialog")?.open)input.focus({preventScroll:true})});
 });
 el("player-dialog")?.addEventListener("close",()=>{stop();render([])});
});
