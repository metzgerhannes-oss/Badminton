/** #298 Paket C: read-only, demand-driven 'Heute im Einsatz' for Home and Turniertag.
 * No timer, provider watcher, new team directory read, personal upload or server write.
 * Every claimed match/live state is derived by today-evidence.mjs.
 */
import {todayEvidence,followedTeamSelection,fixtureReadPath,berlinDay,TEAM_FOLLOWS_KEY}
 from "./scripts/today-evidence.mjs";
import {followedRoster,followedSnapshotPath} from "./scripts/followed-live.mjs";
import {normalizeFollows} from "./scripts/team-directory-utils.mjs";
import {readPublicRows} from "./scripts/supabase-read.mjs";

const $=id=>document.getElementById(id);
const hosts=["today-home","today-tournament"];
const visible=()=>["","#start","#turniere","#live"].includes(location.hash);
const n=(tag,cls,value)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(value!==undefined)el.textContent=String(value);
 return el;
};
const dateStamp=value=>{
 if(!value)return "Quellenzeit unbekannt";
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return "Quellenzeit unbekannt";
 return "Quelle geprüft: "+new Intl.DateTimeFormat("de-DE",{
  day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",
  timeZone:"Europe/Berlin"
 }).format(date);
};
const readLocalFollows=()=>{
 try{return normalizeFollows(JSON.parse(localStorage.getItem(TEAM_FOLLOWS_KEY)||"[]"))}
 catch{return []}
};
let last=null,signature="",checked=0,loading=false,seq=0,controller=null;
const activeGroups=()=>window.badmintonLiveViewerOptions?.()||{own:[],friends:[],selected:""};
const context=()=>{
 const groups=activeGroups(),follows=readLocalFollows();
 // Other team screens already read league_teams once; never fetch them a second time.
 const rows=window.badmintonTodayTeamRows?.()||[];
 const selection=followedTeamSelection(follows,rows);
 return {groups,follows,teams:selection.teams,selection};
};
function buildCard(event){
 const card=n("article","today-entry");
 const head=n("div","today-entry-head");
 head.append(n("strong","",event.name),n("span","today-entry-state",event.status));
 card.append(head);
 if(event.detail)card.append(n("p","today-entry-detail",event.detail));
 if(event.score)card.append(n("strong","today-entry-score",event.score));
 const source=n("small","today-entry-source",
  event.source+" · "+dateStamp(event.checkedAt));
 card.append(source);
 const actions=n("div","today-entry-actions");
 if(event.entity==="player"){
  const open=n("button","today-entry-button","Spieler ansehen");
  open.type="button";
  open.addEventListener("click",()=>{
   if(!window.badmintonSelectViewer?.(event.playerId,{stayOnPage:true})){
    location.hash="#spieler";
   }
  });
  actions.append(open);
 }else{
  const open=n("button","today-entry-button","Mannschaft ansehen");
  open.type="button";
  open.addEventListener("click",()=>{
   if(!window.badmintonTodayOpenTeam?.(event.teamId))location.hash="#mannschaft";
  });
  actions.append(open);
 }
 if(typeof event.sourceUrl==="string"&&event.sourceUrl.startsWith("https://")){
  const link=n("a","today-entry-original","Originalquelle ↗");
  link.href=event.sourceUrl;link.target="_blank";link.rel="noopener noreferrer";
  actions.append(link);
 }
 card.append(actions);
 return card;
}
function renderHost(host,model,waiting=false,error=""){
 if(!host)return;
 const list=host.querySelector("[data-today-cards]");
 const info=host.querySelector("[data-today-status]");
 const more=host.querySelector("[data-today-more]");
 if(!list||!info||!more)return;
 const entries=model?.events||[];
 const limit=host.id==="today-home"?4:8;
 const expanded=host.dataset.expanded==="true";
 const shown=expanded?entries:entries.slice(0,limit);
 list.replaceChildren();
 for(const kind of ["player","team"]){
  const matching=shown.filter(item=>item.entity===kind);
  if(!matching.length)continue;
  const label=n("h3","today-group-label",kind==="player"?"Spieler":"Mannschaften");
  list.append(label);
  for(const item of matching)list.append(buildCard(item));
 }
 if(waiting)info.textContent="Belegte Spieltermine werden geprüft …";
 else if(error&&entries.length)info.textContent="Ein Teil der Quellen ist momentan nicht erreichbar. Nur belegte Ergebnisse werden angezeigt.";
 else if(error)info.textContent="Quellen momentan nicht erreichbar. Kein aktueller Spielstatus bestätigt.";
 else if(!entries.length)info.textContent="Heute keine bestätigten Einsätze in den verfügbaren Quellen.";
 else info.textContent=entries.length+" belegte Ereignisse heute · kein Mannschafts-Live ohne Quellenbeleg.";
 if(model?.coverage?.playersOmitted||model?.coverage?.teamsOmitted||model?.coverage?.teamsUnresolved){
  info.textContent+=" · Auswahl begrenzt; weitere Profile/Mannschaften ggf. nicht geprüft.";
 }
 more.hidden=entries.length<=limit;
 if(!more.hidden){
  more.textContent=expanded?"Weniger anzeigen":"Alle "+entries.length+" anzeigen";
  more.setAttribute("aria-expanded",String(expanded));
 }
}
function render(waiting=false,error=""){
 for(const id of hosts)renderHost($(id),last,waiting,error);
}
function informNav(){
 const events=last?.events||[];
 window.dispatchEvent(new CustomEvent("badminton:today-events",{
  detail:{day:last?.today||berlinDay(),confirmed:events.length>0,
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
 informNav();
}
function changed(){signature="";if(visible())void refresh(true)}
function route(){if(visible())void refresh()}
function init(){
 if(!$(hosts[0])||!$(hosts[1]))return;
 for(const id of hosts){
  const host=$(id);
  host.querySelector("[data-today-refresh]")?.addEventListener("click",()=>void refresh(true));
  host.querySelector("[data-today-more]")?.addEventListener("click",()=>{
   host.dataset.expanded=host.dataset.expanded!=="true"?"true":"false";
   render();
  });
 }
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
