/** Explicit, optional player-management request. No signup on page load or search. */
import {searchInvitationPlayers} from "./scripts/invitation-search.mjs";
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
const DBV=/^[0-9]{2}-[0-9]{6}$/;
const escapeText=(node,value)=>{node.textContent=String(value||"")};
function localCandidates(){
 try{
  const data=JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}");
  return [...(Array.isArray(data.players)?data.players:[]),...(Array.isArray(data.friends)?data.friends:[])]
   .filter(p=>DBV.test(p?.id||"")).map(p=>({id:p.id,name:p.name,club:p.club}));
 }catch{return []}
}
async function rpc(name,args,session){
 const response=await fetch(SUPABASE_ROOT+"rpc/"+name,{
  method:"POST",cache:"no-store",
  headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
  body:JSON.stringify(args)
 });
 if(!response.ok)throw Error("RPC "+response.status);
 return response.json();
}
document.addEventListener("DOMContentLoaded",()=>{
 const room=document.getElementById("settings-room-profile")||document.querySelector("#view-einstellungen");
 if(!room)return;
 const section=document.createElement("section");section.className="settings-card player-verify-card";
 const heading=document.createElement("h3");heading.textContent="Spielerberechtigung unabhängig prüfen lassen";
 const help=document.createElement("p");help.className="settings-hint";
 help.textContent="Zum privaten Teilen ist eine einmalige externe Bestätigung durch eine berechtigte Vereins-, Verbands- oder Elternstelle erforderlich. Ein Name, eine DBV-ID oder die Eigentümer-Checkbox reichen nicht. Öffentliche Funktionen und Folgen benötigen keinen Zugang.";
 const form=document.createElement("form");form.className="player-verify-form";
 const searchLabel=document.createElement("label");searchLabel.textContent="Spieler suchen";
 const search=document.createElement("input");search.type="search";search.placeholder="Name oder DBV-ID";
 search.autocomplete="off";searchLabel.append(search);
 const find=document.createElement("button");find.type="button";find.className="outline-button";
 find.textContent="In DBV-Verzeichnis suchen";
 const results=document.createElement("div");results.className="player-verify-results";
 const idLabel=document.createElement("label");idLabel.textContent="Ausgewählte DBV-Spieler-ID";
 const id=document.createElement("input");id.type="text";id.inputMode="text";id.required=true;
 id.placeholder="00-000000";id.maxLength=9;idLabel.append(id);
 const channelLabel=document.createElement("label");channelLabel.textContent="Nachweisweg";
 const channel=document.createElement("select");
 for(const [key,label] of [["club_official","Bestätigung durch Verein"],["association_official","Bestätigung durch Verband"],["parent_confirmed","Unabhängige Elternbestätigung"]]){
  const option=document.createElement("option");option.value=key;option.textContent=label;channel.append(option);
 }channelLabel.append(channel);
 const submit=document.createElement("button");submit.className="primary-button";submit.type="submit";
 submit.textContent="Prüfung beantragen";
 const check=document.createElement("button");check.className="outline-button";check.type="button";
 check.textContent="Meine Anträge prüfen";
 const status=document.createElement("p");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 status.className="settings-hint";
 form.append(searchLabel,find,results,idLabel,channelLabel,submit,check,status);
 section.append(heading,help,form);room.append(section);
 let busy=false,searchController=null;
 find.addEventListener("click",async()=>{
  if(busy)return;busy=true;find.disabled=true;results.replaceChildren();
  searchController?.abort();searchController=new AbortController();
  escapeText(status,"Öffentliches DBV-Verzeichnis wird durchsucht …");
  try{
   const found=await searchInvitationPlayers(search.value,{
    signal:searchController.signal,savedCandidates:localCandidates()
   });
   if(found.source==="restricted"||found.source==="unavailable"){
    escapeText(status,"Suche aktuell eingeschränkt. Du kannst die bestätigte DBV-ID direkt eintragen.");
   }else if(!found.players.length){
    escapeText(status,"Kein passender Spieler gefunden. Suchbegriff prüfen.");
   }else{
    escapeText(status,"Spieler auswählen. Die Auswahl allein gibt noch keine Rechte.");
    found.players.slice(0,15).forEach(p=>{
     const button=document.createElement("button");button.type="button";button.className="outline-button";
     button.textContent=p.name+" · "+p.id;
     button.addEventListener("click",()=>{id.value=p.id;results.replaceChildren();escapeText(status,"Spieler ausgewählt. Eine externe Bestätigung ist weiterhin erforderlich.")});
     results.append(button);
    });
   }
  }catch{escapeText(status,"Suche nicht verfügbar. Bitte DBV-ID manuell eingeben.")}
  finally{busy=false;find.disabled=false}
 });
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(busy)return;
  const target=id.value.trim();
  if(!DBV.test(target)){escapeText(status,"Bitte eine gültige DBV-ID auswählen.");return;}
  busy=true;submit.disabled=true;
  try{
   // Technical anonymous Auth is created only after the explicit request.
   const session=await getPrivateSession(true);
   const result=await rpc("private_player_manage_request",{p_player_dbv_id:target,p_channel:channel.value},session);
   if(!result)throw Error("not found");
   escapeText(status,"Antrag hinterlegt. Eine externe Prüfstelle muss die Berechtigung unabhängig bestätigen. Bis dahin werden keine neuen Archivfreigaben erteilt.");
  }catch{escapeText(status,"Antrag konnte nicht gespeichert werden. Die bestehenden lokalen Profile bleiben unverändert.");}
  finally{busy=false;submit.disabled=false}
 });
 check.addEventListener("click",async()=>{
  if(busy)return;busy=true;check.disabled=true;
  try{
   const session=await getPrivateSession(false);
   if(!session){escapeText(status,"Auf diesem Gerät gibt es noch keine Berechtigungssitzung.");return;}
   const rows=await rpc("private_player_manage_status",{},session);
   const pending=Array.isArray(rows)?rows:[];
   if(!pending.length)escapeText(status,"Noch keine Anträge auf dieser Gerätesitzung.");
   else escapeText(status,pending.slice(0,10).map(r=>String(r.player_dbv_id||"")+" · "+
     ({pending:"Prüfung offen",approved:"Unabhängig bestätigt",rejected:"Abgelehnt",not_verified:"Bestätigung nicht mehr gültig"}[r.status]||"Status unbekannt")).join(" | "));
  }catch{escapeText(status,"Antragsstatus derzeit nicht abrufbar; daraus folgt keine Ablehnung.")}
  finally{busy=false;check.disabled=false}
 });
});
