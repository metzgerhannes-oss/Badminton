"use strict";
/* Desktop turniertag context, read-only. Uses existing local model and actions.
   No fetch, timers, persistence, permissions or background polling. */
(function(){
 const root=()=>document.getElementById("desktop-tournament-context");
 const events=()=>document.getElementById("desktop-context-events");
 const formatDay=day=>new Intl.DateTimeFormat("de-DE",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric"}).format(new Date(day+"T12:00:00Z"));
 function render(){
  const host=events();if(!host)return;
  const context=window.badmintonDesktopContext?.();
  host.replaceChildren();
  if(!context?.own){
   const p=document.createElement("p");
   p.textContent="Wähle ein eigenes Spielerprofil, um private Vormerkungen und Kalenderimporte zu sehen.";
   host.append(p);return;
  }
  if(!context.events?.length){
   const p=document.createElement("p");
   p.textContent="Noch keine datierten Termine für dieses Profil gespeichert. Im DBV-Kalender kannst du Turniere vormerken.";
   host.append(p);return;
  }
  for(const item of context.events){
   const card=document.createElement("article");
   card.className="desktop-context-event";
   const title=document.createElement("strong");title.textContent=item.name;
   const date=document.createElement("time");
   date.dateTime=item.startDate;
   date.textContent=formatDay(item.startDate)+(item.endDate!==item.startDate?" – "+formatDay(item.endDate):"");
   const note=document.createElement("small");note.textContent=item.note;
   card.append(title,date,note);
   if(item.url){
    const link=document.createElement("a");link.href=item.url;
    link.target="_blank";link.rel="noopener noreferrer";
    link.textContent="Originalquelle öffnen ↗";card.append(link);
   }
   host.append(card);
  }
 }
 function act(action){
  if(action==="follow"){document.getElementById("player-add-open")?.click();return}
  if(action==="add-tournament"){document.getElementById("add-tournament")?.click();return}
  if(action==="import"){document.getElementById("spond-quick-import")?.click();return}
  const dest=action==="calendar"?"dbv-calendar-heading":action==="schedule"?"tournament-live-select":null;
  const node=dest&&document.getElementById(dest);
  if(!node)return;
  node.scrollIntoView({block:"start",behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"});
  if(action==="schedule")node.focus({preventScroll:true});
  if(action==="calendar")document.getElementById("dbv-calendar-q")?.focus({preventScroll:true});
 }
 document.addEventListener("DOMContentLoaded",()=>{
  if(!root())return;
  root().addEventListener("click",event=>{
   const button=event.target.closest("button[data-desktop-action]");
   if(button)act(button.dataset.desktopAction);
  });
  window.addEventListener("badminton:tournament-bookmarks",render);
  window.addEventListener("badminton:profile-change",render);
  window.addEventListener("hashchange",render);
  render();
 });
})();
