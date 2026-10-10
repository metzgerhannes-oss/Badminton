"use strict";
/** Single route/controller for the existing 4 destinations plus history and settings. */
var SchmetterlingeRouter=(function(){
function routeTo(state,page,render){
 state.page=page;
 if(location.hash!=="#"+page)location.hash="#"+page;
 else{render();focusCurrentView(state);}
}
// Keyboard and assistive-technology users must land at the new screen heading,
// not remain on a nav link while a different view is shown.
function focusCurrentView(state){
 const page=["start","historie","turniere","berichte","spieler","einstellungen"].includes(state.page)
  ?state.page:"start";
 const heading=document.querySelector("#view-"+page+" h1, #view-"+page+" h2");
 if(heading){
  heading.setAttribute("tabindex","-1");
  heading.focus({preventScroll:true});
 }
 window.scrollTo({top:0,behavior:"auto"});
}

 function renderPage(state){
 const page=["start","historie","turniere","berichte","spieler","einstellungen"].includes(state.page)?state.page:"start";
 document.querySelector(".app")?.setAttribute("data-current-view",page);
 document.querySelectorAll(".page").forEach(e=>e.classList.toggle("active",e.id==="view-"+page));
 const routeTitles={start:"Übersicht",historie:"Turnierhistorie",turniere:"Turniertag",
  spieler:"Spieler",berichte:"Berichte",einstellungen:"Einstellungen"};
 document.title=routeTitles[page]+" · Schmetterlinge";
 const activeTab=page==="historie"?"turniere":page;
 document.querySelectorAll(".bottom-nav a").forEach(a=>{
  if(a.dataset.page===activeTab)a.setAttribute("aria-current","page");
  else a.removeAttribute("aria-current");
 });
 const settingsLink=document.querySelector(".topbar-settings");
 if(settingsLink){
  if(page==="einstellungen")settingsLink.setAttribute("aria-current","page");
  else settingsLink.removeAttribute("aria-current");
 }
 }
 return Object.freeze({routeTo,focusCurrentView,renderPage});
})();
