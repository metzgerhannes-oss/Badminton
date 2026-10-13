"use strict";
/* Settings rooms v120. Existing controls, local storage and data ownership stay unchanged.
   Progressive enhancement: when this file fails, the original settings remain usable. */
(function(){
 const view=document.getElementById("view-einstellungen");
 if(!view)return;
 const definitions=[
  {id:"profile",title:"Profile & Familie",desc:"Eigene Spieler, Elternfreigaben und Gerätezugang",group:"Spieler & Mannschaften",icon:"♙"},
  {id:"spieler",title:"Gefolgte Spieler",desc:"Suchen, sortieren, bearbeiten und entfolgen",group:"Spieler & Mannschaften",icon:"◉"},
  {id:"mannschaften",title:"Gefolgte Mannschaften",desc:"Deine Teams und ihre Reihenfolge",group:"Spieler & Mannschaften",icon:"▤"},
  {id:"darstellung",title:"Sprache & Vereinsdesign",desc:"Sprache, Name, Logo und Vereinsfarbe",group:"App & Daten",icon:"◐"},
  {id:"einladungen",title:"Einladungen",desc:"Familie und Freunde zur App einladen",group:"App & Daten",icon:"↗"},
  {id:"daten",title:"Sicherung & Datenschutz",desc:"Gerätewechsel, Export und Datenschutz",group:"App & Daten",icon:"▣"},
  {id:"quellen",title:"Datenquellen",desc:"Herkunft und Qualität der Informationen",group:"App & Daten",icon:"◎"}
 ];
 const hub=document.createElement("div");
 hub.id="settings-room-hub";hub.className="settings-room-hub";
 const lead=document.createElement("p");lead.className="settings-hub-lead";
 lead.textContent="Wähle einen Bereich. Deine persönlichen Einstellungen und Folgen-Listen bleiben auf diesem Gerät.";
 hub.append(lead);
 const groups=new Map();
 for(const d of definitions){
  if(!groups.has(d.group)){
   const section=document.createElement("section");section.className="settings-hub-group";
   const heading=document.createElement("h3");heading.textContent=d.group;
   const grid=document.createElement("div");grid.className="settings-hub-grid";
   section.append(heading,grid);hub.append(section);groups.set(d.group,grid);
  }
  const a=document.createElement("a");a.href="#einstellungen/"+d.id;
  a.className="settings-room-link";a.dataset.settingsTarget=d.id;
  const icon=document.createElement("span");icon.className="settings-room-icon";icon.setAttribute("aria-hidden","true");icon.textContent=d.icon;
  const copy=document.createElement("span");copy.className="settings-room-copy";
  const title=document.createElement("strong");title.textContent=d.title;
  const subtitle=document.createElement("small");subtitle.textContent=d.desc;
  const count=document.createElement("span");count.className="settings-room-count";count.dataset.settingsCount=d.id;count.hidden=true;
  const arrow=document.createElement("span");arrow.className="settings-room-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent="›";
  copy.append(title,subtitle,count);a.append(icon,copy,arrow);groups.get(d.group).append(a);
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
 // Split one old, overloaded follow card into two independently managed rooms.
 const follow=view.querySelector(".follow-settings");
 const followedTeamHeading=follow?.querySelectorAll(".follow-hub-subheading")[1];
 const followedTeamList=follow?.querySelector("#team-settings-list");
 if(!follow||!followedTeamHeading||!followedTeamList)return;
 const teamSection=document.createElement("section");
 teamSection.className="settings-card follow-settings";
 const teamLabel=document.createElement("p");teamLabel.className="settings-hint";
 teamLabel.textContent="Hier verwaltest du nur die Mannschaften, denen du folgst. Die Reihenfolge bleibt lokal gespeichert.";
 teamSection.append(teamLabel,followedTeamHeading,followedTeamList);
 const oldTitle=follow.querySelector("#follow-settings-title");
 if(oldTitle)oldTitle.textContent="Meine gefolgten Spieler";
 const oldHint=follow.querySelector(".settings-hint");
 if(oldHint)oldHint.textContent="Behalte den Überblick: Suche nach Namen oder DBV-ID, ändere die Reihenfolge oder entfolge einem Spieler.";
 const searchWrap=document.createElement("label");searchWrap.className="settings-friend-search-label";
 searchWrap.textContent="Gefolgte Spieler suchen";
 const search=document.createElement("input");search.type="search";search.id="settings-followed-player-search";
 search.placeholder="Name oder DBV-ID";search.autocomplete="off";
 search.setAttribute("aria-controls","friend-settings-list");searchWrap.append(search);
 const list=follow.querySelector("#friend-settings-list");
 follow.insertBefore(searchWrap,follow.querySelector(".follow-hub-subheading"));
 const noResults=document.createElement("p");noResults.id="settings-followed-empty";
 noResults.className="settings-hint";noResults.hidden=true;
 noResults.textContent="Kein gefolgter Spieler passt zu deiner Suche.";
 list?.after(noResults);
 rooms.get("spieler").room.append(follow);
 rooms.get("mannschaften").room.append(teamSection);
 appendTo("profile",".player-management");
 appendTo("profile","#owner-admin-panel");
 appendTo("profile","#owner-activation-setup");
 appendTo("darstellung",".language-settings");
 appendTo("darstellung",".club-branding-card");
 appendTo("einladungen",".invitation-card");
 appendTo("daten",".backup-card");
 const loose=[...view.children].filter(el=>el.classList?.contains("settings-card"));
 for(const element of loose){
  const heading=element.querySelector("h3")?.textContent?.trim()||"";
  if(heading==="Daten & Datenschutz")rooms.get("daten").room.append(element);
  if(heading==="Datenquellen & Nachweise")rooms.get("quellen").room.append(element);
 }
 function filterFollowed(){
  const query=search.value.normalize("NFKC").toLocaleLowerCase("de").trim();
  let total=0,shown=0;
  for(const card of list.querySelectorAll(".follow-manage-item")){
   total++;
   const visible=!query||card.textContent.normalize("NFKC").toLocaleLowerCase("de").includes(query);
   card.hidden=!visible;
   if(visible)shown++;
  }
  noResults.hidden=!(query&&total>0&&shown===0);
 }
 search.addEventListener("input",filterFollowed);
 if(list){
  const observer=new MutationObserver(filterFollowed);
  observer.observe(list,{childList:true});
 }
 function updateCounts(){
  let friends=0,players=0;
  try{
   const data=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
   friends=Array.isArray(data.friends)?data.friends.length:0;
   players=Array.isArray(data.players)?data.players.length:0;
  }catch{}
  const counts={spieler:friends,profile:players};
  for(const [id,count] of Object.entries(counts)){
   const target=hub.querySelector('[data-settings-count="'+id+'"]');
   if(target){target.hidden=false;target.textContent=count===1?"1 Profil":count+" "+(id==="spieler"?"gefolgte Spieler":"Profile");}
  }
 }
 function resolve(){
  const match=/^#einstellungen(?:\/([a-z-]+))?$/.exec(location.hash);
  if(!match)return null;
  return rooms.has(match[1])?match[1]:"";
 }
 let previous=null;
 function sync(){
  const key=resolve();
  if(key===null)return;
  hub.hidden=Boolean(key);
  for(const [id,v] of rooms)v.room.hidden=id!==key;
  updateCounts();filterFollowed();
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
 window.addEventListener("hashchange",sync);
 window.addEventListener("pageshow",sync);
 window.addEventListener("storage",updateCounts);
 window.addEventListener("badminton:friend-followed",updateCounts);
 sync();
})();
