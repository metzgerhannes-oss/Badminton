/** User-initiated DBV identity lookup when adding an additional own profile.
 * Search is read-only; choosing a DBV identity never grants account access.
 * No lookup is made when the dialog is closed or a profile is merely edited.
 */
import {searchInvitationPlayers} from "./scripts/invitation-search.mjs";
import {normalizeFriendSearch} from "./scripts/friend-search.mjs";

document.addEventListener("DOMContentLoaded",()=>{
 const dialog=document.getElementById("player-dialog");
 const form=document.getElementById("player-form");
 const section=document.getElementById("own-player-search");
 const search=document.getElementById("own-player-search-input");
 const status=document.getElementById("own-player-search-status");
 const results=document.getElementById("own-player-search-results");
 if(!dialog||!form||!section||!search||!status||!results)return;
 let timer=null,controller=null,ticket=0;
 const dbvId=/^\d{2}-\d{6}$/;
 function invalidate(){
  ++ticket;clearTimeout(timer);timer=null;
  controller?.abort();controller=null;
  results.replaceChildren();
 }
 function currentIds(){
  try{
   const saved=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
   return {
    own:new Set((Array.isArray(saved.players)?saved.players:[]).map(p=>p.id)),
    friends:new Set((Array.isArray(saved.friends)?saved.friends:[]).map(p=>p.id))
   };
  }catch{return {own:new Set(),friends:new Set()};}
 }
 function showHits(players,source){
  results.replaceChildren();
  if(!players.length){
   status.textContent=source==="restricted"||source==="unavailable"
    ?"Spielersuche derzeit nicht erreichbar. Du kannst die DBV-ID unten selbst eingeben."
    :"Keine passenden Spieler gefunden. Suche genauer oder trage die Daten selbst ein.";
   return;
  }
  const existing=currentIds();
  status.textContent=players.length+" passende DBV-Spieler gefunden. Wähle den richtigen Eintrag.";
  for(const player of players){
   if(!dbvId.test(player.id))continue;
   const hit=document.createElement("button");hit.type="button";hit.className="own-player-search-hit";
   const name=document.createElement("strong");name.textContent=player.name;
   const detail=document.createElement("span");
   detail.textContent=[player.club||"Verein nicht angegeben",player.ageClass||"", "DBV "+player.id].filter(Boolean).join(" · ");
   hit.append(name,detail);
   const duplicate=existing.own.has(player.id)?"Dieses Profil ist bereits angelegt":
    existing.friends.has(player.id)?"Dieser Spieler wird bereits gefolgt – zuerst dort entfernen":"";
   if(duplicate){
    const note=document.createElement("small");note.textContent=duplicate;hit.append(note);
    hit.disabled=true;
   }else{
    hit.addEventListener("click",()=>{
     invalidate();
     form.elements.namedItem("name").value=player.name;
     form.elements.namedItem("id").value=player.id;
     form.elements.namedItem("club").value=player.club||"";
     if(player.birthYear)form.elements.namedItem("birthYear").value=String(player.birthYear);
     status.textContent="Spieler ausgewählt. Angaben prüfen und unten speichern.";
     form.elements.namedItem("name").focus();
    });
   }
   results.append(hit);
  }
 }
 async function run(term){
  const id=++ticket;
  controller=new AbortController();
  status.textContent="DBV-Spieler werden gesucht …";
  try{
   // Do not pass already saved profiles as shortcut: additional matches must
   // still appear when another family member has the same surname.
   const found=await searchInvitationPlayers(term,{signal:controller.signal,savedCandidates:[]});
   if(id!==ticket||!dialog.open||section.hidden)return;
   showHits(found.players,found.source);
  }catch{
   if(id!==ticket||!dialog.open)return;
   results.replaceChildren();
   status.textContent="Suche nicht erreichbar. Daten können unten manuell eingetragen werden.";
  }
 }
 search.addEventListener("input",()=>{
  invalidate();
  const term=normalizeFriendSearch(search.value);
  if(term.length<3){
   status.textContent="Mindestens drei Zeichen für die DBV-Spielersuche eingeben.";
   return;
  }
  status.textContent="Suche wird vorbereitet …";
  timer=setTimeout(()=>run(term),280);
 });
 search.addEventListener("search",()=>search.dispatchEvent(new Event("input")));
 window.addEventListener("badminton:own-profile-form-open",event=>{
  invalidate();
  search.value="";
  section.hidden=Boolean(event.detail?.editing);
  status.textContent="Mindestens drei Zeichen für die DBV-Spielersuche eingeben.";
 });
 dialog.addEventListener("close",invalidate);
});
