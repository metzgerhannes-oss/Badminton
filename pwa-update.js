"use strict";
/* P0 / #302: prompt for a verified newer *static* release once per app start.
 * No user profile changes, third-party requests, long-lived polling, or silent
 * page reload during data entry. WebKit may preserve an older PWA document
 * even after a new service worker activates. */
(function(){
 const MIN_CHECK_GAP=6*60*60*1000;
 let initialized=false,lastChecked=0,registration=null,offered="";
 const releaseNumber=s=>/^v[1-9][0-9]*$/.test(String(s||""))?Number(String(s).slice(1)):null;
 function offerUpdate(version){
  if(offered===version||document.getElementById("pwa-update-prompt"))return;
  offered=version;
  const panel=document.createElement("section");
  panel.id="pwa-update-prompt";
  panel.className="pwa-update-prompt";
  panel.setAttribute("role","status");
  panel.setAttribute("aria-label","Neue App-Version verfügbar");
  const copy=document.createElement("span");
  copy.className="pwa-update-copy";
  copy.textContent="Schmetterlinge "+version+" ist verfügbar. Deine gespeicherten Daten bleiben erhalten.";
  const button=document.createElement("button");
  button.type="button";
  button.id="pwa-update-apply";
  button.textContent="Jetzt aktualisieren";
  button.addEventListener("click",async()=>{
   button.disabled=true;
   button.textContent="Aktualisierung wird geöffnet …";
   // Update only the worker; existing profiles and invitations must remain in
   // their current localStorage. A fresh shell URL bypasses iOS's HTML cache.
   try{
    if(registration)await Promise.race([
     registration.update().catch(()=>{}),
     new Promise(resolve=>setTimeout(resolve,2500))
    ]);
   }catch{}
   const next=new URL(location.href);
   // A query token only identifies a public release. Preserve any existing
   // invite hash separately; never put secrets into an HTTP query string.
   next.searchParams.set("app-update",version);
   next.searchParams.set("fresh",Date.now().toString(36));
   location.replace(next.href);
  });
  panel.append(copy,button);
  document.body.append(panel);
 }
 async function checkNow(force=false){
  const now=Date.now();
  if(!force&&now-lastChecked<MIN_CHECK_GAP)return;
  lastChecked=now;
  if(navigator.onLine===false)return;
  // The rendered Pages-stamped HTML is the actual running shell. A newer
  // app-release.js can be served into an old WebKit document; in that case
  // the release object's version would hide a necessary update prompt.
  const badge=document.querySelector?.("[data-app-version]");
  const pageVersion=badge?.getAttribute?.("data-release-build")
   ?releaseNumber(badge.textContent?.trim()):null;
  const running=pageVersion??releaseNumber(window.SchmetterlingeRelease?.version);
  if(!running)return;
  try{
   const url=new URL("./app-release.js",location.href);
   url.searchParams.set("pwa-check",Date.now().toString(36));
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),7000);
   let body;
   try{
    const response=await fetch(url.href,{
     cache:"no-store",credentials:"same-origin",signal:controller.signal
    });
    if(!response.ok)return;
    body=await response.text();
   }finally{clearTimeout(timeout)}
   const latest=body.match(/\{version:"(v[1-9][0-9]*)",\s*build:/)?.[1];
   const latestNumber=releaseNumber(latest);
   if(latestNumber!==null&&latestNumber>running)offerUpdate(latest);
  }catch{/* Stay on the current verified shell when the network is unavailable. */}
 }
 function initialize(){
  if(initialized)return;
  initialized=true;
  if(!("serviceWorker" in navigator)||!(/^https:$/.test(location.protocol)||
    ["localhost","127.0.0.1"].includes(location.hostname)))return;
  navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"})
   .then(value=>{registration=value;}).catch(()=>{});
  // Registering updates does not replace the current iOS document. Read a
  // tiny public release marker and let the user choose when to reload.
  void checkNow(true);
  document.addEventListener("visibilitychange",()=>{
   if(document.visibilityState==="visible")void checkNow();
  });
  window.addEventListener("pageshow",()=>{void checkNow();});
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
   // No loops: this is throttled with the same bounded check as app resume.
   void checkNow();
  });
 }
 window.SchmetterlingePwaUpdate=Object.freeze({initialize,checkNow});
})();
