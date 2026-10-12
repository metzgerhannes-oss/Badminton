import {STORE,parseDbvReference,normalizeProfile,addProfileToStore} from "./scripts/invitation.mjs";
import {normalizeFriendSearch} from "./scripts/friend-search.mjs";
import {searchInvitationPlayers} from "./scripts/invitation-search.mjs";
const $=id=>document.getElementById(id);
const t=key=>window.SchmetterlingeI18n?.t(key)||key;
const format=(key,params={})=>t(key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name]??""));

let mode="manual",searchTimer=null,searchController=null,searchTicket=0,selectedCandidate=null;
let lastSearchStatus=null,lastSearchPlayers=null,lastSearchSource=null,lastSavedProfile=null;

function showError(message){
 const error=$("welcome-error");
 error.textContent=t(message);
 error.hidden=false;
}
function clearError(){
 $("welcome-error").hidden=true;
}
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
 clearError();
}
function preferredPlatform(){
 return /Android/i.test(navigator.userAgent||"")?"android":"ios";
}
function showPlatform(value){
 for(const name of ["ios","android"]){
  $("install-"+name).setAttribute("aria-pressed",String(value===name));
  $("install-"+name+"-steps").hidden=value!==name;
 }
}
function readSaved(){
 try{const value=localStorage.getItem(STORE);return value?JSON.parse(value):null}catch{return null}
}
function persistAndContinue(profile,{confirmed=false}={}){
 if(confirmed&&!/^\d{2}-\d{6}$/.test(profile?.id))throw Error("Der ausgewählte Spieler hat keine gültige DBV-ID. Bitte erneut suchen.");
 const result=addProfileToStore(readSaved(),profile,{confirmed});
 localStorage.setItem(STORE,JSON.stringify(result));
 const stored=readSaved();
 if(confirmed&&(!stored?.players?.some(p=>p.id===profile.id)||stored.activeProfileId!==profile.id))
  throw Error("Die DBV-ID konnte nicht als aktives Profil gespeichert werden. Bitte erneut versuchen.");
 const savedStatus=$("welcome-success");
 lastSavedProfile={confirmed,id:profile.id};
 if(savedStatus)savedStatus.textContent=confirmed?format("✓ DBV-Profil {id} übernommen",{id:profile.id}):t("✓ Profil auf diesem Gerät gespeichert");
 // Profile creation and invitation remain entirely local. Public directory lookup is read-only.
 $("onboard-profile").hidden=true;
 $("onboard-install").hidden=false;
 $("progress-profile").classList.remove("current");
 $("progress-profile").classList.add("done");
 $("progress-install").classList.add("current");
 showPlatform(preferredPlatform());
 document.title=t("App zum Home-Bildschirm hinzufügen · Schmetterlinge");
 window.scrollTo?.(0,0);
}
function saveProfile(e){
 e.preventDefault();
 clearError();
 try{
  const data=new FormData($("welcome-form"));
  const reference=String($("welcome-reference").value||"").trim();
  if(mode==="dbv"&&!parseDbvReference(reference).valid)throw Error("Bitte eine gültige DBV-Spieler-ID oder einen offiziellen DBV-Spielerprofil-Link angeben.");
  persistAndContinue(normalizeProfile({
   mode,reference,name:data.get("name"),birthYear:data.get("birthYear"),club:data.get("club")
  }));
 }catch(error){
  showError(error?.message||"Das Profil konnte nicht gespeichert werden. Bitte erneut versuchen.");
 }
}
function saveSelected(){
 if(!selectedCandidate)return;
 clearError();
 try{
  if(!/^\d{2}-\d{6}$/.test(selectedCandidate.id))throw Error("Der Suchtreffer hat keine bestätigte DBV-ID. Bitte einen anderen Treffer auswählen.");
  persistAndContinue(normalizeProfile({
   mode:"dbv",reference:selectedCandidate.id,name:selectedCandidate.name,
   birthYear:selectedCandidate.birthYear||"",club:selectedCandidate.club||""
  }),{confirmed:true});
 }catch(error){
  showError(error?.message||"Der ausgewählte Spieler konnte nicht gespeichert werden.");
 }
}
function clearSelection(){
 selectedCandidate=null;
 $("welcome-selection").hidden=true;
}
function setSearchStatus(message){
 lastSearchStatus={kind:"message",message};
 $("welcome-search-status").textContent=t(message);
}
function setResultsStatus(count,source){
 lastSearchStatus={kind:"results",count,source};
 $("welcome-search-status").textContent=format("{count} passende Spieler",{count})+
  (count===30?t(" (maximal 30; Suche eingrenzen)"):"")+
  (source==="backup"?t(" · GitHub-Ausfallsicherung"):"")+t(". Wähle den richtigen Spieler aus.");
}
function showSearchResults(players,source){
 lastSearchPlayers=players;
 lastSearchSource=source;
 const root=$("welcome-search-results");
 root.replaceChildren();
 const existing=new Set((readSaved()?.players||[]).map(p=>p.id));
 for(const player of players){
  const button=document.createElement("button");
  button.type="button";
  button.className="welcome-search-hit";
  const name=document.createElement("strong");
  name.textContent=player.name;
  const detail=document.createElement("span");
  detail.textContent=[player.club||t("Verein unbekannt"),player.birthYear?format("Jg. {year}",{year:player.birthYear}):player.ageClass,player.id?"DBV "+player.id:""].filter(Boolean).join(" · ");
  button.append(name,detail);
  if(existing.has(player.id)){
   const note=document.createElement("small");
   note.textContent=t("Bereits angelegt · als Startprofil auswählen");
   button.append(note);
  }
  button.addEventListener("click",()=>{
   ++searchTicket;
   searchController?.abort();
   selectedCandidate=player;
   $("welcome-selection-name").textContent=player.name;
   $("welcome-selection-detail").textContent=detail.textContent;
   $("welcome-selection").hidden=false;
   root.replaceChildren();
   clearError();
   setSearchStatus("DBV-Spieler ausgewählt. Identität prüfen und als aktives Profil übernehmen.");
   $("welcome-selection-save").focus();
  });
  root.append(button);
 }
 if(!players.length)setSearchStatus("Kein passender DBV-Spieler gefunden. Versuche einen anderen Namen oder richte das Profil manuell ein.");
 else setResultsStatus(players.length,source);
}
async function searchPlayers(value){
 const current=++searchTicket;
 searchController?.abort();
 searchController=new AbortController();
 clearSelection();
 $("welcome-search-results").replaceChildren();
 lastSearchPlayers=null;
 const term=normalizeFriendSearch(value);
 if(term.length<2){
  setSearchStatus("Mindestens zwei Zeichen eingeben, um Spieler zu finden.");
  return;
 }
 clearError();
 setSearchStatus("Spieler werden im öffentlichen DBV-Verzeichnis gesucht …");
 try{
  const {players,source}=await searchInvitationPlayers(term,{signal:searchController.signal});
  if(current!==searchTicket)return;
  showSearchResults(players,source);
 }catch(error){
  if(current!==searchTicket||searchController?.signal.aborted)return;
  setSearchStatus("Suche derzeit nicht erreichbar. Bitte Internetverbindung prüfen oder das Profil manuell einrichten.");
 }
}
function onSearchInput(){
 clearTimeout(searchTimer);
 ++searchTicket;
 searchController?.abort();
 clearSelection();
 $("welcome-search-results").replaceChildren();
 lastSearchPlayers=null;
 const value=$("welcome-player-search").value;
 if(normalizeFriendSearch(value).length<2){
  setSearchStatus("Mindestens zwei Zeichen eingeben, um Spieler zu finden.");
  return;
 }
 setSearchStatus("Suche wird vorbereitet …");
 searchTimer=setTimeout(()=>searchPlayers(value),280);
}
function showProfileForm(){
 $("onboard-install").hidden=true;
 $("onboard-profile").hidden=false;
 $("progress-install").classList.remove("current");
 $("progress-profile").classList.remove("done");
 $("progress-profile").classList.add("current");
 $("welcome-form").reset();
 $("welcome-player-search").value="";
 onSearchInput();
 updateMode("manual");
 $("welcome-existing").hidden=false;
 window.scrollTo?.(0,0);
}
window.addEventListener("schmetterlinge:language-change", event => {
 // Re-render texts already generated by asynchronous search or a prior locale.
 if(lastSearchPlayers&&!selectedCandidate)showSearchResults(lastSearchPlayers,lastSearchSource);
 else if(lastSearchStatus?.kind==="results")setResultsStatus(lastSearchStatus.count,lastSearchStatus.source);
 else if(lastSearchStatus?.kind==="message")setSearchStatus(lastSearchStatus.message);
 if(selectedCandidate){
  const detail=[selectedCandidate.club||t("Verein unbekannt"),
   selectedCandidate.birthYear?format("Jg. {year}",{year:selectedCandidate.birthYear}):selectedCandidate.ageClass,
   selectedCandidate.id?"DBV "+selectedCandidate.id:""].filter(Boolean).join(" · ");
  $("welcome-selection-detail").textContent=detail;
 }
 if(lastSavedProfile){
  $("welcome-success").textContent=lastSavedProfile.confirmed
   ?format("✓ DBV-Profil {id} übernommen",{id:lastSavedProfile.id})
   :t("✓ Profil auf diesem Gerät gespeichert");
  document.title=t("App zum Home-Bildschirm hinzufügen · Schmetterlinge");
 }
 const notice=$("welcome-language-status");
 if(notice)notice.textContent=event.detail?.fallback
  ?"Dieses Sprachpaket ist derzeit nicht verfügbar. Die deutschen Texte bleiben lesbar.":"";
});
document.addEventListener("DOMContentLoaded",()=>{
 $("mode-own").addEventListener("click",()=>updateMode("manual"));
 $("mode-dbv").addEventListener("click",()=>updateMode("dbv"));
 $("welcome-form").addEventListener("submit",saveProfile);
 $("welcome-selection-save").addEventListener("click",saveSelected);
 $("welcome-player-search").addEventListener("input",onSearchInput);
 $("welcome-player-search").addEventListener("search",onSearchInput);
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
