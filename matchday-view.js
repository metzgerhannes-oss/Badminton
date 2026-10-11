"use strict";
/** One matchday decision: player or entire verified event. */
(function(){
 let mode="mine",previous="";
 const onLive=()=>location.hash==="#live";
 function sync(){
  const current=location.hash;
  if(current==="#live"&&previous!=="#live")mode="mine";
  previous=current;
  window.badmintonMatchdayMode=mode;
  document.querySelector(".app")?.setAttribute("data-matchday-mode",mode);
  document.querySelectorAll("[data-matchday-view]").forEach(button=>
   button.setAttribute("aria-pressed",String(button.dataset.matchdayView===mode)));
  window.dispatchEvent(new CustomEvent("badminton:matchday-mode",{detail:{mode,live:onLive()}}));
 }
 document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("[data-matchday-view]").forEach(button=>
   button.addEventListener("click",()=>{
    const next=button.dataset.matchdayView;
    if(!onLive()||!["mine","all"].includes(next)||next===mode)return;
    mode=next;sync();
   }));
  window.addEventListener("hashchange",sync);
  sync();
 });
})();
