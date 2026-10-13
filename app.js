"use strict";
/** Schmetterlinge: historical results and official tournament bookmarks; optional verified Supabase match feed. */
const STORE=SchmetterlingeStorage.STORE; // The device key is unchanged.
// No personal family profile is bundled in the publicly delivered app.
const state={players:[],friends:[],officialLinks:[],activeProfileId:"",viewingFriendId:null,chosen:"",page:"start"};
const el=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=x=>{try{const u=new URL(String(x));return u.protocol==="https:"?u.href:""}catch{return ""}};
// Preserve established local UI/test entry points while moving pure business rules.
function parseDbvTournamentLink(value){return SchmetterlingeBookmarks.parseDbvTournamentLink(value)}
function normalizeBookmark(value){return SchmetterlingeBookmarks.normalizeBookmark(value)}
const localDay=()=>SchmetterlingeBookmarks.localDay();
const niceDay=value=>SchmetterlingeBookmarks.niceDay(value);
// Keep the legacy function names for UI callers and existing integrations.
function restore(){SchmetterlingeStorage.restore(state,normalizeBookmark)}
function save(){SchmetterlingeStorage.save(state)}
let toastTimer;
function toast(message){const node=el("toast");node.textContent=message;node.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("visible"),2800)}
function selectedLinks(){return SchmetterlingeBookmarks.visible(state)}
function bookmarkPhase(t){return SchmetterlingeBookmarks.phase(t)}
function currentProfile(){
 return state.viewingFriendId?state.friends.find(p=>p.id===state.viewingFriendId):state.players.find(p=>p.id===state.activeProfileId);
}
function setActiveProfile(id){
 // Switching to one's own player is a local choice, not an online account login.
 if(!SchmetterlingeStorage.selectOwn(state,id))return false;
 save();
 return true;
}
// The Home action always opens the locally selected own profile, even when already on #start.
// Existing UI callers keep the same route and focus methods.
function routeTo(page){SchmetterlingeRouter.routeTo(state,page,render)}
function focusCurrentView(){SchmetterlingeRouter.focusCurrentView(state)}
function navigateHome(){
 if(!state.players.length&&state.friends.length)
  SchmetterlingeStorage.selectFriend(state,state.friends[0].id);
 else SchmetterlingeStorage.showOwn(state);
 routeTo("start");
}
function renderFocusHeader(){
 const p=currentProfile();
 const isFriend=Boolean(state.viewingFriendId);
 const wrap=el("focused-profile");
 if(!p){
  wrap.innerHTML='<span class="focus-profile-avatar">+</span><span class="focus-profile-label">Noch kein Spielerprofil angelegt</span><a href="#spieler" class="focus-settings">Einrichten ↗</a>';return;
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
  window.badmintonSelectViewer(button.dataset.switchProfile);
 }));
}
function renderTournaments(){
 const sorted=SchmetterlingeBookmarks.sorted(state);
 const section=el("official-tournament-list");
 if(!sorted.length){section.innerHTML='<div class="empty"><h3>Noch keine Turniere gespeichert</h3><p>Merke ein Turnier mit + aus dem DBV-Kalender vor oder füge einen offiziellen Turnierlink hinzu.</p></div>';return}
 section.innerHTML=sorted.map(t=>{
  const profile=t.playerId==="all"?"Alle Spieler":(state.players.find(p=>p.id===t.playerId)?.name||"Spieler");
  const [phase,tone]=bookmarkPhase(t);
  const dates=t.startDate?niceDay(t.startDate)+(t.endDate&&t.endDate!==t.startDate?" – "+niceDay(t.endDate):""):"Termin nicht hinterlegt";
  const calendar=t.source==="dbv-calendar";
  return '<article class="tournament-card"><div class="saved-tournament-top"><h3>'+esc(t.name)+'</h3><span class="saved-tournament-phase phase-'+tone+'">'+esc(phase)+'</span></div><p>'+esc(profile)+' · '+esc(dates)+'</p><p class="saved-tournament-id">'+(calendar?'Vorgemerkt · Anmeldung nicht bestätigt':'Turnier-ID: '+esc(t.id))+'</p><div class="local-shortcut-actions"><a href="'+esc(t.url)+'" rel="noopener noreferrer" target="_blank">'+(calendar?'DBV-Kalender öffnen ↗':'Offizielle Turnierseite ↗')+'</a>'+(calendar?'':'<button class="remove-button" data-edit-id="'+esc(t.id)+'" data-edit-player="'+esc(t.playerId)+'" type="button">Bearbeiten</button>')+'<button class="remove-button" data-private-invite-id="'+esc(t.id)+'" data-private-invite-player="'+esc(t.playerId)+'" type="button">Privat teilen</button><button class="remove-button" data-remove-id="'+esc(t.id)+'" data-remove-player="'+esc(t.playerId)+'" type="button">Entfernen</button></div></article>';
 }).join("");
 section.querySelectorAll("[data-edit-id]").forEach(button=>button.addEventListener("click",()=>{
  const item=state.officialLinks.find(t=>t.id===button.dataset.editId&&t.playerId===button.dataset.editPlayer);
  if(item)openTournamentForm(item);
 }));
 section.querySelectorAll("[data-private-invite-id]").forEach(button=>button.addEventListener("click",()=>{
  const item=state.officialLinks.find(t=>t.id===button.dataset.privateInviteId&&t.playerId===button.dataset.privateInvitePlayer);
  if(item)window.dispatchEvent(new CustomEvent("badminton:private-invite",{detail:{bookmark:item}}));
 }));
 section.querySelectorAll("[data-remove-id]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.removeId,player=button.dataset.removePlayer;
  const removed=state.officialLinks.find(t=>t.id===id&&t.playerId===player);
  if(removed&&window.badmintonPrivateInvite?.hasActive(removed)){
   toast("Zuerst den privaten Einladungslink widerrufen.");
   window.dispatchEvent(new CustomEvent("badminton:private-invite",{detail:{bookmark:removed}}));
   return;
  }
  state.officialLinks=state.officialLinks.filter(t=>!(t.id===id&&t.playerId===player));
  save();render();toast(removed?.source==="dbv-calendar"?"Vormerkung entfernt":"Turnierlink entfernt");
  if(removed&&removed.source!=="dbv-calendar")window.dispatchEvent(new CustomEvent("badminton:share-tournament",{
   detail:{bookmark:removed,publicShare:false,removed:true}
  }));
 }));
}
function renderProfiles(){
 const list=el("profile-list");
 list.innerHTML=state.players.length?state.players.map(p=>{
 const active=state.activeProfileId===p.id;
 const birth=p.birthYear?" · Jg. "+esc(p.birthYear):"";
 return '<article class="profile-card own-profile '+(active?'profile-active':'')+'"><div class="profile-main"><span class="profile-initial">'+esc(p.name.charAt(0).toUpperCase())+'</span><div><h3>'+esc(p.name)+'</h3><p>DBV-ID: '+esc(/^\d{2}-\d{6}$/.test(p.id)?p.id:"nicht hinterlegt")+birth+'</p>'+(p.club?'<p class="profile-club">Verein: '+esc(p.club)+'</p>':"")+(active?'<small class="active-profile-chip">Startprofil</small>':'')+(safeUrl(p.url)?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">DBV-Profil ↗</a>':'')+'</div></div><div class="profile-actions">'+(!active?'<button type="button" class="outline-button" data-set-active="'+esc(p.id)+'">Als Startprofil</button>':'')+'<button type="button" class="remove-button" data-edit-own="'+esc(p.id)+'">Bearbeiten</button>'+(/^\d{2}-\d{6}$/.test(p.id)?'<button type="button" class="outline-button" data-share-player="'+esc(p.id)+'">Profil privat teilen</button>':'')+'<button type="button" class="remove-button" data-remove-profile="'+esc(p.id)+'">Entfernen</button></div></article>';
 }).join(""):'<div class="empty">Noch kein eigenes Spielerprofil hinterlegt.</div>';
 list.querySelectorAll("[data-set-active]").forEach(b=>b.addEventListener("click",()=>{
  if(!setActiveProfile(b.dataset.setActive))return;
  render();toast("Startprofil geändert");
 }));
 list.querySelectorAll("[data-edit-own]").forEach(b=>b.addEventListener("click",()=>{
  const p=state.players.find(x=>x.id===b.dataset.editOwn);
  if(p)window.openPlayerForm?.(p);
 }));
 list.querySelectorAll("[data-share-player]").forEach(b=>b.addEventListener("click",()=>{
  const player=state.players.find(p=>p.id===b.dataset.sharePlayer);
  if(player)window.dispatchEvent(new CustomEvent("badminton:player-private-share",{detail:{player}}));
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
 const preview=el("player-own-preview");
 if(preview){
  const p=state.players.find(p=>p.id===state.activeProfileId);
  preview.innerHTML=p?'<button type="button" class="friend-follow-item is-own" id="player-own-open"><span class="friend-avatar" aria-hidden="true">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span><span class="friend-details"><strong>'+esc(p.name)+'</strong><small>Startprofil · '+esc(p.id.startsWith("local-")?"ohne DBV-ID":"DBV "+p.id)+'</small></span><span class="follow-item-arrow" aria-hidden="true">›</span></button>':'<a class="friend-quick-add" href="#einstellungen">Eigenes Spielerprofil einrichten ↗</a>';
  preview.querySelector("#player-own-open")?.addEventListener("click",()=>window.badmintonSelectViewer(p.id));
 }
 el("current-account-label").textContent="Aktives Startprofil: "+(state.players.find(p=>p.id===state.activeProfileId)?.name||"noch keines");
}
function renderFriendQuick(){
 const root=el("dashboard-friends");if(!root)return;
 const manage=el("dashboard-friends-manage");
 if(manage)manage.hidden=!state.friends.length;
 if(!state.friends.length){
  root.innerHTML='<a class="friend-quick-add" href="#spieler"><span class="friend-quick-add-icon" aria-hidden="true">+</span><span>Spieler suchen und folgen</span><span aria-hidden="true">↗</span></a>';
  return;
 }
 // Home is a quick overview, not a second complete friend-management screen.
 // Never hide friends off-screen in a horizontal strip; keep at most three
 // visible shortcuts, plus one explicit route to the full player list.
 const own=state.players.find(p=>p.id===state.activeProfileId);
 const includeOwn=Boolean(state.viewingFriendId&&own);
 const slots=includeOwn?2:3;
 const visibleFriends=state.friends.slice(0,slots);
 // While viewing a followed player's statistics, keep that player visible
 // even when the player is outside the first preview slots.
 if(state.viewingFriendId&&!visibleFriends.some(p=>p.id===state.viewingFriendId)){
  const selected=state.friends.find(p=>p.id===state.viewingFriendId);
  if(selected&&visibleFriends.length)visibleFriends[visibleFriends.length-1]=selected;
 }
 const links=(includeOwn?[{...own,isOwn:true}]:[])
  .concat(visibleFriends.map(p=>({...p,isOwn:false})));
 const remaining=state.friends.length-visibleFriends.length;
 root.innerHTML=links.map(p=>
  '<button type="button" class="friend-quick'+(state.viewingFriendId===p.id?' is-current':'')+
  '" data-friend-quick="'+esc(p.id)+'" data-is-own="'+(p.isOwn?'true':'false')+
  '" aria-label="'+esc(p.isOwn?'Zu meinem Startprofil zurückkehren':'KPIs von '+p.name+' ansehen')+
  '" title="'+esc(p.name)+'"'+(state.viewingFriendId===p.id?' aria-current="true"':'')+'>'+
  '<span class="friend-quick-avatar" aria-hidden="true">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span>'+
  '<span class="friend-quick-name">'+esc(p.isOwn?'Zu mir':p.name.trim().split(/\s+/)[0])+'</span></button>'
 ).join("")+(remaining>0?
  '<a class="friend-quick-more" href="#spieler" aria-label="'+remaining+' weitere Freunde ansehen">'+
   '<span class="friend-quick-avatar friend-quick-more-icon" aria-hidden="true">···</span>'+
   '<span class="friend-quick-name">+'+remaining+' weitere</span></a>':"");
 root.querySelectorAll("[data-friend-quick]").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.isOwn==="true"){navigateHome();return;}
  window.badmintonSelectViewer(b.dataset.friendQuick);
 }));
}
function renderFriends(){
 const root=el("friend-list"),settings=el("friend-settings-list");
 if(root){
  root.innerHTML=state.friends.length?state.friends.map(p=>{
   const current=state.viewingFriendId===p.id;
   return '<button type="button" class="friend-follow-item'+(current?' is-current':'')+'" data-view-friend="'+esc(p.id)+'">'+
    '<span class="friend-avatar" aria-hidden="true">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span>'+
    '<span class="friend-details"><strong>'+esc(p.name)+'</strong><small>DBV '+esc(p.id)+(p.club?' · '+esc(p.club):'')+'</small></span>'+
    '<span class="follow-item-arrow" aria-hidden="true">›</span></button>';
  }).join(""):'<p class="team-empty">Du folgst noch keinen Spielern. Mit „+ Hinzufügen“ kannst du Spieler suchen.</p>';
  root.querySelectorAll("[data-view-friend]").forEach(b=>b.addEventListener("click",()=>window.badmintonSelectViewer(b.dataset.viewFriend)));
 }
 if(!settings)return;
 settings.innerHTML=state.friends.length?state.friends.map((p,i)=>
  '<article class="follow-manage-item"><div class="follow-manage-label"><strong>'+esc(p.name)+'</strong><small>DBV '+esc(p.id)+'</small></div>'+
  '<div class="follow-manage-actions"><button type="button" data-friend-move="'+esc(p.id)+'" data-direction="-1" '+(i===0?'disabled':'')+' aria-label="'+esc(p.name)+' nach oben">↑</button>'+
  '<button type="button" data-friend-move="'+esc(p.id)+'" data-direction="1" '+(i===state.friends.length-1?'disabled':'')+' aria-label="'+esc(p.name)+' nach unten">↓</button>'+
  '<button type="button" data-edit-friend="'+esc(p.id)+'" aria-label="'+esc(p.name)+' bearbeiten">Bearbeiten</button>'+
  '<button type="button" data-unfollow="'+esc(p.id)+'" aria-label="'+esc(p.name)+' nicht mehr folgen">Entfolgen</button></div></article>'
 ).join(""):'<p class="team-empty">Noch keine Spieler abonniert.</p>';
 settings.querySelectorAll("[data-friend-move]").forEach(b=>b.addEventListener("click",()=>{
  const index=state.friends.findIndex(p=>p.id===b.dataset.friendMove);
  const target=index+Number(b.dataset.direction);
  if(index<0||target<0||target>=state.friends.length)return;
  const [friend]=state.friends.splice(index,1);
  state.friends.splice(target,0,friend);save();render();
 }));
 settings.querySelectorAll("[data-edit-friend]").forEach(b=>b.addEventListener("click",()=>window.openFriendForm?.(state.friends.find(p=>p.id===b.dataset.editFriend))));
 settings.querySelectorAll("[data-unfollow]").forEach(b=>b.addEventListener("click",()=>{
  if(!SchmetterlingeStorage.unfollow(state,b.dataset.unfollow))return;
  save();render();window.dispatchEvent(new Event("badminton:library-following"));toast("Spieler entfolgt");
 }));
}
function showPlayerDiscover(open=true,focus=true){
 const panel=el("player-discover"),trigger=el("player-add-open");
 if(!panel||!trigger)return;
 panel.hidden=!open;
 trigger.setAttribute("aria-expanded",String(open));
 trigger.textContent=open?"Suche schließen":"+ Hinzufügen";
 if(open&&focus){
  if(location.hash!=="#spieler")location.hash="#spieler";
  requestAnimationFrame(()=>{
   panel.scrollIntoView({block:"start",behavior:"smooth"});
   el("library-search")?.focus({preventScroll:true});
  });
 }
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
  SchmetterlingeStorage.unfollow(state,id);
  save();render();window.dispatchEvent(new Event("badminton:library-following"));
  return {ok:true,message:"Spieler entfolgt."};
 }
 if(state.friends.length>=30)return {ok:false,message:"Es können aktuell höchstens 30 Spieler gleichzeitig gefolgt werden."};
 state.friends.unshift({
  id,name:String(player.name).trim().slice(0,80),
  birthYear:Number.isInteger(player.birthYear)?player.birthYear:undefined,
  club:String(player.club||"").slice(0,120),url:""
 });
 showPlayerDiscover(false,false);save();render();window.dispatchEvent(new Event("badminton:library-following"));
 window.dispatchEvent(new CustomEvent("badminton:friend-followed",{detail:{playerId:id}}));
 return {ok:true,message:"Spieler zu deiner Liste hinzugefügt."};
};
// One selection action for Home, player library and Turniertag.
window.badmintonSelectViewer=(id,{stayOnPage=false}={})=>{
 if(state.players.some(p=>p.id===id)){
  setActiveProfile(id);
 }else if(SchmetterlingeStorage.selectFriend(state,id)){
  save();
 }else return false;
 const destination=stayOnPage?(state.page==="live"?"live":"turniere"):"start";
  routeTo(destination);
 return true;
};
// A quick "+" is private device-only planning, never an official registration.
// Source calendar IDs are not turnier.de tournament UUIDs.
window.badmintonCalendarBookmarkState=()=>({
 playerId:state.viewingFriendId?"":state.activeProfileId,
 playerName:state.viewingFriendId?"":state.players.find(p=>p.id===state.activeProfileId)?.name||"",
 savedKeys:state.officialLinks.filter(t=>t.source==="dbv-calendar"&&t.playerId===state.activeProfileId).map(t=>t.id)
});
window.badmintonCalendarToggle=item=>{
 if(state.viewingFriendId||!state.players.some(p=>p.id===state.activeProfileId)){
  return {ok:false,message:"Bitte zuerst ein eigenes Spielerprofil auswählen."};
 }
 const key=String(item?.key||"");
 if(!/^dbv-calendar-\d{2,12}$/.test(key))return {ok:false,message:"Ungültige DBV-Kalenderkennung."};
 const previous=state.officialLinks.find(t=>t.source==="dbv-calendar"&&t.id===key&&t.playerId===state.activeProfileId);
 if(previous){
  state.officialLinks=state.officialLinks.filter(t=>t!==previous);
  save();render();toast("Vormerkung entfernt");
  return {ok:true,saved:false};
 }
 if(state.officialLinks.length>=40)return {ok:false,message:"Die private Turnierliste enthält bereits 40 Einträge."};
 const entry=normalizeBookmark({id:key,source:"dbv-calendar",url:"https://turniere.badminton.de/",
  playerId:state.activeProfileId,name:item?.title,startDate:item?.start,endDate:item?.end});
 if(!entry)return {ok:false,message:"Turnier konnte nicht eindeutig zugeordnet werden."};
 state.officialLinks.unshift(entry);
 save();render();toast("Turnier für "+(state.players.find(p=>p.id===state.activeProfileId)?.name||"dein Profil")+" vorgemerkt");
 return {ok:true,saved:true};
};
window.badmintonTournamentOptions=()=>{
 // Shared event hints are never written to family bookmarks. Their DBV source
 // link can still open the already verified LIVE/tournament match views.
 const local=state.officialLinks.filter(t=>t.source!=="dbv-calendar");
 const community=window.badmintonCommunityTournamentOptions?.()||[];
 const seen=new Set(local.map(t=>t.id));
 for(const t of community){if(!seen.has(t.id)){local.push(t);seen.add(t.id)}}
 return local.sort((a,b)=>{
  const order={today:0,future:1,unknown:2,past:3};
  return order[bookmarkPhase(a)[1]]-order[bookmarkPhase(b)[1]]||a.name.localeCompare(b.name,"de");
 });
};
window.badmintonLiveViewerOptions=()=>({
 own:state.players.map(p=>({id:p.id,name:p.name})),
 friends:state.friends.map(p=>({id:p.id,name:p.name})),
 selected:state.viewingFriendId||state.activeProfileId
});
window.badmintonLibraryView=id=>{
 if(!state.friends.some(p=>p.id===id))return false;
 return window.badmintonSelectViewer(id);
};
}
let liveEvidence={playerId:"",day:"",active:false};
function updateLiveNavigation(){
 const tab=el("live-nav-tab");if(!tab)return false;
 const today=localDay();
 const shouldShow=SchmetterlingeBookmarks.hasTournamentToday(state,today)||
  (liveEvidence.active&&liveEvidence.playerId===state.chosen&&liveEvidence.day===today);
 const changed=tab.hidden===shouldShow;
 tab.hidden=!shouldShow;
 tab.parentElement?.classList.toggle("has-live-tab",shouldShow);
 return changed;
}
let lastNotifiedProfile="",lastNotifiedClub="";
function render(){
 renderFocusHeader();
 renderTournaments();
 SchmetterlingeSpond.render(state);
 window.dispatchEvent(new CustomEvent("badminton:tournament-bookmarks"));
 renderProfiles();
 renderFriends();
 renderFriendQuick();
 state.chosen=state.viewingFriendId||state.activeProfileId;
 const viewedProfiles=[...state.players,...state.friends];
 window.renderDashboard?.(state.chosen,viewedProfiles,state.viewingFriendId?[]:state.officialLinks.concat(SchmetterlingeSpond.dashboardItems(state.chosen,state.officialLinks)),{mode:state.viewingFriendId?"friend":"own"});
 window.renderHistory?.(state.chosen,viewedProfiles,{mode:state.viewingFriendId?"friend":"own"});
 // Read-only live viewer follows whichever public DBV profile is currently shown.
 window.badmintonActivePlayerId=state.chosen;
 window.badmintonActiveClub=(currentProfile()?.club||"");
 if(state.chosen!==lastNotifiedProfile||window.badmintonActiveClub!==lastNotifiedClub){
  lastNotifiedProfile=state.chosen;
  lastNotifiedClub=window.badmintonActiveClub;
  window.dispatchEvent(new CustomEvent("badminton:profile-change",{detail:{playerId:state.chosen,club:window.badmintonActiveClub}}));
 }
 updateLiveNavigation();
 SchmetterlingeRouter.renderPage(state);
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
 if(el("tournament-share"))el("tournament-share").checked=Boolean(item&&window.badmintonCommunity?.isShared(item));
 if(el("community-save-status")){el("community-save-status").hidden=true;el("community-save-status").textContent="";}
 dialog.showModal();
}
function setup(){
 window.addEventListener("badminton:community-feedback",event=>{
  if(typeof event.detail?.message==="string")toast(event.detail.message);
 });
 window.addEventListener("badminton:live-evidence",event=>{
  const playerId=String(event.detail?.playerId||"");
  if(playerId!==state.chosen)return;
  liveEvidence={playerId,day:localDay(),active:event.detail?.active===true};
  if(updateLiveNavigation())SchmetterlingeRouter.renderPage(state);
 });
 // Local date rollover check only: no additional provider polling.
 setInterval(()=>{if(updateLiveNavigation())SchmetterlingeRouter.renderPage(state)},60_000);
 let freshDevice=false;
 try{freshDevice=!localStorage.getItem(STORE)}catch{}
 restore();
 try{
  const pending=localStorage.getItem("schmetterlinge.pendingPrivatePlayer.v1");
  localStorage.removeItem("schmetterlinge.pendingPrivatePlayer.v1");
  if(pending&&state.friends.some(p=>p.id===pending))
   SchmetterlingeStorage.selectFriend(state,pending);
 }catch{}
 save();
 // An accepted private invitation is a followed player, not an own profile.
 if(!state.players.length&&state.friends.length)
  SchmetterlingeStorage.selectFriend(state,state.friends[0].id);
 SchmetterlingeSpond.mount({getState:()=>state,onChange:render});
 state.page=(location.hash||"#start").slice(1).split("/")[0];
 // Native anchor routing alone retains the viewed friend's profile. Home must reset it,
 // including a second tap while #start is already the active hash.
 document.querySelectorAll('.bottom-nav a[data-page="start"], .topbar .brand[href="#start"]').forEach(link=>{
  link.addEventListener("click",event=>{event.preventDefault();navigateHome()});
 });
 window.addEventListener("hashchange",()=>{
  state.page=(location.hash||"#start").slice(1).split("/")[0];
  render();
  focusCurrentView();
 });
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
  const isNewOwn=!editingPlayerId;
  if(editingPlayerId)state.players=state.players.map(p=>p.id===editingPlayerId?record:p);
  else{
   if(state.friends.some(p=>p.id===id)){toast("Diese Spieler-ID ist bereits ein Freund");return}
   state.players.push(record);
   if(activatingNewProfile||!state.activeProfileId)state.activeProfileId=id;
   if(activatingNewProfile){SchmetterlingeStorage.showOwn(state);location.hash="#start";}
   activatingNewProfile=false;
  }
  editingPlayerId=null;
  save();render();playerDialog.close();playerForm.reset();toast("Spielerprofil gespeichert");
  if(isNewOwn)window.dispatchEvent(new CustomEvent("badminton:own-profile-added",{detail:{playerId:id}}));
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
 el("player-add-open")?.addEventListener("click",()=>showPlayerDiscover(el("player-discover").hidden));
  el("player-discover-close")?.addEventListener("click",()=>showPlayerDiscover(false,false));
  el("settings-players-add")?.addEventListener("click",()=>showPlayerDiscover(true));
  el("add-friend").addEventListener("click",()=>showPlayerDiscover(true));
  el("add-friend-manual").addEventListener("click",()=>openFriendForm());
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
  const isNewFriend=!editingFriendId;
  if(editingFriendId)state.friends=state.friends.map(p=>p.id===editingFriendId?friend:p);
  else state.friends.unshift(friend);
  editingFriendId=null;
  if(isNewFriend)showPlayerDiscover(false,false);
   save();render();friendDialog.close();friendForm.reset();toast("Freund gespeichert");
  if(isNewFriend)window.dispatchEvent(new CustomEvent("badminton:friend-followed",{detail:{playerId:id}}));
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
  const publicShare=Boolean(data.get("publicShare"));
  if(publicShare&&!/^\d{2}-\d{6}$/.test(playerId)){
   toast("Öffentliches Teilen benötigt eine gültige DBV-Spieler-ID und einen einzelnen Spieler.");
   return;
  }
  const start=String(data.get("startDate")||"");
  const end=String(data.get("endDate")||"");
  if(start&&end&&end<start){toast("Das Enddatum liegt vor dem Beginn");return}
  const bookmark=normalizeBookmark({url:parsed.url,playerId,name:data.get("name"),startDate:start,endDate:end});
  const duplicate=state.officialLinks.some(t=>t.id===bookmark.id&&t.playerId===bookmark.playerId&&(!editing||t.id!==editing.id||t.playerId!==editing.playerId));
  if(duplicate){toast("Das Turnier ist für diesen Spieler bereits gespeichert");return}
  const previous=editing?state.officialLinks.find(t=>t.id===editing.id&&t.playerId===editing.playerId):null;
  if(editing)state.officialLinks=state.officialLinks.filter(t=>!(t.id===editing.id&&t.playerId===editing.playerId));
  state.officialLinks.unshift(bookmark);
  state.officialLinks=state.officialLinks.slice(0,40);
  editing=null;save();render();tournamentDialog.close();event.currentTarget.reset();
  toast(publicShare?"Turnier lokal gespeichert · Freigabe wird geprüft":"Turnier privat gespeichert");
  window.dispatchEvent(new CustomEvent("badminton:share-tournament",{
   detail:{bookmark,previous,publicShare}
  }));
 });
 render();
 // Also recover from empty/corrupted legacy state without restoring a
 // hardcoded family. Existing valid stored profiles remain untouched.
 if(!state.players.length&&!state.friends.length){
  const welcome=el("first-run-dialog");
  const chooser=el("first-run-choices");
  chooser.innerHTML=state.players.length?state.players.map(p=>'<button class="first-run-choice" type="button" data-initial-player="'+esc(p.id)+'"><span>'+esc(p.name.charAt(0).toUpperCase())+'</span><strong>'+esc(p.name)+'</strong><span aria-hidden="true">›</span></button>').join(""):'<p class="settings-hint">Auf diesem Gerät ist noch kein eigenes Profil eingerichtet.</p>';
  chooser.querySelectorAll("[data-initial-player]").forEach(b=>b.addEventListener("click",()=>{
   if(!setActiveProfile(b.dataset.initialPlayer))return;
   welcome.close();location.hash="#start";render();
  }));
  el("first-run-new").addEventListener("click",()=>{
   welcome.close();window.location.assign("./welcome.html?from=app");
  });
  welcome.showModal();
 }
 if("serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
document.addEventListener("DOMContentLoaded",setup);
