"use strict";
/** Schmetterlinge: historical results and official tournament bookmarks; optional verified Supabase match feed. */
const STORE="shuttleboard-v1"; // Preserve existing device favourites.
const DEFAULT_PLAYERS=[
 {id:"05-070879",name:"Philipp Metzger",birthYear:2016,club:"SpVgg Mössingen",url:"https://dbv.turnier.de/player-profile/A7CCCDAE-8A57-4D13-BB2A-5B6084671153"},
 {id:"05-071969",name:"Charlotte Metzger",birthYear:2014,club:"SpVgg Mössingen",url:"https://turniere.badminton.de/ranking"}
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
   // Migrate the original local-only Charlotte profile to her confirmed DBV-ID.
   // Keep any existing user favourites and active profile selection intact.
   const legacyCharlotte=state.players.find(p=>p.id==="local-charlotte"&&p.name==="Charlotte Metzger");
   const officialCharlotte=state.players.find(p=>p.id==="05-071969");
   if(legacyCharlotte){
     if(officialCharlotte){
       state.players=state.players.filter(p=>p!==legacyCharlotte);
     }else{
       legacyCharlotte.id="05-071969";
       legacyCharlotte.birthYear=2014;
       legacyCharlotte.url=legacyCharlotte.url||"https://turniere.badminton.de/ranking";
     }
   }
   const charlotte=state.players.find(p=>p.id==="05-071969");
   if(charlotte){
     charlotte.birthYear=2014;
     if(!charlotte.url)charlotte.url="https://turniere.badminton.de/ranking";
   }
   if(Array.isArray(saved.officialLinks))state.officialLinks=saved.officialLinks.map(normalizeBookmark).filter(Boolean).map(t=>t.playerId==="local-charlotte"?{...t,playerId:"05-071969"}:t).slice(0,40);
   if(Array.isArray(saved.friends))state.friends=saved.friends.filter(p=>p&&/^\d{2}-\d{6}$/.test(p.id)&&typeof p.name==="string"&&p.name.trim()).slice(0,30);
   const preferred=typeof saved.activeProfileId==="string"?saved.activeProfileId:(typeof saved.chosen==="string"?saved.chosen:"");
   const canonicalPreferred=preferred==="local-charlotte"&&state.players.some(p=>p.id==="05-071969")?"05-071969":preferred;
   if(canonicalPreferred!=="all"&&state.players.some(p=>p.id===canonicalPreferred))state.activeProfileId=canonicalPreferred;
   if(!saved.historyProfilesInitialized&&!state.players.some(p=>p.name==="Charlotte Metzger"))
    state.players.push({id:"05-071969",name:"Charlotte Metzger",birthYear:2014,url:"https://turniere.badminton.de/ranking"});
  }
 }catch{}
 // Legacy device profiles retain all favourites; fill only missing known club fields.
 for(const p of state.players){
  if(["05-070879","05-071969"].includes(p.id)&&!p.club)p.club="SpVgg Mössingen";
 }
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
function setActiveProfile(id){
 // Switching to one's own player is a local choice, not an online account login.
 if(!state.players.some(p=>p.id===id))return false;
 state.activeProfileId=id;
 state.viewingFriendId=null;
 state.chosen=id;
 save();
 return true;
}
// The Home action always opens the locally selected own profile, even when already on #start.
function navigateHome(){
 state.viewingFriendId=null;
 state.chosen=state.activeProfileId;
 state.page="start";
 if(location.hash!=="#start")location.hash="#start";
 render();
}
function renderFocusHeader(){
 const p=currentProfile();
 const isFriend=Boolean(state.viewingFriendId);
 const wrap=el("focused-profile");
 if(!p){
  wrap.innerHTML='<span class="focus-profile-avatar">+</span><span class="focus-profile-label">Noch kein Spielerprofil angelegt</span><a href="#einstellungen" class="focus-settings">Einrichten ↗</a>';return;
 }
 let action="";
 if(isFriend){
  action='<button type="button" class="focus-settings" id="back-own">Zu mir zurück</button>';
 }else if(state.players.length>1){
  // Only show the top switcher when there are actually multiple own profiles.
  action='<details class="focus-switcher"><summary aria-label="Spielerprofil wechseln">Wechseln <span aria-hidden="true">⌄</span></summary>'+
   '<div class="focus-switcher-options" aria-label="Eigenes Spielerprofil auswählen">'+
   state.players.map(player=>'<button type="button" data-switch-profile="'+esc(player.id)+'" '+(player.id===state.activeProfileId?'aria-current="true"':'')+'><span class="switcher-avatar">'+esc(player.name.trim().charAt(0).toUpperCase())+'</span><span class="switcher-name">'+esc(player.name)+'</span>'+(player.id===state.activeProfileId?'<span class="switcher-check" aria-label="Aktiv">✓</span>':'')+'</button>').join("")+
   '</div></details>';
 }
 wrap.innerHTML='<div class="focus-profile-avatar">'+esc(p.name.trim().charAt(0).toUpperCase())+'</div>'+
 '<div class="focus-profile-copy"><small>'+(isFriend?"Du folgst":"Mein aktives Spielerprofil")+'</small><strong>'+esc(p.name)+'</strong>'+
 '<span>'+(p.birthYear?"Jahrgang "+esc(p.birthYear)+" · ":"")+(isFriend?"Freund · ":"")+( /^\d{2}-\d{6}$/.test(p.id)?"DBV "+esc(p.id):"Ohne DBV-ID")+'</span>'+
 (p.club?'<span class="focus-club">Verein: '+esc(p.club)+'</span>':"")+'</div>'+action;
 el("back-own")?.addEventListener("click",navigateHome);
 wrap.querySelectorAll("[data-switch-profile]").forEach(button=>button.addEventListener("click",()=>{
  if(!setActiveProfile(button.dataset.switchProfile))return;
  location.hash="#start";
  render();
 }));
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
 return '<article class="profile-card own-profile '+(active?'profile-active':'')+'"><div class="profile-main"><span class="profile-initial">'+esc(p.name.charAt(0).toUpperCase())+'</span><div><h3>'+esc(p.name)+'</h3><p>DBV-ID: '+esc(/^\d{2}-\d{6}$/.test(p.id)?p.id:"nicht hinterlegt")+birth+'</p>'+(p.club?'<p class="profile-club">Verein: '+esc(p.club)+'</p>':"")+(active?'<small class="active-profile-chip">Startprofil</small>':'')+(safeUrl(p.url)?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">DBV-Profil ↗</a>':'')+'</div></div><div class="profile-actions">'+(!active?'<button type="button" class="outline-button" data-set-active="'+esc(p.id)+'">Als Startprofil</button>':'')+'<button type="button" class="remove-button" data-edit-own="'+esc(p.id)+'">Bearbeiten</button><button type="button" class="remove-button" data-remove-profile="'+esc(p.id)+'">Entfernen</button></div></article>';
 }).join(""):'<div class="empty">Noch kein eigenes Spielerprofil hinterlegt.</div>';
 list.querySelectorAll("[data-set-active]").forEach(b=>b.addEventListener("click",()=>{
  if(!setActiveProfile(b.dataset.setActive))return;
  render();toast("Startprofil geändert");
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
function renderFriendQuick(){
 const root=el("dashboard-friends"); if(!root)return;
 if(!state.friends.length){
  root.innerHTML='<a class="friend-quick-add" href="#einstellungen"><span class="friend-quick-add-icon" aria-hidden="true">+</span><span>Freund hinzufügen</span><span aria-hidden="true">↗</span></a>';
  return;
 }
 const own=state.players.find(p=>p.id===state.activeProfileId);
 const links=(state.viewingFriendId&&own?[{...own,isOwn:true}]:[]).concat(state.friends.map(p=>({...p,isOwn:false})));
 root.innerHTML=links.map(p=>'<button type="button" class="friend-quick '+(state.viewingFriendId===p.id?'is-current':'')+'" data-friend-quick="'+esc(p.id)+'" data-is-own="'+(p.isOwn?'true':'false')+'" aria-label="'+esc(p.isOwn?'Zurück zu meinem Startprofil '+p.name:'KPIs von '+p.name)+'"><span class="friend-quick-avatar">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span><span class="friend-quick-name">'+esc(p.isOwn?'Zu mir':p.name.split(" ")[0])+'</span></button>').join("");
 root.querySelectorAll("[data-friend-quick]").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.isOwn==="true"){navigateHome();return;}
  if(state.friends.some(p=>p.id===b.dataset.friendQuick)){state.viewingFriendId=b.dataset.friendQuick;state.chosen=b.dataset.friendQuick;}
  location.hash="#start";render();
 }));
}
function renderFriends(){
 const root=el("friend-list");
 root.innerHTML=state.friends.length?state.friends.map(p=>{
  const selected=state.viewingFriendId===p.id;
  return '<article class="friend-card '+(selected?'friend-selected':'')+'"><button type="button" class="friend-open" data-view-friend="'+esc(p.id)+'"><span class="friend-avatar">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span><span class="friend-details"><strong>'+esc(p.name)+'</strong><small>DBV '+esc(p.id)+(p.birthYear?' · Jahrgang '+esc(p.birthYear):'')+'</small><em>Haupt-KPIs ansehen ↗</em></span></button><span class="friend-actions"><button type="button" class="remove-button" data-edit-friend="'+esc(p.id)+'">Bearbeiten</button><button type="button" class="remove-button friend-remove" data-unfollow="'+esc(p.id)+'" aria-label="'+esc(p.name)+' nicht mehr folgen">Entfolgen</button></span></article>';
 }).join(""):'<div class="empty friends-empty">Du folgst noch niemandem. Suche oben nach einem Namen und tippe auf „+ Folgen“.</div>';
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
// The verified shared DBV roster is public; following a player is only local.
if(typeof window!=="undefined"){
window.badmintonLibraryGetState=()=>({
 own:state.players.map(p=>p.id),
 following:state.friends.map(p=>p.id)
});
window.badmintonLibraryToggleFollow=player=>{
 const id=String(player?.id||"");
 if(!/^\d{2}-\d{6}$/.test(id)||!String(player?.name||"").trim())return {ok:false,message:"Kein bestätigtes DBV-Spielerprofil."};
 if(state.players.some(p=>p.id===id))return {ok:false,message:"Dieser Spieler ist bereits dein eigenes Profil."};
 const exists=state.friends.some(p=>p.id===id);
 if(exists){
  state.friends=state.friends.filter(p=>p.id!==id);
  if(state.viewingFriendId===id){state.viewingFriendId=null;state.chosen=state.activeProfileId;}
  save();render();
  return {ok:true,message:"Spieler entfolgt."};
 }
 if(state.friends.length>=30)return {ok:false,message:"Es können aktuell höchstens 30 Spieler gleichzeitig gefolgt werden."};
 state.friends.push({
  id,name:String(player.name).trim().slice(0,80),
  birthYear:Number.isInteger(player.birthYear)?player.birthYear:undefined,
  club:String(player.club||"").slice(0,120),url:""
 });
 save();render();
 return {ok:true,message:"Spieler zu deiner Liste hinzugefügt."};
};
window.badmintonLibraryView=id=>{
 if(!state.friends.some(p=>p.id===id))return false;
 state.viewingFriendId=id;state.chosen=id;
 location.hash="#start";render();
 return true;
};
}
function render(){
 renderFocusHeader();
 renderTournaments();
 renderProfiles();
 renderFriends();
 renderFriendQuick();
 state.chosen=state.viewingFriendId||state.activeProfileId;
 const viewedProfiles=[...state.players,...state.friends];
 window.renderDashboard?.(state.chosen,viewedProfiles,state.viewingFriendId?[]:state.officialLinks,{mode:state.viewingFriendId?"friend":"own"});
 window.renderHistory?.(state.chosen,viewedProfiles,{mode:state.viewingFriendId?"friend":"own"});
 // Read-only live viewer follows whichever public DBV profile is currently shown.
 window.badmintonActivePlayerId=state.chosen;
 window.badmintonActiveClub=(currentProfile()?.club||"");
 window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId:state.chosen,club:window.badmintonActiveClub}}));
 window.dispatchEvent(new CustomEvent("badminton:friends-changed"));
 const page=["start","historie","turniere","berichte","spieler","einstellungen"].includes(state.page)?state.page:"start";
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
 let freshDevice=false;
 try{freshDevice=!localStorage.getItem(STORE)}catch{}
 restore();save();
 state.page=(location.hash||"#start").slice(1);
 // Native anchor routing alone retains the viewed friend's profile. Home must reset it,
 // including a second tap while #start is already the active hash.
 document.querySelectorAll('.bottom-nav a[data-page="start"], .topbar .brand[href="#start"]').forEach(link=>{
  link.addEventListener("click",event=>{event.preventDefault();navigateHome()});
 });
 window.addEventListener("hashchange",()=>{state.page=(location.hash||"#start").slice(1);render()});
 const playerDialog=el("player-dialog"),playerForm=el("player-form");
 let editingPlayerId=null,activatingNewProfile=false;
 function openPlayerForm(p=null){
  editingPlayerId=p?.id||null;
  playerForm.reset();
  playerForm.elements.namedItem("name").value=p?.name||"";
  playerForm.elements.namedItem("id").value=(p&&/^\d{2}-\d{6}$/.test(p.id))?p.id:"";
  playerForm.elements.namedItem("id").readOnly=Boolean(p);
  playerForm.elements.namedItem("birthYear").value=p?.birthYear||"";
  playerForm.elements.namedItem("club").value=p?.club||"";
  playerForm.elements.namedItem("url").value=p?.url||"";
  playerDialog.showModal();
 }
 window.openPlayerForm=openPlayerForm;
 el("add-player").addEventListener("click",()=>openPlayerForm());
 el("cancel-dialog").addEventListener("click",()=>{
  playerDialog.close();
  if(activatingNewProfile){activatingNewProfile=false;el("first-run-dialog").showModal();}
 });
 playerForm.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(playerForm);
  const name=String(data.get("name")||"").trim().slice(0,80);
  const id=editingPlayerId||String(data.get("id")||"").trim()||"local-"+Date.now();
  const birth=Number(data.get("birthYear"));
  if(!name||(!editingPlayerId&&state.players.some(p=>p.id===id))){toast("Name fehlt oder Spieler-ID bereits vorhanden");return}
  const club=String(data.get("club")||"").trim().slice(0,120);
  const record={id,name,birthYear:birth>=2000&&birth<=2035?birth:undefined,club,url:safeUrl(data.get("url")||"")};
  if(editingPlayerId)state.players=state.players.map(p=>p.id===editingPlayerId?record:p);
  else{
   if(state.friends.some(p=>p.id===id)){toast("Diese Spieler-ID ist bereits ein Freund");return}
   state.players.push(record);
   if(activatingNewProfile||!state.activeProfileId)state.activeProfileId=id;
   if(activatingNewProfile){state.viewingFriendId=null;state.chosen=id;location.hash="#start";}
   activatingNewProfile=false;
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
  friendForm.elements.namedItem("club").value=p?.club||"";
  friendForm.elements.namedItem("url").value=p?.url||"";
  friendDialog.showModal();
 }
 window.openFriendForm=openFriendForm;
 el("add-friend").addEventListener("click",()=>{
  const input=el("friend-search");input?.focus();input?.scrollIntoView({block:"center",behavior:"smooth"});
 });
 el("add-friend-manual").addEventListener("click",()=>openFriendForm());
 el("dashboard-add-friend").addEventListener("click",()=>{
  setTimeout(()=>{const input=el("friend-search");input?.focus();input?.scrollIntoView({block:"center",behavior:"smooth"});},0);
 });
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
  const friend={id,name,birthYear:birth>=2000&&birth<=2035?birth:undefined,club:String(data.get("club")||"").trim().slice(0,120),url:profileUrl};
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
 if(freshDevice){
  const welcome=el("first-run-dialog");
  const chooser=el("first-run-choices");
  chooser.innerHTML=state.players.map(p=>'<button class="first-run-choice" type="button" data-initial-player="'+esc(p.id)+'"><span>'+esc(p.name.charAt(0).toUpperCase())+'</span><strong>'+esc(p.name)+'</strong><span aria-hidden="true">›</span></button>').join("");
  chooser.querySelectorAll("[data-initial-player]").forEach(b=>b.addEventListener("click",()=>{
   state.activeProfileId=b.dataset.initialPlayer;
   state.viewingFriendId=null;state.chosen=state.activeProfileId;save();
   welcome.close();location.hash="#start";render();
  }));
  el("first-run-new").addEventListener("click",()=>{
   welcome.close();activatingNewProfile=true;openPlayerForm();
  });
  welcome.showModal();
 }
 if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
document.addEventListener("DOMContentLoaded",setup);
