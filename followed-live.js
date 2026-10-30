/** Multiple subscribed players, same verified public cache as the existing LIVE radar.
 * Bounded to 6 public DBV IDs. No Badhub browser scraping or tournament-wide claims. */
import {watchRequest} from "./scripts/live-radar.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {followedRoster,followedSnapshotPath,followedCards,shouldReplaceFollowedRequest} from "./scripts/followed-live.mjs";
const $=id=>document.getElementById(id);
let seq=0,controller,busy=false,checked=0,watchTimes=new Map(),lastRows=[],lastRoster=[],lastRowsRosterIds="";
const rosterKey=players=>players.map(p=>p.id).join(",");
const visible=()=>location.hash==="#live"&&window.badmintonMatchdayMode==="all"&&!document.hidden;
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==undefined)e.textContent=String(text);return e};
function render(roster,rows,remaining,error=""){
 const host=$("followed-live-cards"),info=$("followed-live-status");if(!host)return;
 host.replaceChildren();
 if(info)info.textContent=error?"Quelle nicht erreichbar":(roster.length?roster.length+" Spieler":"");
 if(!roster.length){
  host.appendChild(node("p","followed-live-empty","Hinterlege eigene oder gefolgte DBV-Spieler unter „Spieler“."));
  return;
 }
 for(const card of followedCards(roster,rows)){
  const tile=node("article","followed-live-card card-open-surface"+(card.kind==="current"?" followed-live-current":""));
  const head=node("div","followed-live-card-head");
  head.appendChild(node("strong","",card.name));
  const mark=node("span","followed-live-role",card.roleLabel);head.appendChild(mark);
  tile.appendChild(head);
  tile.appendChild(node("b","followed-live-state",card.title));
  if(card.tournament)tile.appendChild(node("small","followed-live-tournament",card.tournament));
  if(card.detail)tile.appendChild(node("span","followed-live-detail",card.detail));
  if(card.score)tile.appendChild(node("strong","followed-live-score","Sätze "+card.score));
  if(card.result)tile.appendChild(node("small","followed-live-result",card.result));
  if(card.checkedAt){
   const date=new Date(card.checkedAt);
   const stamp=Number.isFinite(date.getTime())?new Intl.DateTimeFormat("de-DE",{
    day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"
   }).format(date)+" Uhr":"Zeitpunkt unbekannt";
   tile.appendChild(node("small","followed-live-time","Badhub · Stand "+stamp));
  }
  const actions=node("div","followed-live-actions");
  const detail=node("button","followed-live-detail-button card-open-primary","Meine Spiele ansehen");
  detail.type="button";detail.addEventListener("click",()=>{
   if(window.badmintonSelectViewer?.(card.id,{stayOnPage:true})){
    document.querySelector('[data-matchday-view="mine"]')?.click();
   }
  });
  actions.appendChild(detail);
  const source=node("a","followed-live-source","Badhub ↗");
  source.href=card.sourceUrl;source.target="_blank";source.rel="noopener noreferrer";
  actions.appendChild(source);tile.appendChild(actions);host.appendChild(tile);
 }
 if(remaining)host.appendChild(node("p","followed-live-empty",
  remaining+" weitere Spieler nicht geladen. Der Abgleich ist aus Quellenschutz auf sechs gleichzeitig begrenzt."));
 if(error)host.appendChild(node("p","followed-live-empty",
  "Der letzte gemeinsame Cache wird angezeigt. Neue Angaben sind derzeit nicht verfügbar."));
}
async function registerWatches(roster,signal){
 const now=Date.now();
 const needed=roster.filter(p=>now-(watchTimes.get(p.id)||0)>75000);
 if(!needed.length)return;
 const token=await window.badmintonAppAccess?.getAccessToken?.();
 if(!token)return;
 await Promise.allSettled(needed.map(async p=>{
  watchTimes.set(p.id,now); // even failed requests must not trigger a busy retry loop
  const post=watchRequest(p.id);
  if(!post)return;
  const response=await fetch(post.url,{method:"POST",
   headers:{...post.headers,Authorization:"Bearer "+token},body:post.body,signal});
  if(!response.ok&&response.status!==409&&response.status!==400)
   console.warn("Player LIVE subscription rejected",response.status);
 }));
}
async function refresh(){
 if(!visible())return;
 const options=window.badmintonLiveViewerOptions?.()||{};
 const {players,remaining}=followedRoster(options);
 const ids=rosterKey(players);
 // A profile/follow change must supersede an in-flight request, not wait for
 // its previous roster to render. Repeated events for the same roster coalesce.
 if(!shouldReplaceFollowedRequest(busy,rosterKey(lastRoster),ids))return;
 const request=++seq;
 controller?.abort();controller=new AbortController();busy=true;
 lastRoster=players;
 if(!players.length){
  lastRows=[];lastRowsRosterIds="";checked=0;busy=false;
  render([],[],0);return;
 }
 const signal=controller.signal;
 try{
  await registerWatches(players,signal);
  if(request!==seq||signal.aborted||!visible())return;
  const {rows}=await readPublicRows(followedSnapshotPath(players),{signal,count:false,timeoutMs:9000});
  if(request!==seq||signal.aborted||!visible())return;
  lastRows=rows;lastRowsRosterIds=ids;checked=Date.now();
  render(players,rows,remaining);
 }catch(error){
  if(signal.aborted||request!==seq)return;
  render(players,ids===lastRowsRosterIds?lastRows:[],remaining,
   "Quellenaktualisierung fehlgeschlagen");
 }finally{if(request===seq)busy=false}
}
function sync(){
 if(!visible()){seq++;controller?.abort();busy=false;return}
 const p=followedRoster(window.badmintonLiveViewerOptions?.()||{});
 // The invitation/session check may finish after DOMContentLoaded on iOS.
 // Never mark a watch as requested before the member token exists.
 if(!window.badmintonAppAccess?.allowed){
  seq++;controller?.abort();busy=false;checked=0;
  lastRows=[];lastRowsRosterIds="";lastRoster=[];
  render(p.players,[],p.remaining);
  return;
 }
 const ids=rosterKey(p.players);
 if(ids!==rosterKey(lastRoster)||ids!==lastRowsRosterIds||!checked||Date.now()-checked>30000)refresh();
 else render(p.players,lastRows,p.remaining);
}
document.addEventListener("DOMContentLoaded",()=>{
 if(!$("followed-live-cards"))return;
 window.addEventListener("badminton:app-access-granted",sync);
 window.addEventListener("badminton:matchday-mode",sync);
 window.addEventListener("badminton:profile-change",sync);
 window.addEventListener("hashchange",sync);
 document.addEventListener("visibilitychange",sync);
 window.addEventListener("badminton:followed-live-refresh",()=>{checked=0;sync()});
 setInterval(()=>{if(visible())sync()},30000);
 sync();
});
