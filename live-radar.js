/** The radar reads only a central, source-checked Supabase snapshot.
 * It never fetches Badhub directly from browsers and never guesses live scores. */
import {
 DBV_ID,watchRequest,snapshotPath,liveView,
 radarSituation,validSource,setText,opponents,matchLabel,playerOutcome,sourceTime
} from "./scripts/live-radar.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
const $=id=>document.getElementById(id);
const root=()=> $("live-radar-content");
let currentId="",generation=0,controller,lastWatchAt=0,lastKnownRow=null;
let busy=false,timer;
const displayed=()=>location.hash==="#turniere"&&!document.hidden;
function element(tag,cls,value){
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(value!==undefined)e.textContent=String(value);
 return e;
}
function reset(){const box=root();if(box)box.replaceChildren();}
function line(title,detail=""){
 const p=element("div","radar-line");
 p.appendChild(element("strong","",title));
 if(detail)p.appendChild(element("span","",detail));
 return p;
}
function message(title,text,kind="idle"){
 reset();
 const box=root();if(!box)return;
 box.dataset.state=kind;
 box.appendChild(line(title,text));
}
function tag(text,variant){
 return element("span","radar-tag "+variant,text);
}
function fixture(match,{running=false,past=false}={}){
 const card=element("article","radar-match");
 const head=element("div","radar-match-head");
 head.appendChild(element("strong","",matchLabel(match)));
 if(past){
  const result=playerOutcome(match);
  if(result)head.appendChild(tag(result==="win"?"Sieg":"Niederlage",result));
 } else if(running)head.appendChild(tag(setText(match)?"Läuft":"Aufgerufen",setText(match)?"live":"called"));
 card.appendChild(head);
 const enemy=opponents(match);
 if(enemy)card.appendChild(element("p","radar-opponent","Gegen "+enemy));
 const meta=[];
 if(match.hall)meta.push("Halle "+String(match.hall).slice(0,30));
 if(match.court)meta.push(String(match.court).slice(0,40));
 const score=setText(match);
 if(score)meta.push("Sätze "+score);
 if(!running){
  const forecast=sourceTime(match.predicted_start_ts);
  const planned=sourceTime(match.planned_ts);
  if(forecast)meta.push("vorauss. "+forecast);
  else if(planned)meta.push("angesetzt "+planned);
 }
 if(meta.length)card.appendChild(element("p","radar-match-detail",meta.join(" · ")));
 return card;
}
function matchList(label,items,params){
 if(!items?.length)return null;
 const section=element("section","radar-section");
 section.appendChild(element("h4","",label));
 for(const m of items.slice(0,8))section.appendChild(fixture(m,params));
 return section;
}
function sourceShortcut(row,id){
 const url=row?.source_url||("https://badhub.de/spieler/"+id+"/live");
 if(!validSource(url,id))return null;
 const link=element("a","radar-source-link","Bei Badhub prüfen ↗");
 link.href=url;
 link.target="_blank";
 link.rel="noopener noreferrer";
 return link;
}
function render(row,id){
 reset();const box=root();if(!box)return;
 const situation=radarSituation(row,id);
 box.dataset.state=situation.kind;
 // Source freshness is supporting metadata, never the main status message.
 const top=element("div","radar-summary");
 if(situation.checkedAt){
  const t=new Date(situation.checkedAt);
  const printed=t.toLocaleString("de-DE",{
   day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"
  });
  top.appendChild(element("span","radar-source","Badhub · zuletzt geprüft "+printed+" Uhr"));
 }
 if(situation.kind!=="current"){
  top.appendChild(element("strong","radar-empty",situation.title));
  top.appendChild(element("p","",situation.detail));
  box.appendChild(top);
  const shortcut=sourceShortcut(row,id);
  if(situation.kind==="updating"&&situation.tournament){
   box.appendChild(line("Bekanntes Turnier",situation.tournament));
  }
  if(shortcut)box.appendChild(shortcut);
  return;
 }
 const view=liveView(row,id);
 top.appendChild(element("strong","radar-tournament",view.tournament||"Aktuelles Turnier"));
 if(view.status==="playing")top.appendChild(tag(setText(view.running)?"Live-Stand":"Spiel aufgerufen",setText(view.running)?"live":"called"));
 if(view.status==="next"&&!view.running)top.appendChild(tag("Als Nächstes","next"));
 box.appendChild(top);
 if(view.running){
  const block=matchList("Aktuelle Begegnung",[view.running],{running:true});
  if(block)box.appendChild(block);
 }
 if(view.next&&Number.isInteger(view.next.queue_position)){
  const n=Number(view.next.queue_position);
  box.appendChild(line("Wartestand",n===0?"Als Nächstes":n===1?"Noch 1 Spiel vorher":"Noch "+Math.min(99,n)+" Spiele vorher"));
 }
 const upcoming=matchList("Kommende Spiele",view.upcoming);
 if(upcoming)box.appendChild(upcoming);
 const past=matchList("Heute gespielt",view.past,{past:true});
 if(past)box.appendChild(past);
 if(!view.running&&!view.next&&!view.upcoming?.length&&!view.past?.length){
  box.appendChild(line("Turnier zugeordnet","Aktuell sind keine Einzelbegegnungen veröffentlicht."));
 }
}
async function getSnapshot(id,signal){
 const {rows}=await readPublicRows(snapshotPath(id),{signal,count:false});
 return rows[0]||null;
}
async function watch(id,signal){
 const post=watchRequest(id);
 if(!post)return;
 const res=await fetch(post.url,{method:"POST",headers:post.headers,body:post.body,signal});
 if(!res.ok)throw Error("Watch request "+res.status);
 lastWatchAt=Date.now();
}
async function refresh(){
 const id=currentId;
 if(!displayed()||!DBV_ID.test(id||"")||busy)return;
 const seq=++generation;
 busy=true;
 controller?.abort();
 controller=new AbortController();
 const signal=controller.signal;
 const btn=$("live-radar-refresh");if(btn)btn.disabled=true;
 try{
  if(!lastWatchAt||Date.now()-lastWatchAt>60000)await watch(id,signal);
  if(seq!==generation||id!==currentId)return;
  const snapshot=await getSnapshot(id,signal);
  if(seq!==generation||id!==currentId)return;
  lastKnownRow=snapshot;
  render(snapshot,id);
 }catch(error){
  if(signal.aborted||seq!==generation)return;
  console.warn("Sourced live radar unavailable",error.message);
  if(lastKnownRow&&id===currentId)render(lastKnownRow,id);
  else{
   message("Turnierdaten gerade nicht verfügbar",
    "Die Quellenprüfung wird automatisch erneut versucht.","waiting");
   const shortcut=sourceShortcut(null,id);
   if(shortcut)root()?.appendChild(shortcut);
  }
 }finally{
  if(seq===generation){busy=false;if(btn)btn.disabled=false;}
 }
}
function switchPlayer(id){
 currentId=id||"";generation++;controller?.abort();busy=false;lastWatchAt=0;lastKnownRow=null;
 if(!DBV_ID.test(currentId)){
  message("Keine offizielle DBV-ID","Wähle ein bestätigtes Spielerprofil mit DBV-ID.");
  return;
 }
 message("Live-Radar wird vorbereitet","Der gemeinsame Quellenabruf startet nur bei geöffneter Turnieransicht.");
 if(displayed())refresh();
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!root())return;
 currentId=String(window.badmintonActivePlayerId||"");
 $("live-radar-refresh")?.addEventListener("click",refresh);
 window.addEventListener("badminton:profile-change",e=>{
  const id=String(e.detail?.playerId||"");
  if(id!==currentId)switchPlayer(id);
 });
 window.addEventListener("hashchange",()=>{if(displayed())refresh()});
 document.addEventListener("visibilitychange",()=>{if(displayed())refresh()});
 if(displayed())refresh();
 timer=setInterval(()=>{if(displayed())refresh()},30000);
});
