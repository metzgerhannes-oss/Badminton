/** Mannschaft: official league seasons with private per-device following. */
import {readPublicRows} from "./scripts/supabase-read.mjs";
import {TEAM_FOLLOWS_KEY,normalizeFollows,filterTeamRows,officialTeamUrl,
  displayTeamName,tablePoints,confirmedResult} from "./scripts/team-directory-utils.mjs";

const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const displayDate=value=>{
 if(!value)return "Termin noch offen";
 const dt=new Date(value);
 return Number.isNaN(dt.getTime())?"Termin noch offen":
  new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(dt);
};
const dateOnly=value=>{
 if(!value)return "unbekannt";
 const dt=new Date(value);
 return Number.isNaN(dt.getTime())?"unbekannt":
 new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Europe/Berlin"}).format(dt);
};
let rows=[],loading=false,loadFailed=false,selectedId="",activeTab="games",detailsTicket=0,initialized=false;
let detail={games:[],table:[],error:false},follows=[];
function readFollows(){
 try{follows=normalizeFollows(JSON.parse(localStorage.getItem(TEAM_FOLLOWS_KEY)||"[]"))}catch{follows=[]}
}
function saveFollows(){
 try{localStorage.setItem(TEAM_FOLLOWS_KEY,JSON.stringify(follows));return true}catch{return false}
}
function showStatus(message){
 const n=$("team-directory-status");if(n)n.textContent=message;
}
function season(){return $("team-season")?.value||"2026/27"}
function renderFollowed(){
 const container=$("team-followed");if(!container)return;
 const found=rows.filter(team=>follows.includes(team.follow_key)&&team.season===season());
 container.innerHTML=found.length?found.map(team=>card(team)).join(""):
  '<p class="team-empty">Hier erscheinen die Mannschaften, denen du folgst. Wähle unten eine Mannschaft und tippe auf „Folgen“.</p>';
 wireCards(container);
}
function card(team){
 const followed=follows.includes(team.follow_key),selected=selectedId===team.id;
 return '<article class="team-card'+(selected?' is-selected':'')+'">'+
  '<button class="team-card-main" type="button" data-team-open="'+esc(team.id)+'">'+
   '<strong>'+esc(displayTeamName(team))+'</strong>'+
   '<span>'+esc(team.league_name)+' · '+esc(team.season)+'</span>'+
   '<small>Platz '+(Number.isInteger(team.position)?team.position:"–")+
   ' · Tabellenpunkte '+esc(tablePoints(team))+' · Stand '+esc(dateOnly(team.source_checked_at))+'</small>'+
  '</button><button type="button" class="team-follow-button" data-team-toggle="'+esc(team.follow_key)+'"'+
  ' aria-label="'+(followed?"Nicht mehr folgen: ":"Folgen: ")+esc(displayTeamName(team))+'">'+
   (followed?'✓ Gefolgt':'+ Folgen')+'</button></article>';
}
function wireCards(container){
 container.querySelectorAll("[data-team-open]").forEach(b=>b.addEventListener("click",()=>selectTeam(b.dataset.teamOpen)));
 container.querySelectorAll("[data-team-toggle]").forEach(b=>b.addEventListener("click",()=>{
  const id=b.dataset.teamToggle;
  if(follows.includes(id))follows=follows.filter(x=>x!==id);
  else follows=normalizeFollows([...follows,id]);
  const saved=saveFollows();renderFollowed();renderSearchResults();
  if(!saved)showStatus("Folgen konnte auf diesem Gerät nicht gespeichert werden.");
 }));
}
function renderSearchResults(){
 const container=$("team-results");if(!container)return;
 const visible=filterTeamRows(rows,$("team-search")?.value||"",season());
 const query=String($("team-search")?.value||"").trim();
 if(loadFailed){container.innerHTML='<p class="team-empty">Die Datenbank ist gerade nicht erreichbar. Bitte erneut laden.</p>';return}
 if(loading){container.innerHTML='<p class="team-empty">Mannschaften werden geladen …</p>';return}
 container.innerHTML=visible.length?visible.slice(0,80).map(card).join(""):
 '<p class="team-empty">'+(query?'Keine bestätigten Mannschaften zu dieser Suche gefunden.':'Für diese Saison liegen noch keine Mannschaften vor.')+'</p>';
 wireCards(container);
 const count=$("team-count");
 if(count)count.textContent=visible.length+" Mannschaften gefunden"+(visible.length>80?" · erste 80 sichtbar":"");
}
function renderDetail(){
 const root=$("team-detail");if(!root)return;
 const team=rows.find(t=>t.id===selectedId);
 if(!team){root.hidden=true;return}
 root.hidden=false;
 const href=officialTeamUrl(team.source_url);
 $("team-detail-title").textContent=displayTeamName(team);
 $("team-detail-meta").textContent=team.league_name+" · "+team.season+" · Stand "+dateOnly(team.source_checked_at);
 $("team-detail-summary").textContent="Tabellenplatz "+(team.position??"–")+" · Punkte "+tablePoints(team);
 const link=$("team-source-link");
 if(href){link.href=href;link.hidden=false}else link.hidden=true;
 $("team-detail-games").hidden=activeTab!=="games";
 $("team-detail-table").hidden=activeTab!=="table";
 root.querySelectorAll("[data-team-tab]").forEach(button=>{
  button.setAttribute("aria-selected",String(button.dataset.teamTab===activeTab));
 });
 if(detail.error){
  const message='<p class="team-empty">Spielplan und Tabelle sind zurzeit nicht abrufbar. Die bisher bekannten Mannschaftsdaten bleiben sichtbar.</p>';
  $("team-detail-games").innerHTML=message;
  $("team-detail-table").innerHTML=message;
  return;
 }
 const games=detail.games;
 $("team-detail-games").innerHTML=games.length?
  '<div class="team-fixtures">'+games.map(game=>{
    const url=officialTeamUrl(game.source_url);
    const score=confirmedResult(game);
    return '<article class="team-fixture"><span>'+esc(displayDate(game.match_date))+
      '</span><strong>'+esc(game.home_team)+' – '+esc(game.away_team)+'</strong>'+
      '<span>'+esc(score||({scheduled:"Angesetzt",postponed:"Verlegt",cancelled:"Abgesagt",forfeit:"Gewertet"}[game.status]||"Ergebnis offen"))+'</span>'+
      (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Spielbericht bei nuLiga ↗</a>':'')+
    '</article>';
  }).join("")+'</div>':
  '<p class="team-empty">Der vollständige Saisonspielplan ist noch nicht importiert. Alle veröffentlichten Begegnungen findest du in der offiziellen nuLiga-Ansicht.</p>';
 const table=detail.table;
 $("team-detail-table").innerHTML=table.length?
  '<div class="team-table-scroll"><table class="team-league-table"><thead><tr><th>Pl.</th><th>Mannschaft</th><th>Sp.</th><th>S/U/N</th><th>Punkte</th></tr></thead><tbody>'+
    table.map(line=>'<tr><td>'+esc(line.position)+'</td><td>'+esc(line.club_team)+'</td><td>'+esc(line.played??"–")+'</td><td>'+
      esc([line.won,line.drawn,line.lost].map(x=>x??"–").join("/"))+'</td><td>'+esc(tablePoints(line))+'</td></tr>').join("")+
  '</tbody></table></div>':
  '<p class="team-empty">Die komplette Ligatabelle wurde noch nicht bestätigt importiert. Der Mannschaftsplatz und die Punkte oben sind ein datierter nuLiga-Quellstand, keine Live-Tabelle.</p>';
}
async function selectTeam(id){
 if(!rows.some(row=>row.id===id))return;
 selectedId=id;activeTab="games";detail={games:[],table:[],error:false};
 renderFollowed();renderSearchResults();renderDetail();
 const target=$("team-detail");target?.scrollIntoView({block:"start",behavior:"smooth"});
 const ticket=++detailsTicket;
 const teamId=encodeURIComponent(id);
 $("team-detail-games").innerHTML='<p class="team-empty">Saisonspielplan wird geladen …</p>';
 try{
  const [games,table]=await Promise.all([
   readPublicRows("league_fixtures?select=id,match_date,home_team,away_team,home_score,away_score,status,source_url&team_id=eq."+teamId+"&order=match_date.asc.nullslast&limit=100",{count:false}),
   readPublicRows("league_table_rows?select=position,club_team,played,won,drawn,lost,points_for,points_against&team_id=eq."+teamId+"&order=position.asc&limit=30",{count:false})
  ]);
  if(ticket!==detailsTicket)return;
  detail={games:games.rows,table:table.rows,error:false};
 }catch{if(ticket!==detailsTicket)return;detail={games:[],table:[],error:true}}
 renderDetail();
}
async function load(){
 if(loading)return;
 loading=true;loadFailed=false;showStatus("Öffentliche nuLiga-Mannschaftsdaten werden geladen …");renderSearchResults();
 try{
  const data=await readPublicRows("league_teams?select=id,follow_key,club_id,club_name,team_label,league_name,season,position,points_for,points_against,source_url,source_checked_at&order=club_name.asc,team_label.asc&limit=500",{count:false});
  rows=data.rows.filter(t=>/^nuliga:[0-9]{3,7}:[1-9][0-9]?$/.test(t.follow_key)&&officialTeamUrl(t.source_url));
  loadFailed=false;
  const seasons=[...new Set(rows.map(r=>r.season))].sort().reverse();
  const choice=$("team-season"),prior=choice.value||"2026/27";
  choice.innerHTML=seasons.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
  if(seasons.includes(prior))choice.value=prior;
  showStatus(rows.length+" Mannschaften aus bestätigten nuLiga-Quellen · Quellenstand jeweils in der Karte");
 }catch{
  loadFailed=true;showStatus("Öffentliche Mannschaftsdaten gerade nicht erreichbar. Bitte erneut versuchen.");
 }finally{loading=false;renderFollowed();renderSearchResults();renderDetail()}
}
function init(){
 if(initialized||!$("view-mannschaft"))return;initialized=true;readFollows();
 $("team-search").addEventListener("input",renderSearchResults);
 $("team-season").addEventListener("change",()=>{
  if(selectedId&&!rows.some(r=>r.id===selectedId&&r.season===season())){
   const old=rows.find(r=>r.id===selectedId);
   selectedId=rows.find(r=>r.follow_key===old?.follow_key&&r.season===season())?.id||"";
   ++detailsTicket;detail={games:[],table:[],error:false};
   if(selectedId)selectTeam(selectedId);
  }
  renderFollowed();renderSearchResults();renderDetail();
 });
 $("team-refresh").addEventListener("click",load);
 $("team-detail").querySelectorAll("[data-team-tab]").forEach(btn=>btn.addEventListener("click",()=>{
  activeTab=btn.dataset.teamTab;renderDetail();
 }));
 window.addEventListener("hashchange",()=>{if(location.hash==="#mannschaft"&&rows.length===0&&!loading)load()});
 window.addEventListener("storage",event=>{
  if(event.key===TEAM_FOLLOWS_KEY){readFollows();renderFollowed();renderSearchResults()}
 });
 load();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
