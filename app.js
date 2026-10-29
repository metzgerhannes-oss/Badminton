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
function toastUndo(message,undo){
 const node=el("toast");if(!node)return;
 clearTimeout(toastTimer);node.textContent=message+" · ";
 const button=document.createElement("button");
 button.type="button";button.className="toast-undo";button.textContent="Rückgängig";
 button.setAttribute("aria-label","Entfolgen rückgängig machen");
 button.addEventListener("click",()=>{clearTimeout(toastTimer);undo()});
 node.append(button);node.classList.add("visible");
 toastTimer=setTimeout(()=>node.classList.remove("visible"),6000);
}
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
// A native hashchange follows our already synchronously rendered tab clicks.
 // Keep one route paint; genuine Back/Forward and deep-link hash changes still
 // render because their destination differs from lastRenderedHash.
let lastRenderedHash=location.hash||"#start";
// Existing UI callers keep the same route and focus methods.
function routeTo(page){
 // Choosing a followed player's statistics is not a Home/Logo action.
 // Preserve that explicit viewer while making the destination visible now.
 if(!navigatePrimary(page,{returnToOwn:false}))
  SchmetterlingeRouter.routeTo(state,page,render);
}
function focusSavedTournamentFromHash(){
 const match=location.hash.match(/^#turniere\/([^/]+)\/([^/]+)$/);
 if(!match||state.page!=="turniere")return;
 let id,player;
 try{id=decodeURIComponent(match[1]);player=decodeURIComponent(match[2])}catch{return}
 const card=[...document.querySelectorAll("#official-tournament-list [data-saved-tournament-id]")]
  .find(node=>node.dataset.savedTournamentId===id&&node.dataset.savedTournamentPlayer===player);
 if(!card)return;
 card.setAttribute("tabindex","-1");
 card.focus({preventScroll:true});
 card.scrollIntoView({behavior:"auto",block:"start"});
}
function focusCurrentView(){
 SchmetterlingeRouter.focusCurrentView(state);
 // The router restores scroll on its next frame. Focus the exact bookmarked
 // card afterwards, including when a Home deep link is reopened on iOS PWA.
 if(location.hash.startsWith("#turniere/"))
  requestAnimationFrame(()=>requestAnimationFrame(focusSavedTournamentFromHash));
}
/** Native-feeling primary navigation: source of truth is the tapped destination,
 * not a deferred hashchange from installed WebKit. The four stable mobile tabs and the desktop club link use
 * the same route. This does not touch stored players, friends or invitations.
 */
function navigatePrimary(page,{returnToOwn=true}={}){
 const allowed=["start","turniere","live","spieler","verein","mannschaft","berichte","historie","spiele"];
 if(!allowed.includes(page))return false;
 if(page==="start"){
  if(returnToOwn){
   if(!state.players.length&&state.friends.length)
    SchmetterlingeStorage.selectFriend(state,state.friends[0].id);
   else SchmetterlingeStorage.showOwn(state);
  }
 }
 state.page=page;
 if(location.hash!=="#"+page)location.hash="#"+page;
 lastRenderedHash=location.hash||"#start";
 // Render the destination first. An unrelated dashboard/live rendering failure
 // must not trap navigation on the previous view.
 SchmetterlingeRouter.renderPage(state);
 try{render()}finally{
  SchmetterlingeRouter.renderPage(state);
  focusCurrentView();
 }
 return true;
}
function navigateHome(){return navigatePrimary("start")}
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
 const profileMeta=[isFriend?"Gefolgt":"",p.birthYear?esc(p.birthYear):"",p.club?esc(p.club):""].filter(Boolean).join(" · ");
 wrap.innerHTML='<div class="focus-profile-avatar">'+esc(p.name.trim().charAt(0).toUpperCase())+'</div>'+
  '<div class="focus-profile-copy"><strong>'+esc(p.name)+'</strong>'+
  (profileMeta?'<span class="focus-profile-meta">'+profileMeta+'</span>':"")+
  '<span class="focus-profile-id">'+(/^\d{2}-\d{6}$/.test(p.id)?"DBV "+esc(p.id):"Ohne DBV-ID")+'</span></div>'+action;
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
  const planning=t.source==="bwbv-framework";
  const calendar=t.source==="dbv-calendar"||planning;
  const venue=String(t.place||"").trim();
  const name=String(t.name||"").trim();
  const heading=venue&&!name.toLocaleLowerCase("de").includes(venue.toLocaleLowerCase("de"))?name+" · "+venue:name;
  const missingVenue=venue?"":'<p class="saved-tournament-venue">Austragungsort nicht erfasst</p>';
  // Exact DBV event UUID only. A generic calendar URL must never be
  // presented as the direct tournament page, even if flagged by the feed.
  const directSource=SchmetterlingeBookmarks.verifiedCalendarEventUrl(t,verifiedCalendarRows);
  const destination=directSource||t.url;
  const sourceLabel=planning?"Terminquelle ↗":directSource||!calendar?"Offizielle Turnierseite ↗":"DBV-Kalender öffnen ↗";
  const sourceStatus=calendar?'<p class="saved-tournament-id">'+(planning?"Rahmentermin · Anmeldung nicht bestätigt":"Vorgemerkt · Anmeldung nicht bestätigt")+"</p>":"";
  const technicalId=calendar?"":'<details class="saved-tournament-technical"><summary>Turnier-ID</summary><code>'+esc(t.id)+"</code></details>";
  const deadline=t.deadline?'<p class="saved-tournament-deadline">Meldeschluss: '+esc(niceDay(t.deadline))+'</p>':"";
  const discrepancy=tournamentSourceConflicts.get(t.id+"|"+t.playerId);
  const sourceNote=discrepancy?'<p class="saved-tournament-source-warning" role="status">'+esc(discrepancy.reason)+'. DBV-Spieltag: '+esc(niceDay(discrepancy.officialDate))+(
   discrepancy.officialDeadline?', Meldeschluss: '+esc(niceDay(discrepancy.officialDeadline)):"")+'. Angaben prüfen.</p>':"";
  return '<article class="tournament-card card-open-surface" data-saved-tournament-id="'+esc(t.id)+'" data-saved-tournament-player="'+esc(t.playerId)+'"><div class="saved-tournament-top"><h3>'+esc(heading)+'</h3><span class="saved-tournament-phase phase-'+tone+'">'+esc(phase)+'</span></div><p class="saved-tournament-dates">'+esc(dates)+'</p>'+missingVenue+deadline+sourceNote+sourceStatus+'<div class="local-shortcut-actions"><a class="card-open-primary" href="'+esc(destination)+'" rel="noopener noreferrer" target="_blank">'+sourceLabel+'</a>'+(calendar?'<button class="remove-button" data-edit-venue-id="'+esc(t.id)+'" data-edit-venue-player="'+esc(t.playerId)+'" type="button" aria-label="Austragungsort dieser privaten Vormerkung bearbeiten">Ort bearbeiten</button>':'<button class="remove-button" data-edit-id="'+esc(t.id)+'" data-edit-player="'+esc(t.playerId)+'" type="button">Bearbeiten</button>')+(planning?'':'<button class="remove-button" data-private-invite-id="'+esc(t.id)+'" data-private-invite-player="'+esc(t.playerId)+'" type="button">Privat teilen</button>')+'<button class="remove-button" data-remove-id="'+esc(t.id)+'" data-remove-player="'+esc(t.playerId)+'" type="button">Entfernen</button></div>'+technicalId+'<p class="saved-tournament-player">Spieler: '+esc(profile)+'</p></article>';
 }).join("");
 section.querySelectorAll("[data-edit-id]").forEach(button=>button.addEventListener("click",()=>{
  const item=state.officialLinks.find(t=>t.id===button.dataset.editId&&t.playerId===button.dataset.editPlayer);
  if(item)openTournamentForm(item);
 }));
 section.querySelectorAll("[data-edit-venue-id]").forEach(button=>button.addEventListener("click",()=>{
  const bookmark=state.officialLinks.find(t=>t.id===button.dataset.editVenueId&&t.playerId===button.dataset.editVenuePlayer);
  if(!bookmark||!["dbv-calendar","bwbv-framework"].includes(bookmark.source))return;
  editingVenue={id:bookmark.id,playerId:bookmark.playerId};
  const form=el("tournament-venue-form");
  form.reset();
  form.elements.namedItem("place").value=bookmark.place||"";
  SchmetterlingeRouter.openDialog(el("tournament-venue-dialog"));
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
  save();render();toast(removed?.source==="dbv-calendar"||removed?.source==="bwbv-framework"?"Vormerkung entfernt":"Turnierlink entfernt");
  if(removed&&removed.source!=="dbv-calendar"&&removed.source!=="bwbv-framework")window.dispatchEvent(new CustomEvent("badminton:share-tournament",{
   detail:{bookmark:removed,publicShare:false,removed:true}
  }));
 }));
}
function renderProfiles(){
 const list=el("profile-list");
 list.innerHTML=state.players.length?state.players.map(p=>{
 const active=state.activeProfileId===p.id;
 const birth=p.birthYear?" · Jg. "+esc(p.birthYear):"";
 return '<article class="profile-card own-profile card-open-surface '+(active?'profile-active':'')+'"><div class="profile-main"><span class="profile-initial">'+esc(p.name.charAt(0).toUpperCase())+'</span><div><h3>'+esc(p.name)+'</h3><p>DBV-ID: '+esc(/^\d{2}-\d{6}$/.test(p.id)?p.id:"nicht hinterlegt")+birth+'</p>'+(p.club?'<p class="profile-club">Verein: '+esc(p.club)+'</p>':"")+(active?'<small class="active-profile-chip">Startprofil</small>':'')+(safeUrl(p.url)?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">DBV-Profil ↗</a>':'')+'</div></div><button type="button" class="card-open-primary card-open-plain" data-view-own-profile="'+esc(p.id)+'" aria-label="Spielerprofil ansehen: '+esc(p.name)+'"></button><div class="profile-actions">'+(!active?'<button type="button" class="outline-button" data-set-active="'+esc(p.id)+'">Als Startprofil</button>':'')+'<button type="button" class="remove-button" data-edit-own="'+esc(p.id)+'">Bearbeiten</button>'+(/^\d{2}-\d{6}$/.test(p.id)?'<button type="button" class="outline-button" data-share-player="'+esc(p.id)+'">Profil privat teilen</button>':'')+'<button type="button" class="remove-button" data-remove-profile="'+esc(p.id)+'">Entfernen</button></div></article>';
 }).join(""):'<div class="empty">Noch kein eigenes Spielerprofil hinterlegt.</div>';
 list.querySelectorAll("[data-view-own-profile]").forEach(b=>b.addEventListener("click",()=>window.badmintonSelectViewer?.(b.dataset.viewOwnProfile)));
 list.querySelectorAll("[data-set-active]").forEach(b=>b.addEventListener("click",()=>{
  if(!setActiveProfile(b.dataset.setActive))return;
  render();toast("Startprofil geändert");
  window.dispatchEvent(new CustomEvent("badminton:profile-selected",{detail:{playerId:b.dataset.setActive}}));
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
  root.innerHTML='<p class="friends-empty">Noch keine Freunde. Mit dem + oben kannst du Spielern folgen.</p>';
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
 root.querySelector(".friend-quick-more")?.addEventListener("click",()=>showPlayerDiscover(false,false));
 root.querySelectorAll("[data-friend-quick]").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.isOwn==="true"){navigateHome();return;}
  window.badmintonSelectViewer(b.dataset.friendQuick,{preferFriend:true});
 }));
}
function unfollowPlayer(id){
 const index=state.friends.findIndex(p=>p.id===id);
 if(index<0)return;
 const friend=state.friends[index];
 if(!SchmetterlingeStorage.unfollow(state,id))return;
 save();render();window.dispatchEvent(new Event("badminton:library-following"));
 toastUndo(friend.name+" entfolgt",()=>{
  // Restore only the device-local follow and its previous position, not a family profile.
  if(state.friends.some(p=>p.id===id))return;
  state.friends.splice(Math.min(index,state.friends.length),0,friend);
  save();render();window.dispatchEvent(new Event("badminton:library-following"));
  toast(friend.name+" wieder gefolgt");
 });
}
function moveFollow(id, target, focus=true){
 const query=String(el("followed-player-search")?.value||"").trim();
 if(query)return false; // Sorting a filtered subset would mislead the user.
 const from=state.friends.findIndex(p=>p.id===id);
 if(from<0||target<0||target>=state.friends.length||from===target)return false;
 const [player]=state.friends.splice(from,1);
 state.friends.splice(target,0,player);
 save();renderFriends();
 if(focus){
  const handles=Array.from(el("friend-list")?.querySelectorAll("[data-friend-grip]")||[]);
  handles.find(x=>x.dataset.friendGrip===id)?.focus({preventScroll:true});
 }
 return true;
}
function renderFriends(){
 const root=el("friend-list");if(!root)return;
 const query=String(el("followed-player-search")?.value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de").trim();
 const matching=state.friends.filter(p=>!query||[p.name,p.id,p.club].some(v=>
  String(v||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de").includes(query)));
 const count=el("followed-player-count");if(count)count.textContent="("+state.friends.length+")";
 const all=el("followed-show-all");if(all)all.hidden=!query;
 root.innerHTML=matching.length?matching.map(p=>{
  const current=state.viewingFriendId===p.id;
  return '<article class="followed-player-row card-open-surface" data-follow-row="'+esc(p.id)+'">'+
   '<button type="button" class="friend-follow-item card-open-primary'+(current?' is-current':'')+'" data-view-friend="'+esc(p.id)+'">'+
   '<span class="friend-avatar" aria-hidden="true">'+esc(p.name.trim().charAt(0).toUpperCase())+'</span>'+
   '<span class="friend-details"><strong>'+esc(p.name)+'</strong><small>DBV '+esc(p.id)+(p.club?' · '+esc(p.club):'')+'</small></span>'+
   '<span class="follow-item-arrow" aria-hidden="true">›</span></button>'+
   (query
    ?'<button type="button" class="followed-reorder-grip" data-edit-friend="'+esc(p.id)+'"'+
      ' aria-label="'+esc(p.name)+' Angaben bearbeiten" title="Spielerangaben bearbeiten">✎</button>'
    :'<button type="button" class="followed-reorder-grip" data-friend-grip="'+esc(p.id)+'"'+
      ' aria-label="'+esc(p.name)+' sortieren: ziehen oder Pfeiltasten nach oben oder unten" title="Ziehen oder Pfeiltasten">⠿</button>')+
   '<button type="button" class="followed-inline-remove" data-unfollow-inline="'+esc(p.id)+'" aria-label="'+esc(p.name)+' entfolgen">−</button></article>';
 }).join(""):'<p class="team-empty">'+(state.friends.length?"Keine gefolgten Spieler zu dieser Suche.":"Noch keine gefolgten Spieler. Suche oben nach Namen oder DBV-ID.")+'</p>';
 root.querySelectorAll("[data-view-friend]").forEach(b=>b.addEventListener("click",()=>window.badmintonSelectViewer(b.dataset.viewFriend,{preferFriend:true})));
 root.querySelectorAll("[data-unfollow-inline]").forEach(b=>b.addEventListener("click",ev=>{
  ev.preventDefault();ev.stopPropagation();unfollowPlayer(b.dataset.unfollowInline);
 }));
 root.querySelectorAll("[data-edit-friend]").forEach(b=>b.addEventListener("click",ev=>{
  ev.preventDefault();ev.stopPropagation();
  const player=state.friends.find(p=>p.id===b.dataset.editFriend);
  if(player)window.openFriendForm?.(player);
 }));
 root.querySelectorAll("[data-friend-grip]").forEach(b=>{
  b.addEventListener("click",ev=>{ev.preventDefault();ev.stopPropagation()});
  b.addEventListener("keydown",ev=>{
   if(!["ArrowUp","ArrowDown"].includes(ev.key))return;
   ev.preventDefault();ev.stopPropagation();
   const i=state.friends.findIndex(p=>p.id===b.dataset.friendGrip);
   moveFollow(b.dataset.friendGrip,i+(ev.key==="ArrowUp"?-1:1));
  });
  let start=null;
  b.addEventListener("pointerdown",ev=>{
   if(b.disabled||ev.button!==0)return;
   start={id:b.dataset.friendGrip,x:ev.clientX,y:ev.clientY,pointer:ev.pointerId};
   b.setPointerCapture?.(ev.pointerId);
  });
  b.addEventListener("pointercancel",()=>{start=null});
  b.addEventListener("pointerup",ev=>{
   if(!start||start.pointer!==ev.pointerId)return;
   const move=start;start=null;
   if(Math.hypot(ev.clientX-move.x,ev.clientY-move.y)<10)return;
   const rows=Array.from(root.querySelectorAll("[data-follow-row]"));
   // Pointer capture keeps the handle active; use target row bounds to find the destination.
   const target=rows.reduce((best,row)=>{
    const r=row.getBoundingClientRect();
    const distance=Math.abs(ev.clientY-(r.top+r.height/2));
    return distance<best.distance?{distance,id:row.dataset.followRow}:best;
   },{distance:Infinity,id:""});
   if(!target.id)return;
   const i=state.friends.findIndex(p=>p.id===target.id);
   moveFollow(move.id,i);
  });
 });
}

function syncFollowSearch(){
 const input=el("followed-player-search");if(!input)return;
 const term=input.value.trim();
 const active=term.length>=3;
 const panel=el("player-discover");
 if(panel)panel.hidden=!active;
 const secondary=el("library-search");
 const value=active?term:"";
 if(secondary&&secondary.value!==value){
  secondary.value=value;
  // Reuse existing debounce, three-character minimum, and rate budget.
  secondary.dispatchEvent(new Event("input",{bubbles:true}));
 }
 renderFriends();
}
let pendingFollowSearchFocus=false;
function showPlayerDiscover(open=true,focus=true){
 if(!open){
  pendingFollowSearchFocus=false;
  const input=el("followed-player-search");if(input)input.value="";
  syncFollowSearch();return;
 }
 const focusSearch=()=>{
  if(location.hash!=="#spieler"||!el("view-spieler")?.classList.contains("active"))return;
  const input=el("followed-player-search");
  input?.focus({preventScroll:true});
  input?.scrollIntoView({block:"center",behavior:"smooth"});
 };
 // A delayed hashchange can otherwise steal focus back to the route heading.
 pendingFollowSearchFocus=Boolean(focus&&location.hash!=="#spieler");
 if(location.hash!=="#spieler")navigatePrimary("spieler");
 syncFollowSearch();
 if(focus){
  // First focus synchronously from the tap for the iOS keyboard.
  focusSearch();
  // The router's queued hashchange may focus the heading afterwards.
  // Restore the input on the next frame, even when WebKit drops hashchange.
  requestAnimationFrame(()=>{
   if(location.hash==="#spieler"&&document.activeElement!==el("followed-player-search"))focusSearch();
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
 // Following does not grant ownership and must not erase an existing own role.
 const exists=state.friends.some(p=>p.id===id);
 if(exists)return {ok:false,message:"Du folgst diesem Spieler bereits. Entfolgen geht in deiner Freundeliste."};
 if(state.friends.length>=30)return {ok:false,message:"Es können aktuell höchstens 30 Spieler gleichzeitig gefolgt werden."};
 state.friends.push({
  id,name:String(player.name).trim().slice(0,80),
  birthYear:Number.isInteger(player.birthYear)?player.birthYear:undefined,
  club:String(player.club||"").slice(0,120),url:""
 });
 save();render();window.dispatchEvent(new Event("badminton:library-following"));toast("Du folgst jetzt "+player.name);
 window.dispatchEvent(new CustomEvent("badminton:friend-followed",{detail:{playerId:id}}));
 return {ok:true,message:"Spieler zu deiner Liste hinzugefügt."};
};
// One selection action for Home, player library and Turniertag.
window.badmintonSelectViewer=(id,{stayOnPage=false,preferFriend=false}={})=>{
 // An explicit Follow click must keep its role even if the DBV ID is also owned.
 if(preferFriend&&SchmetterlingeStorage.selectFriend(state,id)){
  save();
 }else if(state.players.some(p=>p.id===id)){
  setActiveProfile(id);
 }else if(SchmetterlingeStorage.selectFriend(state,id)){
  save();
 }else return false;
 const destination=stayOnPage?(state.page==="live"?"live":"turniere"):"start";
  routeTo(destination);
 window.dispatchEvent(new CustomEvent("badminton:profile-selected",{detail:{playerId:id}}));
 return true;
};
// A quick "+" is private device-only planning, never an official registration.
// Source calendar IDs are not turnier.de tournament UUIDs.
window.badmintonCalendarBookmarkState=()=>({
 playerId:state.viewingFriendId?"":state.activeProfileId,
 playerName:state.viewingFriendId?"":state.players.find(p=>p.id===state.activeProfileId)?.name||"",
 savedKeys:state.officialLinks.filter(t=>t.playerId===state.activeProfileId).map(t=>t.id)
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
  playerId:state.activeProfileId,name:item?.title,startDate:item?.start,endDate:item?.end,place:item?.place,deadline:item?.deadline});
 if(!entry)return {ok:false,message:"Turnier konnte nicht eindeutig zugeordnet werden."};
 state.officialLinks.unshift(entry);
 save();render();toast("Turnier für "+(state.players.find(p=>p.id===state.activeProfileId)?.name||"dein Profil")+" vorgemerkt");
 return {ok:true,saved:true};
};
// The seven published BWBV/DBV 2027 planning dates have source URLs but
// not confirmed tournament UUIDs; save them only on this device.
window.badmintonFrameworkToggle=item=>{
 if(state.viewingFriendId||!state.players.some(p=>p.id===state.activeProfileId))
  return {ok:false,message:"Bitte zuerst ein eigenes Spielerprofil auswählen."};
 const id=String(item?.key||"");
 const previous=state.officialLinks.find(t=>t.source==="bwbv-framework"&&t.id===id&&t.playerId===state.activeProfileId);
 if(previous){
  state.officialLinks=state.officialLinks.filter(t=>t!==previous);
  save();render();toast("Vormerkung entfernt");
  return {ok:true,saved:false};
 }
 if(state.officialLinks.length>=40)return {ok:false,message:"Die private Turnierliste enthält bereits 40 Einträge."};
 const entry=normalizeBookmark({id,source:"bwbv-framework",url:item?.source,
  playerId:state.activeProfileId,name:item?.title,startDate:item?.start,endDate:item?.end,place:item?.place});
 if(!entry)return {ok:false,message:"Rahmentermin konnte nicht eindeutig zugeordnet werden."};
 state.officialLinks.unshift(entry);
 save();render();toast("Rahmentermin für "+(state.players.find(p=>p.id===state.activeProfileId)?.name||"dein Profil")+" vorgemerkt");
 return {ok:true,saved:true};
};
// A verified 2026 result is a local bookmark, not a registration or access grant.
window.badmintonOfficialTournamentToggle=item=>{
 if(state.viewingFriendId||!state.players.some(p=>p.id===state.activeProfileId))
  return {ok:false,message:"Bitte zuerst ein eigenes Spielerprofil auswählen."};
 const parsed=SchmetterlingeBookmarks.parseDbvTournamentLink(item?.source);
 if(!parsed||item?.sourceKind!=="results"||!SchmetterlingeBookmarks.validDate(item?.start)||
    !SchmetterlingeBookmarks.validDate(item?.end)||item.end<item.start)
  return {ok:false,message:"Keine eindeutig belegte offizielle Turnierseite."};
 const existing=state.officialLinks.find(t=>t.id===parsed.id&&t.playerId===state.activeProfileId);
 if(existing){
  if(window.badmintonPrivateInvite?.hasActive(existing))
   return {ok:false,message:"Zuerst den privaten Einladungslink widerrufen."};
  state.officialLinks=state.officialLinks.filter(t=>t!==existing);
  save();render();toast("Turnier aus Meine Turniere entfernt");return {ok:true,saved:false};
 }
 if(state.officialLinks.length>=40)return {ok:false,message:"Die private Turnierliste enthält bereits 40 Einträge."};
 const entry=normalizeBookmark({url:parsed.url,playerId:state.activeProfileId,
  name:item.title,startDate:item.start,endDate:item.end,place:item.place});
 if(!entry)return {ok:false,message:"Turnier konnte nicht eindeutig zugeordnet werden."};
 state.officialLinks.unshift(entry);save();render();toast("Turnier zu Meine Turniere hinzugefügt");
 return {ok:true,saved:true};
};
// Read-only desktop context. Show only currently selected OWN profile's locally
// saved entries, never private bookmarks while viewing a followed player.
window.badmintonDesktopContext=()=>{
 if(state.viewingFriendId||!state.players.some(p=>p.id===state.activeProfileId))
  return {own:false,events:[]};
 const today=localDay();
 const saved=SchmetterlingeBookmarks.visible(state).map(t=>({
  name:t.name,startDate:t.startDate,endDate:t.endDate||t.startDate,
  note:t.source==="bwbv-framework"?"Rahmentermin · Anmeldung nicht bestätigt":t.source==="dbv-calendar"?"DBV-Vormerkung · Anmeldung nicht bestätigt":"Gespeicherter Turnierlink · Teilnahme nicht bestätigt",
  url:safeUrl(t.url)
 }));
 const imported=SchmetterlingeSpond.dashboardItems(state.activeProfileId,state.officialLinks).map(t=>({
  name:t.name,startDate:t.startDate,endDate:t.endDate||t.startDate,
  note:"Kalenderimport · Teilnahme nicht bestätigt",url:""
 }));
 const unique=new Map();
 for(const t of [...saved,...imported]){
  if(!SchmetterlingeBookmarks.validDate(t.startDate))continue;
  if(!SchmetterlingeBookmarks.validDate(t.endDate)||t.endDate<t.startDate)continue;
  if(t.endDate<today)continue;
  const key=t.startDate+"|"+String(t.name).trim().toLocaleLowerCase("de");
  if(!unique.has(key))unique.set(key,t);
 }
 return {own:true,events:[...unique.values()].sort((a,b)=>
  a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name,"de")).slice(0,3)};
};
window.badmintonTournamentOptions=()=>{
 // Shared event hints are never written to family bookmarks. Their DBV source
 // link can still open the already verified LIVE/tournament match views.
 const local=state.officialLinks.filter(t=>t.source!=="dbv-calendar"&&t.source!=="bwbv-framework");
 const community=window.badmintonCommunityTournamentOptions?.()||[];
 const seen=new Set(local.map(t=>t.id));
 for(const t of community){if(!seen.has(t.id)){local.push(t);seen.add(t.id)}}
 return local.sort((a,b)=>{
  const order={today:0,future:1,unknown:2,past:3};
  return order[bookmarkPhase(a)[1]]-order[bookmarkPhase(b)[1]]||a.name.localeCompare(b.name,"de");
 });
};
window.badmintonArcadeProfiles=()=>({players:state.players.map(p=>({id:p.id,name:p.name})),activeProfileId:state.activeProfileId});
window.badmintonLiveViewerOptions=()=>({
 own:state.players.map(p=>({id:p.id,name:p.name})),
 friends:state.friends.map(p=>({id:p.id,name:p.name})),
 selected:state.viewingFriendId||state.activeProfileId
});
window.badmintonLibraryView=id=>{
 if(!state.friends.some(p=>p.id===id))return false;
 return window.badmintonSelectViewer(id,{preferFriend:true});
};
}
let todayNav={day:"",matchToday:false};
function updateLiveNavigation(){
 const tab=el("live-nav-tab");if(!tab)return false;
 // A mere tournament, own calendar bookmark, dated result or yesterday's
 // source snapshot must never expose the prominent red game-day shortcut.
 const shouldShow=todayNav.matchToday&&todayNav.day===localDay();
 const changed=tab.hidden===shouldShow;
 tab.hidden=!shouldShow;
 // A verified-day shortcut stays separate from the four stable main tabs.
 const caption=tab.querySelector("small");if(caption)caption.textContent="Heute";
 tab.setAttribute("aria-label","Heute angesetzte oder laufende Spiele");
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
 // Desktop club view uses device-only profile metadata; no new remote reads.
 window.dispatchEvent(new CustomEvent("badminton:club-profiles",{detail:{players:[...state.players,...state.friends].map(p=>({id:p.id,name:p.name,club:p.club,ageClass:p.ageClass||""}))}}));
 updateLiveNavigation();
 SchmetterlingeRouter.renderPage(state);
}
let editing=null,editingVenue=null;
const tournamentSourceConflicts=new Map();
let verifiedCalendarRows=[];
function prefillVerifiedTournamentForm(form){
 const note=el("tournament-official-source");
 if(!note)return;
 note.hidden=true;note.textContent="";
 const data=new FormData(form);
 const parsed=parseDbvTournamentLink(data.get("url"));
 if(!parsed)return;
 if(!verifiedCalendarRows.length){
  note.textContent="DBV-Abgleich derzeit nicht verfügbar. Angaben bleiben lokal und ungeprüft.";
  note.hidden=false;
  return;
 }
 const draft=normalizeBookmark({url:parsed.url,playerId:String(data.get("playerId")||"all"),
  name:data.get("name"),startDate:data.get("startDate"),endDate:data.get("endDate"),
  place:data.get("place"),deadline:data.get("deadline")});
 const result=SchmetterlingeBookmarks.reconcileOfficialMetadata(draft,verifiedCalendarRows);
 if(result.status!=="matched"){
  note.textContent="Turnier-ID in den geladenen DBV-Daten nicht eindeutig bestätigt. Angaben bleiben lokal und ungeprüft.";
  note.hidden=false;
  return;
 }
 let corrected=0;
 for(const key of ["name","startDate","endDate","place","deadline"]){
  const field=form.elements.namedItem(key),value=result.updated?.[key];
  if(field&&value&&String(field.value||"")!==String(value)){
   field.value=value;corrected++;
  }
 }
 const fields=SchmetterlingeBookmarks.describeOfficialChanges(draft,result.updated);
 note.textContent=corrected
  ?"DBV-Quelle bestätigt: "+fields.join(", ")+" korrigiert. Spieltag und Meldeschluss sind getrennte Daten."
  :"DBV-Turnierdaten stimmen überein.";
 note.hidden=false;
}
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
 form.elements.namedItem("place").value=item?.place||"";
 form.elements.namedItem("deadline").value=item?.deadline||"";
 el("tournament-dialog-heading").textContent=item?"Turnier bearbeiten":"Turnier anlegen";
 el("tournament-save").textContent=item?"Änderungen speichern":"Turnier speichern";
 if(el("tournament-share"))el("tournament-share").checked=Boolean(item&&window.badmintonCommunity?.isShared(item));
 if(el("community-save-status")){el("community-save-status").hidden=true;el("community-save-status").textContent="";}
 prefillVerifiedTournamentForm(form);
 SchmetterlingeRouter.openDialog(dialog);
}
function setup(){
 window.addEventListener("badminton:today-events",event=>{
  const d=event.detail||{};
  todayNav={day:String(d.day||""),matchToday:d.matchToday===true};
  if(updateLiveNavigation())SchmetterlingeRouter.renderPage(state);
 });
 window.addEventListener("badminton:community-feedback",event=>{
  if(typeof event.detail?.message==="string")toast(event.detail.message);
 });
 // Local date rollover check only: no additional provider polling.
 setInterval(()=>{if(updateLiveNavigation())SchmetterlingeRouter.renderPage(state)},60_000);
 let freshDevice=false;
 try{freshDevice=!localStorage.getItem(STORE)}catch{}
 restore();
 // iOS Safari and an installed Home Screen PWA can have different local stores.
 // Do not manufacture an empty saved profile on a brand-new app installation.
 // Only persist an existing state here; a new profile is saved after consent.
 if(!freshDevice)save();
 // One-time local navigation hint, never an ownership or private data grant.
 try{
  const invited=localStorage.getItem("schmetterlinge.invitedPlayerPendingView.v1");
  if(/^[0-9]{2}-[0-9]{6}$/.test(invited||"")&&state.friends.some(p=>p.id===invited)){
   SchmetterlingeStorage.selectFriend(state,invited);
   localStorage.setItem("schmetterlinge.pendingPlayerDataCopy.v1",invited);
  }
  localStorage.removeItem("schmetterlinge.invitedPlayerPendingView.v1");
 }catch{/* Not required to enter the app. */}
 // An accepted private invitation is a followed player, not an own profile.
 if(!state.players.length&&state.friends.length)
  SchmetterlingeStorage.selectFriend(state,state.friends[0].id);
 SchmetterlingeSpond.mount({getState:()=>state,onChange:render});
 state.page=(location.hash||"#start").slice(1).split("/")[0];
 // A single delegated click handler covers ALL seven links, including a repeat
 // tap and a still-pending iPhone hashchange. Do not rely on anchor events alone.
 document.querySelector(".bottom-nav")?.addEventListener("click",event=>{
  const link=event.target.closest?.("a[data-page]");
  const page=link?.dataset.page;
  if(!page||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  navigatePrimary(page);
 },{capture:true});
 // IA-4: Home, Turniere, Heute, Freunde, Mannschaften, Berichte and
 // history previews all use the same immediate router as the bottom tabs.
 // Context anchors retain real hashes for browser Back, link sharing and reload.
 // Settings deep links, proof/result hashes and external sources remain untouched.
 document.addEventListener("click",event=>{
  if(event.defaultPrevented||event.button!==0||
     event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[href^="#"]');
  if(!link||link.closest(".bottom-nav")||link.hasAttribute("download")||
     link.target&&link.target!=="_self")return;
  const dest=link.getAttribute("href")?.slice(1)||"";
  if(!["start","turniere","live","spieler","verein","mannschaft","berichte","historie","spiele"].includes(dest))return;
  event.preventDefault();
  navigatePrimary(dest);
 });
 window.addEventListener("hashchange",()=>{
  const destination=location.hash||"#start";
  // navigatePrimary already painted this exact route and restored focus.
  // Do not do the expensive second render/focus/scroll on its native event.
  if(destination===lastRenderedHash)return;
  lastRenderedHash=destination;
  state.page=destination.slice(1).split("/")[0];
  // Never let an unrelated data renderer hold the old section on-screen.
  SchmetterlingeRouter.renderPage(state);
  try{render()}finally{
   SchmetterlingeRouter.renderPage(state);
   focusCurrentView();
   if(pendingFollowSearchFocus){
    pendingFollowSearchFocus=false;
    if(state.page==="spieler")el("followed-player-search")?.focus({preventScroll:true});
   }
  }
 });
 const playerDialog=el("player-dialog"),playerForm=el("player-form");
 let editingPlayerId=null,activatingNewProfile=false;
 // Search is read-only until the separate "Spieler speichern" form action.
 const ownSearch=document.createElement("section");
 ownSearch.id="own-player-search-panel";
 ownSearch.setAttribute("aria-label","Öffentliche DBV-Spielersuche");
 ownSearch.innerHTML='<label for="own-player-search">Spieler zuerst suchen (Name oder DBV-ID)<input id="own-player-search" type="search" minlength="3" maxlength="70" autocomplete="off" placeholder="Mindestens 3 Zeichen"></label><p id="own-player-search-status" role="status" aria-live="polite">Mindestens drei Zeichen eingeben oder unten manuell ergänzen.</p><div id="own-player-search-results" role="group" aria-label="Gefundene DBV-Spieler"></div><p class="small muted">Öffentliche Treffer sind keine Berechtigung zur Einsicht privater Daten. Auswahl füllt nur das Formular.</p>';
 playerForm.querySelector(".section-heading")?.insertAdjacentElement("afterend",ownSearch);
 const ownManualFallback=el("own-player-manual-fallback");
 const ownManualSummary=ownManualFallback.querySelector("summary");
 const ownSearchInput=ownSearch.querySelector("#own-player-search");
 const ownSearchStatus=ownSearch.querySelector("#own-player-search-status");
 const ownSearchResults=ownSearch.querySelector("#own-player-search-results");
 let ownSearchTimer=0,ownSearchController=null,ownSearchGeneration=0;
 function stopOwnSearch(){
  clearTimeout(ownSearchTimer);
  ownSearchController?.abort();
  ownSearchController=null;
  ++ownSearchGeneration;
 }
 function showOwnSearchResults(players,source){
  ownSearchResults.replaceChildren();
  for(const player of players.slice(0,12)){
   const isOwn=state.players.some(p=>p.id===player.id);
   const isFriend=state.friends.some(p=>p.id===player.id);
   const button=document.createElement("button");
   button.type="button";
   button.className="friend-follow-item";
   button.disabled=isOwn;
   const detail=[player.club,player.birthYear,player.ageClass,player.id].filter(Boolean).join(" · ");
   button.textContent=player.name+" — "+detail+(isOwn?" (bereits eigenes Profil)":isFriend?" (bereits gefolgt)":"");
   button.addEventListener("click",()=>{
    if(state.players.some(p=>p.id===player.id)){
     toast("Dieser Spieler ist bereits vorhanden");return;
    }
    playerForm.elements.namedItem("name").value=player.name;
    playerForm.elements.namedItem("id").value=player.id;
    playerForm.elements.namedItem("birthYear").value=player.birthYear||"";
    playerForm.elements.namedItem("club").value=player.club||"";
    playerForm.elements.namedItem("url").value=player.url||"";
    ownManualFallback.open=true;
    ownManualSummary.textContent="DBV-Treffer kontrollieren oder Angaben bearbeiten";
    ownSearchStatus.textContent="Ausgewählt: "+player.name+". Erst „Spieler speichern“ legt das eigene Profil an.";
    playerForm.elements.namedItem("name").focus();
   });
   ownSearchResults.append(button);
  }
  if(source==="restricted"||source==="restricted-device")
   ownSearchStatus.textContent="Offizielle Suche durch die Quelle gesperrt (401/403). Nur lokale Treffer; manuelle Eingabe möglich.";
  else if(source==="unavailable"||source==="unavailable-device")
   ownSearchStatus.textContent="Öffentliche Suche nicht erreichbar. Verfügbare lokale Treffer oder manuelle Eingabe nutzen.";
  else ownSearchStatus.textContent=players.length?players.length+" Treffer, maximal 12. Bitte den richtigen Verein/Jahrgang/DBV-ID prüfen.":"Keine Treffer. Spieler manuell ergänzen.";
 }
 ownSearchInput.addEventListener("input",()=>{
  stopOwnSearch();
  ownSearchResults.replaceChildren();
  const term=ownSearchInput.value.trim();
  if(editingPlayerId||term.length<3){
   ownSearchStatus.textContent="Mindestens drei Zeichen eingeben oder unten manuell ergänzen.";
   return;
  }
  const generation=ownSearchGeneration;
  ownSearchTimer=setTimeout(async()=>{
   const controller=new AbortController();
   ownSearchController=controller;
   ownSearchStatus.textContent="Suche nach öffentlichen DBV-Spielern …";
   try{
    const {searchInvitationPlayers}=await import("./scripts/invitation-search.mjs");
    if(controller.signal.aborted||generation!==ownSearchGeneration)return;
    const result=await searchInvitationPlayers(term,{
     signal:controller.signal,
     savedCandidates:[...state.players,...state.friends]
    });
    if(controller.signal.aborted||generation!==ownSearchGeneration)return;
    showOwnSearchResults(result.players,result.source);
   }catch(error){
    if(controller.signal.aborted||generation!==ownSearchGeneration)return;
    ownSearchStatus.textContent="Suche derzeit nicht erreichbar; bitte Spieler manuell ergänzen.";
   }
  },280);
 });
 playerDialog.addEventListener("close",stopOwnSearch);
 function openPlayerForm(p=null){
  editingPlayerId=p?.id||null;
  stopOwnSearch();
  ownSearchInput.value="";
  ownSearchResults.replaceChildren();
  ownSearchStatus.textContent="Mindestens drei Zeichen eingeben oder unten manuell ergänzen.";
  ownSearch.hidden=Boolean(p);
  ownManualFallback.open=Boolean(p);
  ownManualSummary.textContent=p?"Spielerprofil bearbeiten":"Spieler nicht gefunden? Manuell anlegen";
  playerForm.reset();
  playerForm.elements.namedItem("name").value=p?.name||"";
  playerForm.elements.namedItem("id").value=(p&&/^\d{2}-\d{6}$/.test(p.id))?p.id:"";
  playerForm.elements.namedItem("id").readOnly=Boolean(p);
  playerForm.elements.namedItem("birthYear").value=p?.birthYear||"";
  playerForm.elements.namedItem("club").value=p?.club||"";
  playerForm.elements.namedItem("url").value=p?.url||"";
  SchmetterlingeRouter.openDialog(playerDialog);
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
   // An already followed DBV player can also become a separately owned profile.
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
  SchmetterlingeRouter.openDialog(friendDialog);
 }
 window.openFriendForm=openFriendForm;
 el("dashboard-add-friend")?.addEventListener("click",event=>{event.preventDefault();showPlayerDiscover(true)});
 el("dashboard-friends-manage")?.addEventListener("click",()=>showPlayerDiscover(false,false));
 el("friend-order-done")?.addEventListener("click",()=>{
  const details=el("friend-manage-details");if(!details)return;
  details.open=false;details.querySelector("summary")?.focus({preventScroll:true});
 });
 el("friend-order-reset")?.addEventListener("click",()=>{
  if(state.friends.length<2)return;
  const before=state.friends.slice();
  state.friends.sort((a,b)=>a.name.localeCompare(b.name,"de",{numeric:true,sensitivity:"base"})||a.id.localeCompare(b.id));
  save();
  try{
   const saved=JSON.parse(localStorage.getItem(STORE)||"null");
   if(saved?.friends?.map(p=>p.id).join("|")!==state.friends.map(p=>p.id).join("|"))throw Error("not persisted");
  }catch{state.friends=before;render();toast("Reihenfolge konnte nicht gespeichert werden.");return;}
  render();el("friend-order-reset")?.focus({preventScroll:true});
  toast("Standardreihenfolge wiederhergestellt");
 });
 el("followed-player-search")?.addEventListener("input",syncFollowSearch);
 el("followed-show-all")?.addEventListener("click",()=>{const field=el("followed-player-search");if(field){field.value="";syncFollowSearch();field.focus()}});
 // Search and add share #followed-player-search; no second + panel.
  el("player-discover-close")?.addEventListener("click",()=>showPlayerDiscover(false,false));
  el("add-friend-manual").addEventListener("click",()=>openFriendForm());
 el("cancel-friend").addEventListener("click",()=>friendDialog.close());
 friendForm.addEventListener("submit",event=>{
  event.preventDefault();
  const data=new FormData(friendForm);
  const name=String(data.get("name")||"").trim().slice(0,80);
  const id=String(data.get("id")||"").trim();
  const birth=Number(data.get("birthYear"));
  if(!name||!/^\d{2}-\d{6}$/.test(id)){toast("Name und gültige DBV-ID erforderlich");return}
  if(state.friends.some(p=>p.id===id&&p.id!==editingFriendId)){toast("Dieser Spieler wird bereits gefolgt");return}
  if(!editingFriendId&&state.friends.length>=30){toast("Maximal 30 Freunde");return}
  const profileUrl=safeUrl(data.get("url")||"");
  const friend={id,name,birthYear:birth>=2000&&birth<=2035?birth:undefined,club:String(data.get("club")||"").trim().slice(0,120),url:profileUrl};
  const isNewFriend=!editingFriendId;
  if(editingFriendId)state.friends=state.friends.map(p=>p.id===editingFriendId?friend:p);
  else state.friends.push(friend);
  editingFriendId=null;
  if(isNewFriend)showPlayerDiscover(false,false);
   save();render();friendDialog.close();friendForm.reset();toast("Freund gespeichert");
  if(isNewFriend)window.dispatchEvent(new CustomEvent("badminton:friend-followed",{detail:{playerId:id}}));
 });
 window.addEventListener("badminton:dbv-calendar-loaded",event=>{
  const entries=event.detail?.entries;
  if(!Array.isArray(entries)||!entries.length)return;
  verifiedCalendarRows=entries;
  const form=el("tournament-form");
  if(el("tournament-dialog")?.open&&form)prefillVerifiedTournamentForm(form);
  let changed=false;
  const previousWarnings=JSON.stringify([...tournamentSourceConflicts.entries()]);
  tournamentSourceConflicts.clear();
  const reconciled=state.officialLinks.map(bookmark=>{
   const result=SchmetterlingeBookmarks.reconcileOfficialMetadata(bookmark,entries);
   if(result.status==="conflict")tournamentSourceConflicts.set(bookmark.id+"|"+bookmark.playerId,result);
   if(result.status==="matched"&&result.updated!==bookmark){changed=true;return result.updated}
   return bookmark;
  });
  const warningsChanged=JSON.stringify([...tournamentSourceConflicts.entries()])!==previousWarnings;
  if(changed){state.officialLinks=reconciled;save()}
  // Background calendar reads must not reset the active profile or ranking view.
  if(changed||warningsChanged)render();
 });
 const venueDialog=el("tournament-venue-dialog");
 el("tournament-venue-close").addEventListener("click",()=>{editingVenue=null;venueDialog.close()});
 el("tournament-venue-form").addEventListener("submit",event=>{
  event.preventDefault();
  if(!editingVenue)return;
  const current=state.officialLinks.find(t=>t.id===editingVenue.id&&t.playerId===editingVenue.playerId);
  const raw=String(event.currentTarget.elements.namedItem("place")?.value||"");
  const updated=SchmetterlingeBookmarks.updateLocalCalendarVenue(current,raw);
  if(!updated){toast("Austragungsort konnte nicht gespeichert werden.");return;}
  state.officialLinks=state.officialLinks.map(t=>t===current?updated:t);
  editingVenue=null;
  save();render();venueDialog.close();
  toast("Austragungsort nur in dieser privaten Vormerkung gespeichert");
 });
 const tournamentDialog=el("tournament-dialog");
 el("add-tournament").addEventListener("click",()=>openTournamentForm());
 el("cancel-tournament").addEventListener("click",()=>tournamentDialog.close());
 el("tournament-form").elements.namedItem("url").addEventListener("change",()=>prefillVerifiedTournamentForm(el("tournament-form")));
 el("tournament-form").addEventListener("submit",event=>{
  event.preventDefault();
  prefillVerifiedTournamentForm(event.currentTarget);
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
  let bookmark=normalizeBookmark({url:parsed.url,playerId,name:data.get("name"),startDate:start,endDate:end,
   place:data.get("place"),deadline:data.get("deadline")});
  // Same verified UUID => DBV is authoritative. Correct stale local dates,
  // category, name and venue; preserve personal bookmark/player attachment.
  const officialCheck=SchmetterlingeBookmarks.reconcileOfficialMetadata(bookmark,verifiedCalendarRows);
  if(officialCheck.status==="matched")bookmark=officialCheck.updated;
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
   window.dispatchEvent(new CustomEvent("badminton:profile-selected",{detail:{playerId:b.dataset.initialPlayer,source:"onboarding"}}));
  }));
  el("first-run-new").addEventListener("click",()=>{
   welcome.close();window.location.assign("./welcome.html?from=app");
  });
  // An installed PWA with no own profile must be able to import a Safari
  // backup first. Do not bypass verified access or merge any identities.
  el("first-run-restore").addEventListener("click",()=>{
   welcome.close();
   window.location.hash="#einstellungen/daten";
   render();
  });
  // A fast member check may finish before DOMContentLoaded; installed WebKit
  // may also restore this document on pageshow after "Zur App". Recheck the
  // existing server-verified grant without ever treating local storage as auth.
  const showFirstRunWhenGranted=()=>{
   if(state.players.length||state.friends.length||welcome.open)return;
   if(window.badmintonAppAccess?.allowed!==true)return;
   // A new installed PWA has no profile yet. Do not let onboarding cover
   // the explicitly requested local backup restore screen; the server-side
   // app-access gate remains mandatory and no new profile is fabricated.
   if(window.location.hash==="#einstellungen/daten")return;
   if(document.querySelector("dialog[open]"))return;
   SchmetterlingeRouter.openDialog(welcome);
  };
  window.addEventListener("badminton:app-access-granted",showFirstRunWhenGranted);
  window.addEventListener("pageshow",showFirstRunWhenGranted);
  showFirstRunWhenGranted();
  setTimeout(showFirstRunWhenGranted,350);
 }
 window.SchmetterlingePwaUpdate?.initialize();
}
document.addEventListener("DOMContentLoaded",setup);
