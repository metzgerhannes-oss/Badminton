/** #298 Paket C: read-only, demand-driven 'Heute im Einsatz' for Home and Turniertag.
 * No timer, provider watcher, new team directory read, personal upload or server write.
 * Every claimed match/live state is derived by today-evidence.mjs.
 */
import {todayEvidence,followedTeamSelection,fixtureReadPath,berlinDay,hasVerifiedMatchToday,TEAM_FOLLOWS_KEY}
 from "./scripts/today-evidence.mjs";
import {followedRoster,followedSnapshotPath} from "./scripts/followed-live.mjs";
import {normalizeFollows} from "./scripts/team-directory-utils.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {todayDisplayRows} from "./scripts/today-presentation.mjs";
import {verifiedRosterEvents} from "./scripts/verified-player-events.mjs";
import {eventId,tournamentPath,playerMatchesPath,matchTournament} from "./scripts/tournament-live.mjs";
import {officialPlayerGames,badhubPlayerGames,ownTournamentGameGroups} from "./scripts/player-matchday-evidence.mjs";
import {watchRequest,DBV_ID} from "./scripts/live-radar.mjs";

const $=id=>document.getElementById(id);
const hosts=["today-home","today-tournament"];
const visible=()=>["","#start","#turniere","#live"].includes(location.hash);
const n=(tag,cls,value)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(value!==undefined)el.textContent=String(value);
 return el;
};
const readLocalFollows=()=>{
 try{return normalizeFollows(JSON.parse(localStorage.getItem(TEAM_FOLLOWS_KEY)||"[]"))}
 catch{return []}
};
let last=null,signature="",checked=0,loading=false,seq=0,controller=null;
let expiryTimer=null;
let lastSnapshots=new Map(),lastOfficial=new Map(),lastOfficialFailures=new Set(),watchTimes=new Map(),officialWatchTimes=new Map();
const GAME_READ_LIMIT=4;
const gameTime=value=>{
 if(!value||!Number.isFinite(Date.parse(value)))return "";
 const when=new Date(value),date=berlinDay(value)!==berlinDay(Date.now())
  ?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",timeZone:"Europe/Berlin"}).format(when)+" · ":"";
 const time=new Intl.DateTimeFormat("de-DE",{
  hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"
 }).format(when);
 return date+time+" Uhr";
};
/** Player-only match details: never use a club/tournament announcement as proof
 * of a draw. A Badhub snapshot is explicitly separate from DBV matches. */

function gamePanel(title,sourceName,matches,{sourceTournament="",notice="",ownerName="",grouped=false}={}){
 if(!matches.length)return null;
 const section=n("section","today-games-panel");
 const upcoming=matches.filter(m=>m.category==="live"||m.category==="upcoming").length;
 const finished=matches.filter(m=>m.category==="finished").length;
 const wins=matches.filter(m=>m.category==="finished"&&m.outcome==="Sieg").length;
 const losses=matches.filter(m=>m.category==="finished"&&m.outcome==="Niederlage").length;
 const summary=n("div","today-games-overview");
 summary.append(n("strong","today-games-heading",title));
 const terms=[upcoming?upcoming+" anstehend":"",finished?finished+" gespielt":""].filter(Boolean);
 if(wins||losses)terms.push(wins+" Siege · "+losses+" Niederlagen");
 if(terms.length)summary.append(n("small","today-games-summary",terms.join(" · ")));
 section.append(summary);
 if(notice)section.append(n("small","today-games-notice",notice));
 const firstUpcoming=matches.find(m=>m.category==="live"||m.category==="upcoming");
 const renderGame=m=>{
  const game=n("div","today-game-line");
  const outcome=m.category==="finished"&&["Sieg","Niederlage"].includes(m.outcome)?m.outcome:"";
  game.dataset.outcome=outcome==="Sieg"?"win":outcome==="Niederlage"?"loss":"unknown";
  game.dataset.category=m.category||"other";
  if(m===firstUpcoming)game.dataset.next="true";
  const head=n("div","today-game-head");
  const when=m.scheduledAt?gameTime(m.scheduledAt):m.when||"";
  if(when)head.append(n("span","today-game-time",when));
  if(m.discipline&&m.discipline!=="Begegnung")
   head.append(n("span","today-game-discipline",m.discipline));
  head.append(n("span","today-game-status",outcome||m.status));
  game.append(head);
  game.append(n("strong","today-game-opponents",
   "Gegner: "+(m.opponent||"noch nicht veröffentlicht")));
  const footer=n("div","today-game-footer");
  const facts=[m.format?"Spielform: "+m.format:"",
   m.court?"Feld "+m.court:m.source==="DBV-Import"?"Feld offen":""].filter(Boolean);
  if(facts.length)footer.append(n("span","today-game-meta",facts.join(" · ")));
  const score=Array.isArray(m.sets)&&m.sets.length?m.sets.join(" · "):m.score||"";
  if(score)footer.append(n("strong","today-game-score",score));
  else if(m.category==="finished")
   footer.append(n("small","today-game-meta","Ergebnis noch nicht veröffentlicht"));
  if(footer.childNodes.length)game.append(footer);
  return game;
 };
 const addGroup=(label,games)=>{
  if(!games.length)return;
  section.append(n("h3","today-game-group-heading",label+" ("+games.length+")"));
  for(const game of games)section.append(renderGame(game));
 };
 if(grouped){
  const groups=ownTournamentGameGroups(matches),today=berlinDay();
  const isToday=m=>!m.scheduledAt||berlinDay(m.scheduledAt)===today;
  addGroup("Heute · nächste Spiele",groups.upcoming.filter(isToday));
  addGroup("Weitere Turniertage",groups.upcoming.filter(m=>!isToday(m)));
  addGroup("Bereits gespielt",groups.finished);
  addGroup("Nicht gespielt / abgesagt",groups.other);
 }else for(const game of matches.slice(0,12))section.append(renderGame(game));
 const checked=matches.map(m=>Date.parse(m.checkedAt||"")).filter(Number.isFinite);
 const last=checked.length?new Date(Math.max(...checked)).toISOString():null;
 const source=sourceName.startsWith("DBV-Turnier ")?"Offizieller DBV-Import":sourceName;
 section.append(n("small","today-games-provenance",
  "Stand "+(last?gameTime(last):"unbekannt")+" · "+source));
 return section;
}
async function readOfficialEvents(events,signal){
 const out=new Map(),failures=new Set(),byTournament=new Map();
 // Multiple followed players may attend the same event. Query that tournament
 // once for ALL of those IDs, not the first player and not 240 unrelated games.
 for(const event of events){
  const id=eventId(event.tournamentUrl);
  if(!id||!DBV_ID.test(event.playerId))continue;
  if(!byTournament.has(id))byTournament.set(id,{id,url:event.tournamentUrl,ids:[]});
  const group=byTournament.get(id);
  if(!group.ids.includes(event.playerId)&&group.ids.length<12)
   group.ids.push(event.playerId);
 }
 const unique=[...byTournament.values()].slice(0,GAME_READ_LIMIT);
 const data=await Promise.allSettled(unique.map(async item=>{
  const {rows:tournaments}=await readPublicRows(tournamentPath(item.id),{signal,count:false,retries:0});
  const selected=matchTournament(tournaments,{url:item.url});
  if(!selected)return null;
  const path=playerMatchesPath(selected.id,item.ids);
  if(!path)throw Error("Invalid bounded player-match request");
  const {rows:matches}=await readPublicRows(path,{
   signal,count:false,retries:0,timeoutMs:9000
  });
  return [item.id,{internalId:selected.id,rows:matches}];
 }));
 for(let i=0;i<data.length;i++){
  const result=data[i],id=unique[i].id;
  if(result.status==="fulfilled"&&result.value)
   out.set(result.value[0],result.value[1]);
  else if(result.status==="rejected")failures.add(id);
 }
 return {out,failures};
}
/** Existing authorised watch path, only for currently announced followed IDs
 * while Turniertag is actually open. No new cron, vendor scraping or secrets.
 */
async function watchAnnounced(events,signal){
 const ids=[...new Set(events.map(x=>x.playerId))].slice(0,6);
 const now=Date.now(),needed=ids.filter(id=>now-(watchTimes.get(id)||0)>=300000);
 if(!needed.length)return;
 const token=await window.badmintonAppAccess?.getAccessToken?.();
 if(!token||signal.aborted)return;
 await Promise.allSettled(needed.map(async id=>{
  const request=watchRequest(id);
  if(!request)return;
  watchTimes.set(id,now);
  const response=await fetch(request.url,{
   method:"POST",headers:{...request.headers,Authorization:"Bearer "+token},
   body:request.body,signal,cache:"no-store"
  });
  // A rejected watch does not turn an empty/stale snapshot into match evidence.
  if(!response.ok&&response.status!==400&&response.status!==409)return;
 }));
}

/** Optional immediate refresh on opening the private tournament page.
 * Cron already refreshes active events; this merely reduces the lag for an
 * allowed family member. No browser-to-DBV request, secrets or HTML persistence. */
async function requestOfficialMatchday(events,signal){
 const candidates=events.filter(event=>DBV_ID.test(event.playerId)&&
   Boolean(eventId(event.tournamentUrl))).slice(0,4);
 const now=Date.now(),needed=candidates.filter(event=>{
  const key=event.playerId+":"+event.tournamentId;
  return now-(officialWatchTimes.get(key)||0)>=300000;
 }).slice(0,2);
 if(!needed.length)return;
 const token=await window.badmintonAppAccess?.getAccessToken?.();
 if(!token||signal.aborted||window.badmintonAppAccess?.allowed!==true)return;
 let updated=false;
 await Promise.allSettled(needed.map(async event=>{
  const key=event.playerId+":"+event.tournamentId;
  officialWatchTimes.set(key,now);
  const ctrl=new AbortController();
  const abort=()=>ctrl.abort();
  signal.addEventListener("abort",abort,{once:true});
  const timer=setTimeout(()=>ctrl.abort(),20000);
  try{
   const response=await fetch(
    "https://yadexibmjmnjfmfabrug.supabase.co/functions/v1/dbv-matchday-sync",{
     method:"POST",signal:ctrl.signal,cache:"no-store",
     headers:{"Content-Type":"application/json",
      Authorization:"Bearer "+token},
     body:JSON.stringify({mode:"member",dbv_id:event.playerId,
      tournament_uuid:event.tournamentId})
    });
   if(response.ok){
    const result=await response.json();
    updated=updated||Number(result?.checked||0)>0;
   }
  }catch{}finally{
   clearTimeout(timer);signal.removeEventListener("abort",abort);
  }
 }));
 if(updated&&!signal.aborted&&!document.hidden&&location.hash==="#turniere")
  void refresh(true);
}

const activeGroups=()=>window.badmintonLiveViewerOptions?.()||{own:[],friends:[],selected:""};
const context=()=>{
 const groups=activeGroups(),follows=readLocalFollows();
 // Other team screens already read league_teams once; never fetch them a second time.
 const rows=window.badmintonTodayTeamRows?.()||[];
 const selection=followedTeamSelection(follows,rows);
 return {groups,follows,teams:selection.teams,selection};
};
function buildCard(event,{showMatches=false}={}){
 const hasLink=Boolean(event.url),isPlayer=event.entity==="player";
 const row=n(hasLink?"a":"div","today-match-row"+(hasLink?"":" today-match-pending"));
 row.dataset.entity=event.entity;row.dataset.kind=event.kind;
 const context=(isPlayer?event.label:event.name||event.label)+": "+event.status+"; "+
  (isPlayer?event.name+(event.detail?"; "+event.detail:""):
   "Anpfiff "+event.kickoff+"; "+event.pairing);
 if(hasLink){
  row.href=event.url;row.target="_blank";row.rel="noopener noreferrer";
  row.setAttribute("aria-label",(isPlayer?(event.kind==="announced"?"Offizielles DBV-Turnier öffnen: ":"Badhub-Liveansicht öffnen: "):"nuLiga-Spielbericht öffnen: ")+context);
 }else{
  row.setAttribute("aria-label",context+(event.kind==="scheduled"?
   ". Noch kein offizieller Spielbericht veröffentlicht.":""));
 }
 row.append(n("span","today-match-entity",isPlayer?event.label:event.name||event.label));
 row.append(n("span","today-match-status",event.status));
 if(!isPlayer)row.append(n("span","today-match-kickoff","Anpfiff "+event.kickoff));
 row.append(n("strong","today-match-pairing",isPlayer?event.name:event.pairing));
 if(isPlayer&&event.detail)row.append(n("span","today-match-detail",event.detail));
 if(event.score)row.append(n("span","today-match-row-score","Ergebnis "+event.score));
 // The event card remains linked to the OFFICIAL source. Badhub player data
 // carries an independent source label; never claim it belongs to the DBV
 // event unless an exact official match record confirms that association.
 if(showMatches&&isPlayer&&event.kind==="announced"){
  const sourceId=eventId(event.url);
  const official=sourceId?lastOfficial.get(sourceId):null;
  const matches=official?officialPlayerGames(official.rows,official.internalId,
   event.playerId,sourceId,Date.now()):[];
  const panel=gamePanel("Eigene Spiele im Turnier · offizieller DBV-Import",
   "DBV-Turnier "+sourceId,matches,{ownerName:event.name,grouped:true});
  if(panel)row.append(panel);
  else row.append(n("small","today-games-unavailable",
   sourceId&&lastOfficialFailures.has(sourceId)
    ?"Offizielle Spieldaten konnten nicht geladen werden. Erneuter Versuch beim nächsten Abgleich."
    :"Noch keine belegten Einzelspiele aus dem offiziellen Import verfügbar."));
  const live=badhubPlayerGames(lastSnapshots.get(event.playerId),
   event.playerId,Date.now());
  if(live.games.length){
   const extra=gamePanel("Weitere Spieler-Spiele · Badhub","Drittanbieter",
    live.games,{sourceTournament:live.tournament,notice:
    "Separate Spielerquelle – Zuordnung zu diesem DBV-Turnier nicht bestätigt.",
    ownerName:event.name,grouped:true});
   if(extra)row.append(extra);
  }
 }else if(showMatches&&isPlayer){
  const live=badhubPlayerGames(lastSnapshots.get(event.playerId),
   event.playerId,Date.now());
  if(live.games.length){
   const extra=gamePanel("Spiele von "+event.name,"Badhub · Drittanbieter",
    live.games,{sourceTournament:live.tournament});
   if(extra)row.append(extra);
  }
 }
 return row;
}
function renderHost(host,model){
 if(!host)return;
 const list=host.querySelector("[data-today-cards]");
 if(!list)return;
 const all=todayDisplayRows(model?.events||[],{now:Date.now(),limit:102});
 const rows=host.id==="today-home"?all.slice(0,4):all;
 list.replaceChildren(...rows.map(event=>buildCard(event,{showMatches:host.id==="today-tournament"})));
 host.hidden=rows.length===0;
 const more=host.querySelector("[data-today-more]");
 if(more)more.hidden=all.length<=rows.length;
}
function render(){
 for(const id of hosts)renderHost($(id),last);
}
/** Source-backed live cards expire locally at 120s; never retain stale playing claims.
 * A one-shot local expiry is not a provider poll or additional network request.
 */
function scheduleLocalExpiry(){
 if(expiryTimer!==null){clearTimeout(expiryTimer);expiryTimer=null}
 const now=Date.now();
 const moments=(last?.events||[]).filter(e=>e.entity==="player"&&e.kind!=="announced")
  .map(e=>Date.parse(e.checkedAt)+120000).filter(x=>Number.isFinite(x));
 if(!moments.length)return;
 const closest=Math.min(...moments);
 expiryTimer=setTimeout(()=>{
  expiryTimer=null;
  if(!last)return;
  const now=Date.now();
  const events=last.events.filter(e=>e.entity!=="player"||e.kind==="announced"||
   (Number.isFinite(Date.parse(e.checkedAt))&&Date.parse(e.checkedAt)+120000>now));
  if(events.length!==last.events.length){
   last={...last,events};render();informNav();
  }
  scheduleLocalExpiry();
 },Math.max(0,closest-now+50));
}
function informNav(){
 const events=last?.events||[];
 window.dispatchEvent(new CustomEvent("badminton:today-events",{
  detail:{day:last?.today||berlinDay(),
   matchToday:hasVerifiedMatchToday(events),
   playing:events.some(item=>item.entity==="player"&&item.kind==="playing")}
 }));
}
async function refresh(force=false){
 if(!visible()||document.hidden)return;
 if(!window.badmintonAppAccess?.allowed){
  last=null;lastSnapshots=new Map();lastOfficial=new Map();lastOfficialFailures=new Set();
  signature="";checked=0;render();informNav();scheduleLocalExpiry();return;
 }
 const ctx=context(),today=berlinDay(),isTournament=location.hash==="#turniere";
 const announced=verifiedRosterEvents(ctx.groups,today);
 const player=followedRoster(ctx.groups);
 // A verified player currently appearing on Turniertag has priority even if
 // she falls after the generic six-player LIVE feed limit.
 const all=[...(ctx.groups.own||[]),...(ctx.groups.friends||[])];
 const selected=announced.map(x=>all.find(p=>p?.id===x.playerId))
  .filter(Boolean);
 const candidates=[...selected,...player.players],seen=new Set();
 const priorityPlayers=candidates.filter(p=>{
  if(seen.has(p.id))return false;seen.add(p.id);return true;
 }).slice(0,6);
 const stamp=JSON.stringify([today,isTournament,priorityPlayers.map(p=>p.id),
  ctx.follows,ctx.teams.map(t=>t.id)]);
 if(!force&&stamp===signature&&Date.now()-checked<300000){render();return}
 if(loading&&!force)return;
 const ticket=++seq;controller?.abort();controller=new AbortController();
 loading=true;render(true);
 const signal=controller.signal;
 const playerPath=followedSnapshotPath(priorityPlayers);
 const teamPath=fixtureReadPath(ctx.teams,{day:today});
 // Authorised watch registration is best effort; its POST must never hold
 // the visible app hostage while we render already available source facts.
 if(isTournament&&announced.length)void watchAnnounced(announced,signal);
 if(isTournament&&announced.length)void requestOfficialMatchday(announced,signal);
 // Official reads are bounded, only on the open tournament screen, and only
 // for already source-backed, followed events. No direct DBV scraping.
 const reads=await Promise.allSettled([
  playerPath?readPublicRows(playerPath,{signal,count:false,retries:0}):Promise.resolve({rows:[]}),
  teamPath?readPublicRows(teamPath,{signal,count:false,retries:0}):Promise.resolve({rows:[]}),
  isTournament&&announced.length?readOfficialEvents(announced,signal):Promise.resolve(new Map())
 ]);
 if(ticket!==seq||signal.aborted)return;
 const errors=reads.slice(0,2).filter(r=>r.status==="rejected").length;
 const rows=reads.slice(0,2).map(r=>r.status==="fulfilled"?r.value.rows:[]);
 lastSnapshots=new Map((rows[0]||[]).filter(row=>row?.dbv_id).map(row=>[row.dbv_id,row]));
 const official=reads[2].status==="fulfilled"?reads[2].value:null;
 lastOfficial=official?.out||new Map();
 lastOfficialFailures=official?.failures||new Set();
 last=todayEvidence({now:Date.now(),groups:ctx.groups,snapshots:rows[0],
  follows:ctx.follows,teams:ctx.teams,fixtures:rows[1]});
 // Do not reuse a cached answer with a failed source as if it were complete.
 const sourceError=reads[2].status==="rejected"||lastOfficialFailures.size>0;
 signature=errors||sourceError?"":stamp;
 checked=errors||sourceError?0:Date.now();
 loading=false;render(false,errors?"partial":"");
 informNav();scheduleLocalExpiry();
}
function changed(){
 signature="";checked=0;last=null;informNav();scheduleLocalExpiry();
 if(visible())void refresh(true);
}
function route(){if(visible())void refresh()}
function init(){
 if(!$(hosts[0])||!$(hosts[1]))return;
 window.addEventListener("hashchange",route);
 window.addEventListener("badminton:app-access-granted",changed);
 window.addEventListener("badminton:teams-updated",changed);
 window.addEventListener("badminton:profile-change",changed);
 window.addEventListener("badminton:friend-followed",changed);
 window.addEventListener("badminton:friend-unfollowed",changed);
 window.addEventListener("badminton:own-profile-added",changed);
 window.addEventListener("storage",event=>{
  if([TEAM_FOLLOWS_KEY,"shuttleboard-v1"].includes(event.key))changed();
 });
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)route()});
 // Turniertag updates while open, without a background poll on every tab.
 // At most one bounded source read and one per-player watch per 5 minutes.
 setInterval(()=>{if(location.hash==="#turniere"&&!document.hidden&&
   window.badmintonAppAccess?.allowed)void refresh()},300000);
 route();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
