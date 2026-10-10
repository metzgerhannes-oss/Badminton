/* Invitation link is a public onboarding URL, not a token or account invitation. */
(() => {
 "use strict";
 const setupUrl=()=>new URL("./welcome.html",location.href).href;
 function status(message){
  const node=document.getElementById("invite-status");
  if(node)node.textContent=message;
 }
 async function copyLink(){
  const link=setupUrl();
  try{
   if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(link);
    status("Einladungslink kopiert.");
   }else{
    window.prompt("Diesen Link kopieren und versenden:",link);
    status("Einladungslink bereit.");
   }
  }catch{
   window.prompt("Diesen Link kopieren und versenden:",link);
   status("Einladungslink bereit.");
  }
 }
 async function shareLink(){
  const link=setupUrl();
  if(navigator.share){
   try{
    await navigator.share({title:"Schmetterlinge – Badminton Jugend",text:"Richte dein Badminton-Profil ein und füge die App zum Startbildschirm hinzu.",url:link});
    status("Einladungslink zum Teilen geöffnet.");
    return;
   }catch(error){
    if(error?.name==="AbortError")return;
   }
  }
  await copyLink();
 }
 document.addEventListener("DOMContentLoaded",()=>{
  const link=document.getElementById("invite-link-preview");
  if(link){link.href=setupUrl();link.textContent=setupUrl();}
  document.getElementById("invite-share")?.addEventListener("click",shareLink);
  document.getElementById("invite-copy")?.addEventListener("click",copyLink);
 });
})();
