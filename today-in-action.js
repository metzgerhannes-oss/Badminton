/** #298 Paket C: read-only, demand-driven 'Heute im Einsatz' for Home and Turniertag.
 * No timer, provider watcher, new team directory read, personal upload or server write.
 * Every claimed match/live state is derived by today-evidence.mjs.
 */
import {todayEvidence,followedTeamSelection,fixtureReadPath,berlinDay,hasVerifiedMatchToday,TEAM_FOLLOWS_KEY}
 from "./scripts/today-evidence.mjs";
import {followedRoster,followedSnapshotPath} from "./scripts/followed-live.mjs";
import {normalizeFollows} from "./scripts/team-directory-utils.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {today'sMatchRows} from "./scripts/today-presentation.mjs";

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

const activeGroups=()=>window.badmintonLiveViewerOptions?.()||{own:[],friends:[],selected:""};
const context=()=>{
 const groups=activeGroups(),follows=readLocalFollows();
 // Other team screens already read league_teams once; never fetch them a second time.
 const rows=window.badmintonTodayTeamRows?.()||[];
 const selection=followedTeamSelection(follows,rows);
 return {groups,follows,teams:selection.teams,selection};
};
function buildCard(event){
 const link=n("a","today-match-row");
 // Open the live public nuLiga page itself on demand. We never pretend that
 // opening a source also refreshes an unverified score inside Schmetterlinge.
 link.href=event.url;
 link.target="_blank";link.rel="noopener noreferrer";
 link.setAttribute("aria-label","nuLiga öffnen: Anpfiff "+event.kickoff+"; "+event.pairing);
 link.append(n("span","today-match-kickoff","Anpfiff "+event.kickoff));
 link.append(n("strong","today-match-pairing",event.pairing));
 return link;
}
function renderHost(host,model){
 if(!host)return;
 const list=host.querySelector("[data-today-cards]");
 if(!list)return;
 // No empty/error/coverage messages, statuses, results, controls or sources.
 // Source validation remains internal and the saved official URL is the card link.
 const rows=today'sMatchRows(model?.events||[],{limit:host.id==="today-home"?4:8});
 list.replaceChildren(...rows.map(buildCard));
 host.hidden=rows.length===0;
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
 const moments=(last?.events||[]).filter(e=>e.entity==="player")
  .map(e=>Date.parse(e.checkedAt)+120000).filter(x=>Number.isFinite(x));
 if(!moments.length)return;
 const closest=Math.min(...moments);
 expiryTimer=setTimeout(()=>{
  expiryTimer=null;
  if(!last)return;
  const now=Date.now();
  const events=last.events.filter(e=>e.entity!=="player"||
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
 if(!window.badmintonAppAccess?.allowed){render(false,"access");return}
 const ctx=context(),today=berlinDay();
 const player=followedRoster(ctx.groups);
 const stamp=JSON.stringify([today,player.players.map(p=>p.id),ctx.follows,ctx.teams.map(t=>t.id)]);
 if(!force&&stamp===signature&&Date.now()-checked<180000){render();return}
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
