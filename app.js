"use strict";
/** Schmetterlinge: historical results and official tournament bookmarks. No live-result polling. */
const STORE="shuttleboard-v1"; // Preserve existing device favourites.
const DEFAULT_PLAYERS=[
 {id:"05-070879",name:"Philipp Metzger",url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
 {id:"local-charlotte",name:"Charlotte Metzger",url:""}
];
const state={players:DEFAULT_PLAYERS.map(p=>({...p})),officialLinks:[],chosen:"all",page:"historie"};
const el=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=x=>{try{const u=new URL(String(x));return u.protocol==="https:"?u.href:""}catch{return ""}};
function parseDbvTournamentLink(value){
 try{
  const u=new URL(String(value).trim());
  if(u.protocol!=="https:"||!["dbv.turnier.de","turnier.de","www.turnier.de"].includes(u.hostname))return null;
  const m=u.pathname.match(/^\/tournament\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  if(!m)return null;
  const id=m[1].toUpperCase();
  return {id,url:"https://dbv.turnier.de/tournament/"+id};
 }catch{return null}
}
function normalizeBookmark(x){
 const p=parseDbvTournamentLink(x?.url);
 if(!p)return null;
 const title=String(x.name||"").trim().slice(0,100)||"DBV-Turnier "+p.id.slice(0,8);
 const validDate=d=>typeof d==="string"&&/^\d{4}-\d\d-\d\d$/.test(d)&&!Number.isNaN(Date.parse(d))?d:"";
 return {id:p.id,url:p.url,name:title,playerId:String(x.playerId||"all"),startDate:validDate(x.startDate),endDate:validDate(x.endDate)};
}
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const niceDay=x=>x?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(x+"T12:00:00Z")):"";
function restore(){
 try{
  const saved=JSON.parse(localStorage.getItem(STORE)||"null");
  if(saved&&typeof saved==="object"){
   if(Array.isArray(saved.players))state.players=saved.players.filter(p=>p&&typeof p.name==="string"&&typeof p.id==="string").slice(0,12);
   if(Array.isArray(saved.officialLinks))state.officialLinks=saved.officialLinks.map(normalizeBookmark).filter(Boolean).slice(0,40);
   if(typeof saved.chosen==="string")state.chosen=saved.chosen;
   if(!saved.historyProfilesInitialized&&!state.players.some(p=>p.name==="Charlotte Metzger"))
    state.players.push({id:"local-charlotte",name:"Charlotte Metzger",url:""});
  }
 }catch{}
 if(state.chosen!=="all"&&!state.players.some(p=>p.id===state.chosen))state.chosen="all";
}
function save(){
 try{localStorage.setItem(STORE,JSON.stringify({players:state.players,officialLinks:state.officialLinks,chosen:state.chosen,historyProfilesInitialized:true}))}catch{}
}
let toastTimer;
function toast(message){const node=el("toast");node.textContent=message;node.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("visible"),2800)}
function selectedLinks(){return state.officialLinks.filter(t=>state.chosen==="all"||t.playerId==="all"||t.playerId===state.chosen)}
function bookmarkPhase(t){
 if(!t.startDate)return ["Termin offen","unknown"];
 const today=localDay();
 if(today<t.startDate)return ["Bevorstehend","future"];
 const end=t.endDate&&t.endDate>=t.startDate?t.endDate:t.startDate;
 if(today>end)return ["Vergangen","past"];
 return ["Turniertag","today"];
}
function renderPlayers(){
 const profiles=[{id:"all",name:"Alle Spieler"},...state.players];
 el("player-pills").innerHTML=profiles.map(p=>'<button class="pill '+(p.id===state.chosen?"selected":"")+'" data-player="'+esc(p.id)+'" aria-pressed="'+(p.id===state.chosen)+'" type="button">'+(p.id==="all"?"":'<span>'+esc(p.name.trim().charAt(0).toUpperCase())+'</span>')+esc(p.name)+'</button>').join("");
 document.querySelectorAll("[data-player]").forEach(button=>button.addEventListener("click",()=>{state.chosen=button.dataset.player;save();render()}));
}
function renderTournaments(){
 const sorted=selectedLinks().slice().sort((a,b)=>{
  const order={today:0,future:1,unknown:2,past:3};
  const aKind=bookmarkPhase(a)[1],bKind=bookmarkPhase(b)[1];
  return order[aKind]-order[bKind]||(aKind==="past"?(b.startDate||"").localeCompare(a.startDate||""):(a.startDate||"").localeCompare(b.startDate||""))||a.name.localeCompare(b.name,"de");
 });
 const section=el("official-tournament-list");
 if(!sorted.length){section.innerHTML='<div class="empty"><h3>Noch keine Turniere gespeichert</h3><p>Füge einen DBV-Turnierlink hinzu, den du nach der Anmeldung erhalten hast.</p></div>';return}
 section.innerHTML=sorted.map(t=>{
  const profile=t.playerId==="all"?"Alle Spieler":(state.players.find(p=>p.id===t.playerId)?.name||"Spieler");
  const [phase,tone]=bookmarkPhase(t);
  const dates=t.startDate?niceDay(t.startDate)+(t.endDate&&t.endDate!==t.startDate?" – "+niceDay(t.endDate):""):"Termin nicht hinterlegt";
  return '<article class="tournament-card"><div class="saved-tournament-top"><h3>'+esc(t.name)+'</h3><span class="saved-tournament-phase phase-'+tone+'">'+esc(phase)+'</span></div><p>'+esc(profile)+' · '+esc(dates)+'</p><p class="saved-tournament-id">Turnier-ID: '+esc(t.id)+'</p><div class="local-shortcut-actions"><a href="'+esc(t.url)+'" rel="noopener noreferrer" target="_blank">Offizielle Turnierseite ↗</a><button class="remove-button" data-edit-id="'+esc(t.id)+'" data-edit-player="'+esc(t.playerId)+'" type="button">Bearbeiten</button><button class="remove-button" data-remove-id="'+esc(t.id)+'" data-remove-player="'+esc(t.playerId)+'" type="button">Entfernen</button></div></article>';
 }).join("");
 section.querySelectorAll("[data-edit-id]").forEach(button=>button.addEventListener("click",()=>{
  const item=state.officialLinks.find(t=>t.id===button.dataset.editId&&t.playerId===button.dataset.editPlayer);
  if(item)openTournamentForm(item);
 }));
 section.querySelectorAll("[data-remove-id]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.removeId,player=button.dataset.removePlayer;
  state.officialLinks=state.officialLinks.filter(t=>!(t.id===id&&t.playerId===player));
  save();render();toast("Turnierlink entfernt");
 }));
}
function renderProfiles(){
 el("profile-list").innerHTML=state.players.map(p=>'<article class="profile-card"><div><h3>'+esc(p.name)+'</h3><p>DBV-ID: '+esc(/^\d{2}-\d{6}$/.test(p.id)?p.id:"nicht hinterlegt")+'</p>'+(safeUrl(p.url)?'<a href="'+esc(p.url)+'" rel="noopener noreferrer" target="_blank">Offizielles Spielerprofil ↗</a>':"")+'</div><button class="remove-button" data-remove-profile="'+esc(p.id)+'" type="button">Entfernen</button></article>').join("");
 document.querySelectorAll("[data-remove-profile]").forEach(button=>button.addEventListener("click",()=>{
  if(!confirm("Spieler aus dieser App entfernen?"))return;
  const id=button.dataset.removeProfile;
  state.players=state.players.filter(p=>p.id!==id);
  state.officialLinks=state.officialLinks.filter(t=>t.playerId!==id);
  if(state.chosen===id)state.chosen="all";
  save();render();
 }));
}
function render(){
 renderPlayers();
 renderTournaments();
 renderProfiles();
 window.renderHistory?.(state.chosen,state.players);
 const page=["historie","turniere","profil"].includes(state.page)?state.page:"historie";
 document.querySelectorAll(".page").forEach(e=>e.classList.toggle("active",e.id==="view-"+page));
 document.querySelectorAll(".bottom-nav a").forEach(a=>{
  if(a.dataset.page===page)a.setAttribute("aria-current","page");
  else a.removeAttribute("aria-current");
 });
}
let editing=null;
function openTournamentForm(item=null){
 const dialog=el("tournament-dialog");
 const form=el("tournament-form");form.reset();
 editing=item?{id:item.id,playerId:item.playerId}:null;
 const chooser=el("tournament-player");
 chooser.innerHTML='<option value="all">Alle Spieler</option>'+state.players.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join("");
 const defaultPlayer=state.chosen==="all"?"all":state.chosen;
 chooser.value=item?.playerId||defaultPlayer;
 form.elements.name.value=item?.name||"";
 form.elements.url.value=item?.url||"";
 form.elements.startDate.value=item?.startDate||"";
 form.elements.endDate.value=item?.endDate||"";
 el("tournament-dialog-heading").textContent=item?"Turnier bearbeiten":"Turnier anlegen";
 el("tournament-save").textContent=item?"Änderungen speichern":"Turnier speichern";
 dialog.showModal();
}
function setup(){
 restore();save();
 state.page=(location.hash||"#historie").slice(1);
 window.addEventListener("hashchange",()=>{state.page=(location.hash||"#historie").slice(1);render()});
 const playerDialog=el("player-dialog"),playerForm=el("player-form");
 for(const id of ["add-player","add-profile"])el(id).addEventListener("click",()=>playerDialog.showModal());
 el("cancel-dialog").addEventListener("click",()=>playerDialog.close());
 playerForm.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(playerForm);
  const name=String(data.get("name")||"").trim().slice(0,80);
  const id=String(data.get("id")||"").trim()||"local-"+Date.now();
  if(!name||state.players.some(p=>p.id===id)){toast("Name fehlt oder Spieler-ID bereits vorhanden");return}
  state.players.push({id,name,url:safeUrl(data.get("url")||"")});
  save();render();playerDialog.close();playerForm.reset();toast("Spieler gespeichert");
 });
 const tournamentDialog=el("tournament-dialog");
 el("add-tournament").addEventListener("click",()=>openTournamentForm());
 el("cancel-tournament").addEventListener("click",()=>tournamentDialog.close());
 el("tournament-form").addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const parsed=parseDbvTournamentLink(data.get("url"));
  if(!parsed){toast("Bitte eine gültige DBV-Turnier-URL mit Turnier-ID verwenden");return}
  const playerId=String(data.get("playerId")||"all");
  if(playerId!=="all"&&!state.players.some(p=>p.id===playerId)){toast("Spieler nicht gefunden");return}
  const start=String(data.get("startDate")||"");
  const end=String(data.get("endDate")||"");
  if(start&&end&&end<start){toast("Das Enddatum liegt vor dem Beginn");return}
  const bookmark=normalizeBookmark({url:parsed.url,playerId,name:data.get("name"),startDate:start,endDate:end});
  const duplicate=state.officialLinks.some(t=>t.id===bookmark.id&&t.playerId===bookmark.playerId&&(!editing||t.id!==editing.id||t.playerId!==editing.playerId));
  if(duplicate){toast("Das Turnier ist für diesen Spieler bereits gespeichert");return}
  if(editing)state.officialLinks=state.officialLinks.filter(t=>!(t.id===editing.id&&t.playerId===editing.playerId));
  state.officialLinks.unshift(bookmark);
  state.officialLinks=state.officialLinks.slice(0,40);
  editing=null;save();render();tournamentDialog.close();event.currentTarget.reset();toast("Turnier gespeichert");
 });
 render();
 if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
document.addEventListener("DOMContentLoaded",setup);
