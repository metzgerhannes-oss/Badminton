import {STORE,parseDbvReference,normalizeProfile,addProfileToStore} from "./scripts/invitation.mjs";
import {importPost} from "./scripts/history-demand.mjs";
const $=id=>document.getElementById(id);
let mode="manual";
function updateMode(next){
 mode=next;
 const dbv=mode==="dbv";
 $("mode-own").classList.toggle("active",!dbv);
 $("mode-dbv").classList.toggle("active",dbv);
 $("mode-own").setAttribute("aria-pressed",String(!dbv));
 $("mode-dbv").setAttribute("aria-pressed",String(dbv));
 $("welcome-ref-group").hidden=!dbv;
 $("welcome-reference").required=dbv;
 $("welcome-reference").value="";
 $("dbv-manual-note").hidden=!dbv;
 $("dbv-reference-note").hidden=dbv;
 $("welcome-error").hidden=true;
}
function preferredPlatform(){
 return /Android/i.test(navigator.userAgent||"")?"android":"ios";
}
function showPlatform(value){
 for(const name of ["ios","android"]){
  $(("install-"+name)).setAttribute("aria-pressed",String(value===name));
  $(("install-"+name+"-steps")).hidden=value!==name;
 }
}
function readSaved(){
 try{const value=localStorage.getItem(STORE);return value?JSON.parse(value):null}catch{return null}
}
function saveProfile(e){
 e.preventDefault();
 const error=$("welcome-error");
 error.hidden=true;
 try{
  const form=$("welcome-form");
  const data=new FormData(form);
  const reference=String($("welcome-reference").value||"").trim();
  if(mode==="dbv"&&!parseDbvReference(reference).valid)throw Error("Bitte eine gültige DBV-Spieler-ID oder einen offiziellen DBV-Spielerprofil-Link angeben.");
  const profile=normalizeProfile({
   mode,reference,name:data.get("name"),birthYear:data.get("birthYear"),club:data.get("club")
  });
  const result=addProfileToStore(readSaved(),profile);
  localStorage.setItem(STORE,JSON.stringify(result));
  // An own profile with a confirmed numeric DBV ID requests the same shared
  // queue used by followed players. Non-verifiable IDs are rejected server-side.
  const historyRequest=importPost(profile.id);
  if(historyRequest)fetch(historyRequest.url,{
   method:"POST",headers:historyRequest.headers,body:historyRequest.body
  }).catch(()=>{ /* App can request again after opening Home. */ });
  $("onboard-profile").hidden=true;
  $("onboard-install").hidden=false;
  $("progress-profile").classList.remove("current");
  $("progress-profile").classList.add("done");
  $("progress-install").classList.add("current");
  showPlatform(preferredPlatform());
  document.title="App zum Home-Bildschirm hinzufügen · Schmetterlinge";
  window.scrollTo?.(0,0);
 }catch(ex){
  error.textContent=ex?.message||"Das Profil konnte nicht gespeichert werden. Bitte erneut versuchen.";
  error.hidden=false;
 }
}
function showProfileForm(){
 $("onboard-install").hidden=true;
 $("onboard-profile").hidden=false;
 $("progress-install").classList.remove("current");
 $("progress-profile").classList.add("current");
 $("welcome-form").reset();
 updateMode("manual");
 $("welcome-existing").hidden=false;
 window.scrollTo?.(0,0);
}
document.addEventListener("DOMContentLoaded",()=>{
 $("mode-own").addEventListener("click",()=>updateMode("manual"));
 $("mode-dbv").addEventListener("click",()=>updateMode("dbv"));
 $("welcome-form").addEventListener("submit",saveProfile);
 $("install-ios").addEventListener("click",()=>showPlatform("ios"));
 $("install-android").addEventListener("click",()=>showPlatform("android"));
 $("install-back").addEventListener("click",showProfileForm);
 const known=readSaved()?.players;
 $("welcome-existing").hidden=!(Array.isArray(known)&&known.length);
 updateMode("manual");
 if(location.hash==="#installation"){
  $("onboard-profile").hidden=true;
  $("onboard-install").hidden=false;
  $("progress-profile").classList.remove("current");
  $("progress-install").classList.add("current");
  $("welcome-success").hidden=true;
  showPlatform(preferredPlatform());
 }
 if("serviceWorker" in navigator&&location.protocol==="https:"){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
 }
});
