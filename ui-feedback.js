/* Network state is guidance, not proof that an external provider works.
 * Never expose private user information or auto-refresh hidden screens. */
(() => {
 "use strict";
 function update(){
  const banner=document.getElementById("connection-status");
  if(!banner)return;
  banner.hidden=navigator.onLine!==false;
 }
 document.addEventListener("DOMContentLoaded",update);
 window.addEventListener("offline",update);
 window.addEventListener("online",()=>{
  update();
  window.dispatchEvent(new Event("badminton:network-restored"));
 });
})();
