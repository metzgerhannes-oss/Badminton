/** Badhub event results: manually verified event URL, server-side scoped feed only.
 * No provider scraping from the PWA and no official result-table writes. */
import {SOURCE_KEY,parseBadhubLink,queryEvent,validateEventResult,renderSummary} from "./scripts/badhub-event.mjs";
const $=id=>document.getElementById(id);
const present=()=>!document.hidden&&Boolean($("badhub-event-panel")?.open)&&(location.hash==="#turniere"||
 (location.hash==="#live"&&window.badmintonMatchdayMode==="all"));
const root=()=> $("badhub-event-results");
let sequence=0,abort=null,busy=false,loadedAt=0,activeKey="",eventUrl="",discipline="",sourceInfo=null;
const elem=(tag,css,text)=>{
 const node=document.createElement(tag);if(css)node.className=css;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
function mapping(){
 try{const data=JSON.parse(localStorage.getItem(SOURCE_KEY)||"{}");
  return data&&typeof data==="object"&&!Array.isArray(data)?data:{}}
 catch{return {}}
}
function save(key,url){
 try{const map=mapping();if(url)map[key]=url;else delete map[key];
  const entries=Object.entries(map).slice(-40);
  localStorage.setItem(SOURCE_KEY,JSON.stringify(Object.fromEntries(entries)));}
 catch{}
}
function selectedKey(){
 const value=String($("tournament-live-select")?.value||"");
 return /^[0-9a-f-]{36}$/i.test(value)?value:null;
}
function paintNote(text){
 root()?.replaceChildren(elem("p","badhub-event-empty",text));
}
function viewLink(url){
 const a=$("badhub-event-source");if(!a)return;
 a.hidden=!url;
 if(url)a.href=url;else a.removeAttribute("href");
}
function paint(data){
 sourceInfo=data;
 const results=root();if(!results)return;
 results.replaceChildren();
 const info=$("badhub-event-count");
 if(info)info.textContent=renderSummary(data);
 const note=$("badhub-event-note");
 if(note)note.textContent="Badhub · veröffentlichte Ergebnisse der ausgewählten Disziplin. Kein offizieller DBV-Livefeed; keine verifizierten Match-IDs oder minutengenaue Spielstände.";
 if(!data?.matches.length){
  paintNote("In dieser Disziplin sind derzeit keine einzelnen Begegnungen veröffentlicht.");
  return;
 }
 for(const item of data.matches){
  const card=elem("article","badhub-match-card");
  const header=elem("div","badhub-match-header");
  header.appendChild(elem("strong","",item.round||item.discipline||"Begegnung"));
  header.appendChild(elem("span","",item.category==="finished"?"Ergebnis":"Stand offen"));
  card.appendChild(header);
  const sides=elem("div","badhub-match-sides");
  const home=elem("span",item.winner==="home"?"badhub-winner":"",item.home||"Noch offen");
  const away=elem("span",item.winner==="guest"?"badhub-winner":"",item.away||"Noch offen");
  sides.appendChild(home);sides.appendChild(elem("b","","–"));sides.appendChild(away);
  card.appendChild(sides);
  if(item.sets.length)card.appendChild(elem("strong","badhub-match-score",item.sets.join(" · ")));
  results.appendChild(card);
 }
}
async function load(){
 if(!present()||!eventUrl||busy)return;
 const request=++sequence;busy=true;abort?.abort();abort=new AbortController();
 const signal=abort.signal;
 const button=$("badhub-event-refresh");if(button)button.disabled=true;
 const label=$("badhub-event-count");if(label)label.textContent="Veröffentlichte Ergebnisse werden abgeglichen …";
 try{
  const url=queryEvent(eventUrl,discipline);if(!url)throw Error("invalid");
  const localAbort=abort;const timer=setTimeout(()=>localAbort.abort(),12500);let resp;
  try{resp=await fetch(url,{method:"GET",headers:{Accept:"application/json"},cache:"no-store",signal})}
  finally{clearTimeout(timer)}
  if(!resp.ok)throw Error("HTTP "+resp.status);
  const raw=await resp.json();
  const data=validateEventResult(raw,eventUrl,discipline);
  if(!data)throw Error("Invalid source identity or match model");
  if(signal.aborted||request!==sequence||!present())return;
  const menu=$("badhub-event-discipline");
  if(menu){
   const options=data.disciplines.filter(x=>!["winner","player"].includes(x.toLowerCase())).slice(0,32);
   menu.replaceChildren();
   for(const value of options){
    const o=document.createElement("option");o.value=value;o.textContent=value;menu.appendChild(o);
   }
   menu.disabled=options.length===0;
   if(!discipline&&options.length){discipline=options[0];menu.value=discipline;loadedAt=0;busy=false;return load()}
   if(discipline&&options.includes(discipline))menu.value=discipline;
  }
  loadedAt=Date.now();paint(data);viewLink(data.sourceUrl);
 }catch(e){
  if(signal.aborted||request!==sequence)return;
  if(label)label.textContent="Badhub-Abgleich nicht erreichbar";
  paintNote("Der verifizierte Turnierdatendienst ist derzeit nicht verfügbar. Den Originallink kannst du weiterhin öffnen.");
  console.warn("Event source:",String(e).slice(0,90));
 }finally{
  if(request===sequence){busy=false;if(button)button.disabled=false}
 }
}
function sync(){
 if(!present())return;
 const key=selectedKey();
 if(!key){
  paintNote("Wähle zuerst oben ein gespeichertes DBV-Turnier aus.");
  return;
 }
 if(key!==activeKey){
  activeKey=key;eventUrl=parseBadhubLink(mapping()[key])||"";
  discipline="";loadedAt=0;sequence++;abort?.abort();busy=false;
  const input=$("badhub-event-url");if(input)input.value=eventUrl;
  viewLink(eventUrl);
  const controls=$("badhub-event-controls");if(controls)controls.hidden=!eventUrl;
  const sourceLine=$("badhub-event-source-line");if(sourceLine)sourceLine.hidden=!eventUrl;
  const menu=$("badhub-event-discipline");
  if(menu){menu.replaceChildren();menu.disabled=true}
  if(!eventUrl){
   const label=$("badhub-event-count");if(label)label.textContent="";
   paintNote("Für dieses DBV-Turnier ist noch keine eindeutig zugeordnete Badhub-Quelle bekannt. Der offizielle DBV-Spielplan ist oben direkt verlinkt.");
  }
 }
 if(eventUrl&&(!loadedAt||Date.now()-loadedAt>300000))load();
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!root())return;
 $("badhub-event-form")?.addEventListener("submit",e=>{
  e.preventDefault();const input=$("badhub-event-url");
  const url=parseBadhubLink(input?.value);
  if(!url){input?.setCustomValidity("Bitte einen Badhub-Turnierlink wie https://badhub.de/bvbb/turnier.php?id=4962 eingeben.");
   input?.reportValidity();return}
  const key=selectedKey();
  if(!key){input.setCustomValidity("Bitte zuerst oben ein DBV-Turnier auswählen.");input.reportValidity();return}
  input.setCustomValidity("");activeKey=key;eventUrl=url;discipline="";
  loadedAt=0;sequence++;abort?.abort();busy=false;save(activeKey,url);viewLink(url);
  $("badhub-event-discipline")?.replaceChildren();
  const controls=$("badhub-event-controls");if(controls)controls.hidden=false;
  const sourceLine=$("badhub-event-source-line");if(sourceLine)sourceLine.hidden=false;
  const manual=$("badhub-event-manual");if(manual)manual.open=false;
  load();
 });
 $("badhub-event-url")?.addEventListener("input",e=>e.currentTarget.setCustomValidity(""));
 $("badhub-event-discipline")?.addEventListener("change",e=>{
  discipline=e.currentTarget.value;loadedAt=0;load();
 });
 $("badhub-event-refresh")?.addEventListener("click",()=>{loadedAt=0;load()});
 $("tournament-live-select")?.addEventListener("change",sync);
 $("badhub-event-panel")?.addEventListener("toggle",()=>{
  if(present())sync();else{sequence++;abort?.abort();busy=false}
 });
 window.addEventListener("badminton:matchday-mode",()=>{if(present())sync();else{sequence++;abort?.abort();busy=false}});
 window.addEventListener("hashchange",()=>{if(present())sync();else{sequence++;abort?.abort();busy=false}});
 document.addEventListener("visibilitychange",()=>{if(present())sync();else{sequence++;abort?.abort();busy=false}});
 window.addEventListener("badminton:tournament-bookmarks",sync);
 setInterval(()=>{if(present())sync()},60000);
 sync();
});
