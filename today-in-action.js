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
import {eventId,tournamentPath,matchesPath,matchTournament} from "./scripts/tournament-live.mjs";
import {officialPlayerGames,badhubPlayerGames} from "./scripts/player-matchday-evidence.mjs";
import {watchRequest} from "./scripts/live-radar.mjs";

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
let lastSnapshots=new Map(),lastOfficial=new Map(),watchTimes=new Map();
const GAME_READ_LIMIT=4;
const gameTime=value=>{
 if(!value||!Number.isFinite(Date.parse(value)))return "";
 return new Intl.DateTimeFormat("de-DE",{
  hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"
 }).format(new Date(value))+" Uhr";
};
/** An in-app match panel is passive content inside the existing verified
 * source link. It neither starts live polling nor creates a match claim.
 * A Badhub report is never presented as the official DBV event feed.
 */
function gamePanel(title,sourceName,matches,{sourceTournament="",notice=""}={}){
 if(!matches.length)return null;
 const section=n("section","today-games-panel");
 section.append(n("strong","today-games-heading",title));
 const meta=n("small","today-games-provenance",sourceName+
  (sourceTournament?" · "+sourceTournament:""));
 section.append(meta);
 if(notice)section.append(n("small","today-games-notice",notice));
 for(const m of matches.slice(0,12)){
  const game=n("div","today-game-line");
  const top=n("div","today-game-head");
  top.append(n("span","today-game-status",m.status));
  top.append(n("span","today-game-discipline",m.discipline));
  game.append(top);
  if(m.side1||m.side2)
   game.append(n("strong","today-game-opponents",m.side1+" – "+m.side2));
  else if(m.opponent)
   game.append(n("strong","today-game-opponents","Gegen "+m.opponent));
  const fields=[
   m.court?"Feld "+m.court:"",
   m.scheduledAt?"Geplant "+gameTime(m.scheduledAt):m.when||"",
   Array.isArray(m.sets)&&m.sets.length?"Sätze "+m.sets.join(" · "):m.score?"Sätze "+m.score:"",
   m.outcome||""
  ].filter(Boolean);
  if(fields.length)game.append(n("small","today-game-meta",fields.join(" · ")));
  game.append(n("small","today-game-source","Stand: "+(gameTime(m.checkedAt)||"nicht verfügbar")));
  section.append(game);
 }
 return section;
}
async function readOfficialEvents(events,signal){
 const out=new Map(),unique=[...new Map(events.map(x=>[x.tournamentId,x])).values()]
  .slice(0,GAME_READ_LIMIT);
 const data=await Promise.allSettled(unique.map(async item=>{
  const id=eventId(item.tournamentUrl);
  if(!id)return null;
  const {rows:tournaments}=await readPublicRows(tournamentPath(id),{signal,count:false,retries:0});
  const selected=matchTournament(tournaments,{url:item.tournamentUrl});
  if(!selected)return null;
  const {rows:matches}=await readPublicRows(matchesPath(selected.id),{
   signal,count:false,retries:0,timeoutMs:9000
  });
  return [id,{internalId:selected.id,rows:matches}];
 }));
 for(const result of data)if(result.status==="fulfilled"&&result.value)
  out.set(result.value[0],result.value[1]);
 return out;
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
  const panel=gamePanel("Einzelspiele · offizieller DBV-Import",
   "DBV-Turnier "+sourceId,matches);
  if(panel)row.append(panel);
  else row.append(n("small","today-games-unavailable",
   "Noch keine belegten Einzelspiele aus dem offiziellen Import verfügbar."));
  const live=badhubPlayerGames(lastSnapshots.get(event.playerId),
   event.playerId,Date.now());
  if(live.games.length){
   const extra=gamePanel("Weitere Spieler-Spiele · Badhub","Drittanbieter",
    live.games,{sourceTournament:live.tournament,notice:
    "Separate Spielerquelle – Zuordnung zu diesem DBV-Turnier nicht bestätigt."});
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
 if(!window.badmintonAppAccess?.allowed){last=null;signature="";checked=0;render();informNav();scheduleLocalExpiry();return}
 const ctx=context(),today=berlinDay();
 const player=followedRoster(ctx.groups);
 const stamp=JSON.stringify([today,player.players.map(p=>p.id),ctx.follows,ctx.teams.map(t=>t.id)]);
 if(!force&&stamp===signature&&Date.now()-checked<300000){render();return}
 if(loading&&!force)return;
 const ticket=++seq;controller?.abort();controller=new AbortController();
 loading=true;render(true);
 const signal=controller.signal;
 const playerPath=followedSnapshotPath(player.players);
 const teamPath=fixtureReadPath(ctx.teams,{day:today});
 // Two bounded existing read models; at most 6 players, 12 teams, 96 fixture rows.
 const reads=await Promise.allSettled([
  playerPath?readPublicRows(playerPath,{signal,count:false,retries:0}):Promise.resolve({rows:[]}),
  teamPath?readPublicRows(teamPath,{signal,count:false,retries:0}):Promise.resolve({rows:[]})
 ]);
 if(ticket!==seq||signal.aborted)return;
 const errors=reads.filter(r=>r.status==="rejected").length;
 const rows=reads.map(r=>r.status==="fulfilled"?r.value.rows:[]);
 last=todayEvidence({now:Date.now(),groups:ctx.groups,snapshots:rows[0],
  follows:ctx.follows,teams:ctx.teams,fixtures:rows[1]});
 // Do not reuse a cached answer with a failed source as if it were complete.
 signature=errors?"":stamp;
 checked=errors?0:Date.now();
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
 route();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
