"use strict";
/** Schmetterlinge: historical results and official tournament bookmarks. No live-result polling. */
const STORE="shuttleboard-v1"; // Preserve existing device favourites.
const DEFAULT_PLAYERS=[
 {id:"05-070879",name:"Philipp Metzger",birthYear:2016,url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
 {id:"local-charlotte",name:"Charlotte Metzger",url:""}
];
const state={players:DEFAULT_PLAYERS.map(p=>({...p})),friends:[],officialLinks:[],activeProfileId:"05-070879",viewingFriendId:null,chosen:"05-070879",page:"start"};
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
   const philipp=state.players.find(p=>p.id==="05-070879"); if(philipp&&!philipp.birthYear)philipp.birthYear=2016;
   if(Array.isArray(saved.officialLinks))state.officialLinks=saved.officialLinks.map(normalizeBookmark).filter(Boolean).slice(0,40);
   if(Array.isArray(saved.friends))state.friends=saved.friends.filter(p=>p&&/^\d{2}-\d{6}$/.test(p.id)&&typeof p.name==="string"&&p.name.trim()).slice(0,30);
   const preferred=typeof saved.activeProfileId==="string"?saved.activeProfileId:(typeof saved.chosen==="string"?saved.chosen:"");
   if(preferred!=="all"&&state.players.some(p=>p.id===preferred))state.activeProfileId=preferred;
   if(!saved.historyProfilesInitialized&&!state.players.some(p=>p.name==="Charlotte Metzger"))
    state.players.push({id:"local-charlotte",name:"Charlotte Metzger",url:""});
  }
 }catch{}
 if(!state.players.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.players[0]?.id||"";
 state.friends=state.friends.filter(p=>!state.players.some(own=>own.id===p.id));
 state.chosen=state.activeProfileId;
}
function save(){
 try{localStorage.setItem(STORE,JSON.stringify({players:state.players,friends:state.friends,officialLinks:state.officialLinks,activeProfileId:state.activeProfileId,chosen:state.activeProfileId,historyProfilesInitialized:true}))}catch{}
}
let toastTimer;
function toast(message){const node=el("toast");node.textContent=message;node.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("visible"),2800)}
function selectedLinks(){if(state.viewingFriendId)return [];return state.officialLinks.filter(t=>t.playerId==="all"||t.playerId===state.activeProfileId)}
function bookmarkPhase(t){
 if(!t.startDate)return ["Termin offen","unknown"];
 const today=localDay();
 if(today<t.startDate)return ["Bevorstehend","future"];
 const end=t.endDate&&t.endDate>=t.startDate?t.endDate:t.startDate;
 if(today>end)return ["Vergangen","past"];
 return ["Turniertag","today"];
}
function currentProfile(){
 return state.viewingFriendId?state.friends.find(p=>p.id===state.viewingFriendId):state.players.find(p=>p.id===state.activeProfileId);
}
function renderFocusHeader(){
 const p=currentProfile();
 const isFriend=Boolean(state.viewingFriendId);
 const wrap=el("focused-profile");
 if(!p){
  wrap.innerHTML='<span class="focus-profile-avatar">+</span><span class="focus-profile-label">Noch kein Spielerprofil angelegt</span><a href="#einstellungen" class="focus-settings">Einrichten ↗</a>';return;
 }
 wrap.innerHTML='<div class="focus-profile-avatar">'+esc(p.name.trim().charAt(0).toUpperCase())+'</div>'+
 '<div class="focus-profile-copy"><small>'+(isFriend?"Du folgst":"Mein aktives Spielerprofil")+'</small><strong>'+esc(p.name)+'</strong>'+
 '<span>'+(p.birthYear?"Jahrgang "+esc(p.birthYear)+" · ":"")+(isFriend?"Freund · ":"")+( /^\d{2}-\d{6}$/.test(p.id)?"DBV "+esc(p.id):"Ohne DBV-ID")+'</span></div>'+
 (isFriend?'<button type="button" class="focus-settings" id="back-own">Zu mir zurück</button>':'<a class="focus-settings" href="#einstellungen">Wechseln <span aria-hidden="true">↗</span></a>');
 el("back-own")?.addEventListener("click",()=>{state.viewingFriendId=null;state.chosen=state.activeProfileId;save();location.hash="#start";render()});
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
 const list=el("profile-list");
 list.innerHTML=state.players.length?state.players.map(p=>{
 const active=state.activeProfileId===p.id;
 const birth=p.birthYear?" · Jg. "+esc(p.birthYear):"";
 return '<article class="profile-card own-profile '+(active?'profile-active':'')+'"><div class="profile-main"><span class="profile-initial">'+esc(p.name.charAt(0).toUpperCase())+'</span><div><h3>'+esc(p.name)+'</h3><p>DBV-ID: '+esc(/^\d{2}-\d{6}$/.test(p.id)?p.id:"nicht hinterlegt")+birth+'</p>'+(active?'<small class="active-profile-chip">Startprofil</small>':'')+(safeUrl(p.url)?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">DBV-Profil ↗</a>':'')+'</div></div><div class="profile-actions">'+(!active?'<button type="button" class="outline-button" data-set-active="'+esc(p.id)+'">Als Startprofil</button>':'')+'<button type="button" class="remove-button" data-edit-own="'+esc(p.id)+'">Bearbeiten</button><button type="button" class="remove-button" data-remove-profile="'+esc(p.id)+'">Entfernen</button></div></article>';
 }).join(""):'<div class="empty">Noch kein eigenes Spielerprofil hinterlegt.</div>';
 list.querySelectorAll("[data-set-active]").forEach(b=>b.addEventListener("click",()=>{
  state.activeProfileId=b.dataset.setActive;state.viewingFriendId=null;state.chosen=state.activeProfileId;save();render();toast("Startprofil geändert");
 }));
 list.querySelectorAll("[data-edit-own]").forEach(b=>b.addEventListener("click",()=>{
  const p=state.players.find(x=>x.id===b.dataset.editOwn);
  if(p)window.openPlayerForm?.(p);
 }));
 list.querySelectorAll("[data-remove-profile]").forEach(b=>b.addEventListener("click",()=>{
  const id=b.dataset.removeProfile;
  if(!confirm("Dieses eigene Spielerprofil auf diesem Gerät entfernen?"))return;
  state.players=state.players.filter(p=>p.id!==id);
  state.officialLinks=state.officialLinks.filter(t=>t.playerId!==id);
  if(state.activeProfileId===id)state.activeProfileId=state.players[0]?.id||"";
  if(!state.viewingFriendId)state.chosen=state.activeProfileId;
  save();render();
 }));
 el("current-account-label").textContent="Aktives Startprofil: "+(state.players.find(p=>p.id===state.activeProfileId)?.name||"noch keines");
}
function renderFriends(){
 const root=el("friend-list");
 root.innerHTML=state.friends.length?state.friends.map(p=>{
  const selected=state.viewingFriendId===p.id;
  return '<article class="friend-card '+(selected?'friend-selected':'')+'"><button type="button" class="friend-open" data-view-friend="'+esc(p.id)+'"><span class="friend-avatar">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span><span class="friend-details"><strong>'+esc(p.name)+'</strong><small>DBV '+esc(p.id)+(p.birthYear?' · Jahrgang '+esc(p.birthYear):'')+'</small><em>Haupt-KPIs ansehen ↗</em></span></button><span class="friend-actions"><button type="button" class="remove-button" data-edit-friend="'+esc(p.id)+'">Bearbeiten</button><button type="button" class="remove-button friend-remove" data-unfollow="'+esc(p.id)+'" aria-label="'+esc(p.name)+' nicht mehr folgen">Entfolgen</button></span></article>';
 }).join(""):'<div class="empty friends-empty">Du folgst noch niemandem. Füge einen Freund über seine DBV-ID hinzu.</div>';
 root.querySelectorAll("[data-view-friend]").forEach(b=>b.addEventListener("click",()=>{
  const friend=state.friends.find(p=>p.id===b.dataset.viewFriend);
  if(!friend)return;
  state.viewingFriendId=friend.id;state.chosen=friend.id;
  location.hash="#start";render();
 }));
 root.querySelectorAll("[data-edit-friend]").forEach(b=>b.addEventListener("click",()=>window.openFriendForm?.(state.friends.find(p=>p.id===b.dataset.editFriend))));
 root.querySelectorAll("[data-unfollow]").forEach(b=>b.addEventListener("click",()=>{
  state.friends=state.friends.filter(p=>p.id!==b.dataset.unfollow);
  if(state.viewingFriendId===b.dataset.unfollow){state.viewingFriendId=null;state.chosen=state.activeProfileId;}
  save();render();toast("Freund entfernt");
 }));
}
function render(){
 renderFocusHeader();
 renderTournaments();
 renderProfiles();
 renderFriends();
 state.chosen=state.viewingFriendId||state.activeProfileId;
 const viewedProfiles=[...state.players,...state.friends];
 window.renderDashboard?.(state.chosen,viewedProfiles,state.viewingFriendId?[]:state.officialLinks,{mode:state.viewingFriendId?"friend":"own"});
 window.renderHistory?.(state.chosen,viewedProfiles,{mode:state.viewingFriendId?"friend":"own"});
 const page=["start","historie","turniere","einstellungen"].includes(state.page)?state.page:"start";
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
 const defaultPlayer=state.activeProfileId||"all";
 chooser.value=item?.playerId||defaultPlayer;
 form.elements.namedItem("name").value=item?.name||"";
 form.elements.namedItem("url").value=item?.url||"";
 form.elements.namedItem("startDate").value=item?.startDate||"";
 form.elements.namedItem("endDate").value=item?.endDate||"";
 el("tournament-dialog-heading").textContent=item?"Turnier bearbeiten":"Turnier anlegen";
 el("tournament-save").textContent=item?"Änderungen speichern":"Turnier speichern";
 dialog.showModal();
}
function setup(){
 restore();save();
 state.page=(location.hash||"#start").slice(1);
 window.addEventListener("hashchange",()=>{state.page=(location.hash||"#start").slice(1);render()});
 const playerDialog=el("player-dialog"),playerForm=el("player-form");
 let editingPlayerId=null;
 function openPlayerForm(p=null){
  editingPlayerId=p?.id||null;
  playerForm.reset();
  playerForm.elements.namedItem("name").value=p?.name||"";
  playerForm.elements.namedItem("id").value=(p&&/^\d{2}-\d{6}$/.test(p.id))?p.id:"";
  playerForm.elements.namedItem("id").readOnly=Boolean(p);
  playerForm.elements.namedItem("birthYear").value=p?.birthYear||"";
  playerForm.elements.namedItem("url").value=p?.url||"";
  playerDialog.showModal();
 }
 window.openPlayerForm=openPlayerForm;
 el("add-player").addEventListener("click",()=>openPlayerForm());
 el("cancel-dialog").addEventListener("click",()=>playerDialog.close());
 playerForm.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(playerForm);
  const name=String(data.get("name")||"").trim().slice(0,80);
  const id=editingPlayerId||String(data.get("id")||"").trim()||"local-"+Date.now();
  const birth=Number(data.get("birthYear"));
  if(!name||(!editingPlayerId&&state.players.some(p=>p.id===id))){toast("Name fehlt oder Spieler-ID bereits vorhanden");return}
  const record={id,name,birthYear:birth>=2000&&birth<=2035?birth:undefined,url:safeUrl(data.get("url")||"")};
  if(editingPlayerId)state.players=state.players.map(p=>p.id===editingPlayerId?record:p);
  else{
   if(state.friends.some(p=>p.id===id)){toast("Diese Spieler-ID ist bereits ein Freund");return}
   state.players.push(record);
   if(!state.activeProfileId)state.activeProfileId=id;
  }
  editingPlayerId=null;
  save();render();playerDialog.close();playerForm.reset();toast("Spielerprofil gespeichert");
 });
 const friendDialog=el("friend-dialog"),friendForm=el("friend-form");
 let editingFriendId=null;
 function openFriendForm(p=null){
  editingFriendId=p?.id||null;
  friendForm.reset();
  friendForm.elements.namedItem("name").value=p?.name||"";
  friendForm.elements.namedItem("id").value=p?.id||"";
  friendForm.elements.namedItem("id").readOnly=Boolean(p);
  friendForm.elements.namedItem("birthYear").value=p?.birthYear||"";
  friendForm.elements.namedItem("url").value=p?.url||"";
  friendDialog.showModal();
 }
 window.openFriendForm=openFriendForm;
 el("add-friend").addEventListener("click",()=>openFriendForm());
 el("cancel-friend").addEventListener("click",()=>friendDialog.close());
 friendForm.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(friendForm);
  const name=String(data.get("name")||"").trim().slice(0,80);
  const id=String(data.get("id")||"").trim();
  const birth=Number(data.get("birthYear"));
  if(!name||!/^\d{2}-\d{6}$/.test(id)){toast("Name und gültige DBV-ID erforderlich");return}
  if((!editingFriendId&&state.friends.some(p=>p.id===id))||state.players.some(p=>p.id===id)){toast("Dieser Spieler ist bereits gespeichert");return}
  if(!editingFriendId&&state.friends.length>=30){toast("Maximal 30 Freunde");return}
  const profileUrl=safeUrl(data.get("url")||"");
  const friend={id,name,birthYear:birth>=2000&&birth<=2035?birth:undefined,url:profileUrl};
  if(editingFriendId)state.friends=state.friends.map(p=>p.id===editingFriendId?friend:p);
  else state.friends.push(friend);
  editingFriendId=null;
  save();render();friendDialog.close();friendForm.reset();toast("Freund gespeichert");
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
