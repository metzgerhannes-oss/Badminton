"use strict";
/** Single route/controller for the existing 4 destinations plus history and settings. */
var SchmetterlingeRouter=(function(){
// Only in-memory navigation positions; never read/write profile storage or backend data.
let currentHash=location.hash||"#start";
let returningByHistory=false;
const scrollPositions=new Map();
const dialogOpeners=new WeakMap();
function rememberScroll(){
 scrollPositions.set(currentHash,Math.max(0,window.scrollY||0));
}
window.addEventListener("scroll",rememberScroll,{passive:true});
window.addEventListener("popstate",()=>{returningByHistory=true});
// Save the departing screen before browser anchor navigation changes the hash.
document.addEventListener("click",event=>{
 if(event.target.closest?.('a[href^="#"]'))rememberScroll();
},true);
function finishNavigation(){
 const target=location.hash||"#start";
 const position=returningByHistory?scrollPositions.get(target)||0:0;
 currentHash=target;
 returningByHistory=false;
 // Let the target view render and the on-screen keyboard/focus settle.
 requestAnimationFrame(()=>window.scrollTo({top:position,behavior:"auto"}));
}
function openDialog(dialog){
 if(!dialog)return;
 const opener=document.activeElement;
 if(opener instanceof HTMLElement&&!dialog.contains(opener))dialogOpeners.set(dialog,opener);
 if(!dialog.dataset.focusReturnWired){
  dialog.dataset.focusReturnWired="true";
  dialog.addEventListener("close",()=>{
   const previous=dialogOpeners.get(dialog);
   dialogOpeners.delete(dialog);
   if(document.querySelector("dialog[open]"))return;
   // Browser focus restoration generally works; repair Safari where it does not.
   if(document.activeElement!==document.body&&document.activeElement!==document.documentElement)return;
   if(previous?.isConnected&&previous.getClientRects().length){
    previous.focus({preventScroll:true});return;
   }
   const fallback=document.querySelector(".page.active h1, .page.active h2");
   if(fallback){fallback.setAttribute("tabindex","-1");fallback.focus({preventScroll:true});}
  });
 }
 dialog.showModal();
}
function routeTo(state,page,render){
 rememberScroll();
 state.page=page;
 if(location.hash!=="#"+page)location.hash="#"+page;
 else{render();focusCurrentView(state);}
}
// Keyboard and assistive-technology users must land at the new screen heading,
// not remain on a nav link while a different view is shown.
function focusCurrentView(state){
 const page=["start","historie","turniere","live","berichte","spieler","verein","mannschaft","spiele","einstellungen"].includes(state.page)
  ?state.page:"start";
 const view=page==="live"?"turniere":page;
  const heading=document.querySelector("#view-"+view+" h1, #view-"+view+" h2");
 if(heading){
  heading.setAttribute("tabindex","-1");
  heading.focus({preventScroll:true});
 }
 finishNavigation();
}

 function renderPage(state){
 const page=["start","historie","turniere","live","berichte","spieler","verein","mannschaft","spiele","einstellungen"].includes(state.page)?state.page:"start";
  const view=page==="live"?"turniere":page;
 document.querySelector(".app")?.setAttribute("data-current-view",page);
 document.querySelectorAll(".page").forEach(e=>e.classList.toggle("active",e.id==="view-"+view));
 const routeTitles={start:"Übersicht",historie:"Turnierhistorie",turniere:"Turniertag",live:"Live-Matches",
  spieler:"Spieler",verein:"Vereinsübersicht",mannschaft:"Mannschaft",berichte:"Berichte",spiele:"Spielecke",einstellungen:"Einstellungen"};
 document.title=routeTitles[page]+" · Schmetterlinge";
 const activeTab=page==="historie"||page==="live"?"turniere":page;
 const todayShortcut=document.querySelector("#live-nav-tab");
 if(todayShortcut){
  if(page==="live")todayShortcut.setAttribute("aria-current","page");
  else todayShortcut.removeAttribute("aria-current");
 }
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
 return Object.freeze({routeTo,focusCurrentView,renderPage,openDialog});
})();
