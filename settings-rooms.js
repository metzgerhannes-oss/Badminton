"use strict";
/* IA-3 / v184: five canonical settings rooms. All existing controls and storage remain unchanged.
   Progressive enhancement: when this file fails, the original settings remain usable. */
(function(){
 const view=document.getElementById("view-einstellungen");
 if(!view)return;
 const definitions=[
  {id:"profile",title:"Profile & Familie",desc:"Eigene Spielerprofile anlegen, auswählen und verwalten",icon:"♙"},
  {id:"darstellung",title:"App & Darstellung",desc:"Sprache, Vereinsname, Logo und Erscheinungsbild",icon:"◐"},
  {id:"einladungen",title:"Zugänge & Freigaben",desc:"Einladungen, Spielerberechtigungen und Eigentümerzugang",icon:"↗"},
  {id:"daten",title:"Daten & Datenschutz",desc:"Datensicherung, Wiederherstellung und Privatsphäre",icon:"▣"},
  {id:"hilfe",title:"Hilfe & Informationen",desc:"Regeln, App-Anleitung und Datenquellen",icon:"?"}
 ];
 const hub=document.createElement("div");
 hub.id="settings-room-hub";hub.className="settings-room-hub";
 const lead=document.createElement("p");lead.className="settings-hub-lead";
 lead.textContent="Fünf Bereiche – jede Einstellung an genau einer Stelle.";
 const grid=document.createElement("nav");grid.className="settings-hub-grid";
 grid.setAttribute("aria-label","Einstellungsbereiche");
 hub.append(lead,grid);
 for(const d of definitions){
  const a=document.createElement("a");a.href="#einstellungen/"+d.id;
  a.className="settings-room-link";a.dataset.settingsTarget=d.id;
  const icon=document.createElement("span");icon.className="settings-room-icon";icon.setAttribute("aria-hidden","true");icon.textContent=d.icon;
  const copy=document.createElement("span");copy.className="settings-room-copy";
  const title=document.createElement("strong");title.textContent=d.title;
  const subtitle=document.createElement("small");subtitle.textContent=d.desc;
  const count=document.createElement("span");count.className="settings-room-count";count.dataset.settingsCount=d.id;count.hidden=true;
  const arrow=document.createElement("span");arrow.className="settings-room-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent="›";
  copy.append(title,subtitle,count);a.append(icon,copy,arrow);grid.append(a);
 }
 const rooms=new Map();
 function makeRoom(d){
  const room=document.createElement("section");room.className="settings-room";
  room.dataset.settingsRoom=d.id;room.id="settings-room-"+d.id;room.hidden=true;
  const header=document.createElement("div");header.className="settings-room-header";
  const back=document.createElement("a");back.href="#einstellungen";back.className="settings-room-back";back.textContent="‹ Alle Einstellungen";
  const title=document.createElement("h3");title.textContent=d.title;title.tabIndex=-1;
  const intro=document.createElement("p");intro.textContent=d.desc;
  header.append(back,title,intro);room.append(header);
  view.append(room);rooms.set(d.id,{room,title});
  return room;
 }
 const titleNode=view.querySelector("#heading-einstellungen");
 const build=view.querySelector("#app-build-info");
 if(build?.nextSibling)view.insertBefore(hub,build.nextSibling);
 else view.append(hub);
 for(const d of definitions)makeRoom(d);
 function appendTo(key,selector){
  const node=view.querySelector(selector);
  if(!node)throw Error("Settings room missing control: "+selector);
  rooms.get(key).room.append(node);return node;
 }
 // IA-2: follower management lives in subject pages, never a second settings room.
 appendTo("profile",".player-management");
 appendTo("darstellung",".language-settings");
 appendTo("darstellung",".club-branding-card");
 // A v136 app invitation grants entry to the sourced sport archive.
 // Owner grants and activation live beside app invitations, never in family
 // profile editing or a duplicated management screen.
 appendTo("einladungen",".invitation-card");
 // When the owner session is missing, do not silently remove every way to
 // create invitations: explain the restriction and allow a fresh server check.
 const inviteHelp=document.createElement("section");
 inviteHelp.id="invite-access-help";
 inviteHelp.className="settings-card invite-access-help";
 inviteHelp.hidden=true;
 inviteHelp.innerHTML='<h3>Neue Freigabe</h3>'+
  '<p id="invite-access-message" role="status" aria-live="polite">Betreiberberechtigung wird geprüft …</p>'+
  '<button id="invite-access-recheck" class="outline-button" type="button">Berechtigung erneut prüfen</button>'+
  '<p class="settings-hint">Familien-Einladungen können nur durch ein bestätigtes Betreiberkonto erstellt werden. Ein einzelnes Spielerprofil teilst du unter „Profile &amp; Familie“ über „Profil privat teilen“, wenn deine Berechtigung bestätigt ist.</p>';
 rooms.get("einladungen").room.append(inviteHelp);
 appendTo("einladungen","#owner-admin-panel");
 appendTo("einladungen","#owner-activation-setup");
 appendTo("daten",".backup-card");
 const loose=[...view.children].filter(el=>el.classList?.contains("settings-card"));
 for(const element of loose){
  const heading=element.querySelector("h3")?.textContent?.trim()||"";
  if(heading==="Daten & Datenschutz")rooms.get("daten").room.append(element);
  if(heading==="Datenquellen & Nachweise")rooms.get("hilfe").room.append(element);
 }
 // Device-local overview only: no authentication, data writes or server-status claims.
 const grantRoom=rooms.get("einladungen").room;
 const grantHub=document.createElement("div");grantHub.className="settings-grants";grantHub.id="settings-grants-overview";
 const make=(tag,cls,label)=>{const el=document.createElement(tag);el.className=cls||"";if(label)el.textContent=label;return el};
 const issuedCard=make("section","settings-card settings-grant-card");
 issuedCard.append(make("h4","","Von mir erteilte Freigaben"));
 const issuedInfo=make("p","settings-hint","Auf diesem Gerät gespeicherte Linkinformationen. Ob ein Link angenommen oder widerrufen wurde, wird hier noch nicht serverseitig geprüft.");
 const issuedList=make("ul","settings-grant-list");issuedList.id="settings-grant-issued";
 issuedCard.append(issuedInfo,issuedList);
  const receivedCard=make("section","settings-card settings-grant-card");
 receivedCard.append(make("h4","","Von mir angenommene Freigaben"),
  make("p","settings-hint","Annahmen sind an die technische Sitzung dieses Geräts gebunden. Jeder Zugriff wird erst beim Öffnen auf dem Server geprüft."));
 const receivedList=make("ul","settings-grant-list");receivedList.id="settings-grant-received";receivedCard.append(receivedList);
 grantHub.append(issuedCard,receivedCard);
 grantRoom.append(grantHub);
 // Help never opens a second way to manage profiles, follows or permissions.
 const help=rooms.get("hilfe").room;
 const helpCard=make("section","settings-card settings-grant-card");
 helpCard.append(make("h4","","Hilfe zur App"),
  make("p","settings-hint","Kurze Anleitungen und Badminton-Wissen. Persönliche Daten werden dafür nicht übertragen."));
 const helpLinks=[
  {title:"Einrichtung und Installation ↗",href:"./welcome.html#installation"},
  {title:"Badminton-Wiki und Regeln ↗",href:"./wiki.html"}
 ];
 for(const item of helpLinks){
  const link=make("a","settings-grant-action",item.title);link.href=item.href;
  helpCard.append(link);
 }
 help.append(helpCard);
 const validDbv=id=>/^[0-9]{2}-[0-9]{6}$/.test(id);
 const validUuid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
 function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}}
 function empty(list,message){const li=make("li","settings-grant-empty",message);list.append(li)}
 function refreshGrants(){
  issuedList.replaceChildren();receivedList.replaceChildren();
  const local=readLocal("shuttleboard-v1",{}),own=Array.isArray(local?.players)?local.players:[];
  const names=new Map(own.filter(p=>validDbv(p?.id)).map(p=>[p.id,p.name||p.id]));
  const stored=readLocal("schmetterlinge.privatePlayerInvites.v1",{});
  let issuedCount=0;
  if(stored&&typeof stored==="object"&&!Array.isArray(stored)){
   for(const [dbv,items] of Object.entries(stored)){
    if(!validDbv(dbv))continue;
    for(const invitation of (Array.isArray(items)?items:[items])){
     if(!validUuid(invitation?.id)||issuedCount>=30)continue;
     const li=make("li","settings-grant-entry");
     li.append(make("strong","",names.get(dbv)||"Spieler "+dbv));
     const expiration=Date.parse(invitation?.expires);
     const expiry=Number.isFinite(expiration)?
      (expiration>Date.now()?"Annahmefrist bis ":"Annahmefrist beendet am ")+new Date(expiration).toLocaleDateString("de-DE"):
      "Annahmefrist unbekannt";
     li.append(make("span","",expiry+" · Annahmestatus nicht geprüft"));
     issuedList.append(li);issuedCount++;
    }
   }
  }
  if(!issuedCount)empty(issuedList,"Keine auf diesem Gerät gespeicherten Spielerlinks.");
  const received=readLocal("schmetterlinge.acceptedPlayerInvite.v3",[]);
  const ids=Array.isArray(received)?received:(received?.id?[received.id]:[]);
  const unique=[...new Set(ids.filter(validUuid))].slice(-20);
  unique.forEach((id,i)=>{
   const li=make("li","settings-grant-entry");
   li.append(make("strong","","Gespeicherter Spielerzugang "+(i+1)));
   const anchor=make("a","settings-grant-action","Zugang sicher prüfen ↗");
   anchor.href="./private-player.html#access="+id;
   li.append(anchor);receivedList.append(li);
  });
  if(!unique.length)empty(receivedList,"Noch keine auf diesem Gerät angenommenen Spielerrechte.");
 }
 function updateCounts(){
  let players=0;
  try{
   const data=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
   players=Array.isArray(data.players)?data.players.length:0;
  }catch{}
  const counts={profile:players};
  for(const [id,count] of Object.entries(counts)){
   const target=hub.querySelector('[data-settings-count="'+id+'"]');
   if(target){target.hidden=false;target.textContent=count===1?"1 Profil":count+" Profile";}
  }
 }
 function resolve(){
  const match=/^#einstellungen(?:\/([a-z-]+))?$/.exec(location.hash);
  if(!match)return null;
  return rooms.has(match[1])?match[1]:"";
 }
 let previous=null;
 function sync(){
  // Preserve old bookmarked settings links without leaving dead rooms.
  const redirect={"#einstellungen/spieler":"#spieler","#einstellungen/mannschaften":"#mannschaft",
   "#einstellungen/quellen":"#einstellungen/hilfe"}[location.hash];
  if(redirect){location.replace(redirect);return}
  const key=resolve();
  if(key===null)return;
  hub.hidden=Boolean(key);
  for(const [id,v] of rooms)v.room.hidden=id!==key;
  updateCounts();if(key==="einladungen")refreshGrants();
  if(key!==previous){
   previous=key;
   if(key){
    const room=rooms.get(key);
    document.title=room.title.textContent+" · Einstellungen · Schmetterlinge";
    room.title.focus({preventScroll:true});
   }else{
    document.title="Einstellungen · Schmetterlinge";
    titleNode?.focus({preventScroll:true});
   }
  }
 }
 // IA-5: Settings navigation must not wait for an unreliable iOS hashchange.
 // The hash remains the history source of truth for Back/Forward and bookmarks.
 view.addEventListener("click",event=>{
  const link=event.target.closest?.("a.settings-room-link, a.settings-room-back");
  if(!link||!view.contains(link)||event.defaultPrevented||
     event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const destination=link.getAttribute("href")||"";
  const match=/^#einstellungen(?:\/([a-z-]+))?$/.exec(destination);
  if(!match||(match[1]&&!rooms.has(match[1])))return;
  event.preventDefault();
  if(location.hash!==destination)location.hash=destination;
  sync();
 });
 window.addEventListener("hashchange",sync);
 window.addEventListener("pageshow",sync);
 window.addEventListener("storage",updateCounts);
 window.addEventListener("storage",()=>{if(resolve()==="einladungen")refreshGrants()});
 sync();
})();
