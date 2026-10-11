/** Read-only full-event view of verified, explicitly imported DBV matches.
 * No invented tournament results and no client-side scraping of provider pages. */
import {eventId,tournamentPath,matchesPath,matchTournament,tournamentOverview,
 filterTournament,tournamentCounts} from "./scripts/tournament-live.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
const $=id=>document.getElementById(id);
const root=()=> $("tournament-live-content");
let selected="",status="all",court="all",items=[],controller=null,serial=0,loadedAt=0;
const visible=()=>location.hash==="#live"&&window.badmintonMatchdayMode==="all"&&!document.hidden;
function node(tag,cls,value){
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==undefined)n.textContent=String(value);return n;
}
function note(title,body){
 const box=root();if(!box)return;box.replaceChildren();
 const wrap=node("div","event-empty");wrap.appendChild(node("strong","",title));
 if(body)wrap.appendChild(node("p","",body));box.appendChild(wrap);
}
function choose(){
 const input=$("tournament-live-select");if(!input)return false;
 const previous=selected;
 const options=(window.badmintonTournamentOptions?.()||[])
  .filter(x=>eventId(x.url)).slice(0,40);
 input.replaceChildren();
 if(!options.length){
  const o=document.createElement("option");o.value="";o.textContent="Noch kein Turnier gespeichert";
  input.appendChild(o);input.disabled=true;selected="";
 }else{
  input.disabled=false;
  for(const t of options){
   const o=document.createElement("option");o.value=t.id;o.textContent=t.name;
   input.appendChild(o);
  }
  if(!options.some(t=>t.id===selected))selected=options[0].id;
  input.value=selected;
 }
 const sourceHost=$("live-tournament-links");
 if(sourceHost){
  sourceHost.replaceChildren();
  const chosen=options.find(x=>x.id===selected);
  const sourceId=eventId(chosen?.url);
  if(sourceId){
   const link=node("a","matchday-event-link","Original-Spielplan bei DBV öffnen ↗");
   link.href="https://dbv.turnier.de/tournament/"+sourceId;
   link.target="_blank";link.rel="noopener noreferrer";
   sourceHost.appendChild(link);
  }else{
   const link=node("a","matchday-event-link","Turnier unter „Turniere“ speichern ↗");
   link.href="#turniere";sourceHost.appendChild(link);
  }
 }
 return previous!==selected;
}
function courtFilter(){
 const input=$("tournament-court-filter");if(!input)return;
 const names=[...new Set(items.map(x=>x.court).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
 input.replaceChildren();
 const o=document.createElement("option");o.value="all";o.textContent="Alle Felder";
 input.appendChild(o);
 for(const name of names){
  const opt=document.createElement("option");opt.value=name;opt.textContent="Feld "+name;
  input.appendChild(opt);
 }
 if(!names.includes(court))court="all";
 input.value=court;
 input.hidden=names.length===0;
 input.parentElement.hidden=names.length===0;
}
function time(value){
 if(!value)return "Spielzeit offen";
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return "Spielzeit offen";
 return new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(date)+" Uhr";
}
function render(){
 const host=root();if(!host)return;
 host.replaceChildren();
 const totals=tournamentCounts(items);
 const counter=$("tournament-live-count");
 if(counter){
  counter.hidden=items.length===0;
  counter.textContent=items.length?totals.total+" belegte Spiele · "+totals.live+" live · "+
   totals.upcoming+" offen · "+totals.finished+" gespielt":"";
 }
 const filters=$("tournament-live-filters");if(filters)filters.hidden=items.length===0;
 courtFilter();
 for(const tab of document.querySelectorAll("[data-tournament-status]")){
  tab.setAttribute("aria-pressed",String(tab.dataset.tournamentStatus===status));
  const count=tab.querySelector("small");
  if(count){const n=status===tab.dataset.tournamentStatus?items.length:
   totals[tab.dataset.tournamentStatus];count.textContent=n===undefined?"":String(n);}
 }
 const shown=filterTournament(items,{status,court});
 if(!items.length){
  note("Noch keine Begegnungen importiert",
   "Der offizielle Spielplan ist über die Schaltfläche oben erreichbar. Hier erscheinen nur bestätigte, bereits importierte Spiele.");
  return;
 }
 if(!shown.length){note("Keine Spiele in diesem Filter","Probiere eine andere Kategorie oder ein anderes Feld.");return}
 for(const m of shown){
  const card=node("article","event-match-card event-status-"+m.category);
  const top=node("div","event-match-top");
  top.appendChild(node("strong","",m.discipline));
  const label=node("span","event-match-status",m.label);
  top.appendChild(label);card.appendChild(top);
  const players=node("div","event-match-players");
  players.appendChild(node("span","",m.side1));
  players.appendChild(node("span","event-versus","–"));
  players.appendChild(node("span","",m.side2));card.appendChild(players);
  const detail=node("div","event-match-meta");
  if(m.court)detail.appendChild(node("span","","Feld "+m.court));
  detail.appendChild(node("span","",time(m.scheduledAt)));
  if(m.sets.length)detail.appendChild(node("strong","",m.sets.join(" · ")));
  card.appendChild(detail);
  if(m.category==="live"&&!m.sourceFresh)
   card.appendChild(node("small","event-match-caveat","Letzter Abgleich nicht aktuell – kein Live-Spielstand"));
  if(m.checkedAt){
   const checked=node("small","event-match-caveat","Quellenstand: "+
    new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(new Date(m.checkedAt))+" Uhr");
   card.appendChild(checked);
  }
  host.appendChild(card);
 }
}
async function refresh(){
 if(!selected||!visible())return;
 const options=window.badmintonTournamentOptions?.()||[];
 const chosen=options.find(x=>x.id===selected);
 const id=eventId(chosen?.url);
 if(!id)return;
 const request=++serial;
 controller?.abort();controller=new AbortController();
 const signal=controller.signal;
 const btn=$("tournament-live-refresh");if(btn)btn.disabled=true;
 note("Turnier-Spielplan wird geprüft","Es werden ausschließlich bereits bestätigte Matchdaten gelesen.");
 try{
  const {rows:events}=await readPublicRows(tournamentPath(id),{signal,count:false});
  if(signal.aborted||request!==serial)return;
  const tournament=matchTournament(events,chosen);
  if(!tournament){items=[];loadedAt=Date.now();render();return}
  const {rows}=await readPublicRows(matchesPath(tournament.id),{signal,count:false,timeoutMs:9000});
  if(signal.aborted||request!==serial)return;
  items=tournamentOverview(rows,tournament.id);
  loadedAt=Date.now();render();
 }catch(error){
  if(signal.aborted||request!==serial)return;
  items=[];loadedAt=Date.now();
  note("Turnierdaten derzeit nicht verfügbar",
   "Der geprüfte Datenbestand lässt sich gerade nicht abrufen. Der offizielle Turnierlink bleibt darunter erreichbar.");
 }finally{if(request===serial&&btn)btn.disabled=false}
}
function sync(){
 const changed=choose();
 if(!selected){items=[];note("Turnier auswählen","Speichere einen offiziellen DBV-Turnierlink unter „Turniere“, um hier den geprüften Spielplan einzublenden.");return}
 if(!visible())return;
 if(changed){items=[];status="all";court="all";loadedAt=0}
 if(changed||!loadedAt||Date.now()-loadedAt>60000)refresh();
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!root())return;
 $("tournament-live-select")?.addEventListener("change",e=>{
  selected=e.currentTarget.value;items=[];status="all";court="all";loadedAt=0;refresh();
 });
 $("tournament-live-refresh")?.addEventListener("click",()=>{
  window.dispatchEvent(new Event("badminton:followed-live-refresh"));
  refresh();
 });
 $("tournament-court-filter")?.addEventListener("change",e=>{court=e.currentTarget.value;render()});
 document.querySelectorAll("[data-tournament-status]").forEach(button=>button.addEventListener("click",()=>{
  status=button.dataset.tournamentStatus;render();
 }));
 window.addEventListener("badminton:tournament-bookmarks",sync);
 window.addEventListener("badminton:matchday-mode",()=>{
  if(visible())sync();
  else{serial++;controller?.abort()}
 });
 window.addEventListener("hashchange",()=>{if(visible())sync();else{++serial;controller?.abort()}});
 document.addEventListener("visibilitychange",()=>{if(visible())sync();else{++serial;controller?.abort()}});
 setInterval(()=>{if(visible()&&selected&&Date.now()-loadedAt>60000)refresh()},60000);
 sync();
});
