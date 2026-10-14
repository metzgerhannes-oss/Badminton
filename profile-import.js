/** Consent-only bridge from a selected device profile to existing private RPCs.
 * Selection does not authenticate, grant permission or download personal records.
 * No private response is persisted in localStorage, service worker or public files. */
import {SUPABASE_ROOT,PUBLIC_KEY} from "./scripts/supabase-read.mjs";
import {getPrivateSession} from "./private-invites.js";
import {requestPrivateTrophies,trophySnapshot} from "./scripts/private-trophy-source.mjs";
import {acceptedInviteIds,consumeImportPending,markImportIntroSeen,
 shouldShowImportIntro} from "./scripts/profile-import-prompt.mjs";
const $=id=>document.getElementById(id);
const DBV=/^\d{2}-\d{6}$/;
let active=null,busy=false;
const state=()=>{try{return JSON.parse(localStorage.getItem("shuttleboard-v1")||"{}")}catch{return {}}};
const playerFor=id=>{
 const stored=state(),list=[...(Array.isArray(stored.players)?stored.players:[]),
  ...(Array.isArray(stored.friends)?stored.friends:[])];
 return list.find(p=>p?.id===id)||null;
};
function dialog(){return $("profile-import-dialog")}
function message(value){$("profile-import-message").textContent=value}
function show(id,{force=false}={}){
 const player=playerFor(id),dlg=dialog();
 if(!player||!dlg||busy||(!force&&!shouldShowImportIntro(localStorage,id)))return false;
 active={id,name:player.name||"Spieler"};
 $("profile-import-name").textContent=active.name;
 const isDbv=DBV.test(id),ids=acceptedInviteIds(localStorage,id);
 $("profile-import-detail").textContent=!isDbv
  ?"Für den Abruf benötigst du zunächst die offizielle DBV-Spieler-ID. Dein lokales Profil bleibt unverändert."
  :ids.length
   ?"Für dieses Profil liegt eine angenommene Einladung auf diesem Gerät vor. Welche Bereiche verfügbar sind, prüft der Server beim Abruf."
   :"Für dieses Profil liegt hier noch keine angenommene Einladung vor. Du kannst einen erlaubten eigenen Zugriff prüfen oder zuerst den persönlichen Einladungslink auf diesem Gerät öffnen.";
 $("profile-import-run").disabled=!isDbv;
 $("profile-import-help").href=isDbv?"#einstellungen/einladungen":"#einstellungen/profile";
 $("profile-import-help").textContent=isDbv?"Freigaben verwalten ↗":"DBV-ID ergänzen ↗";
 message("Es wird noch nichts heruntergeladen. Der Abruf erfolgt ausschließlich auf deine Anforderung.");
 if(!dlg.open)dlg.showModal();
 markImportIntroSeen(localStorage,id);
 return true;
}
async function rpc(name,args,token){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),7000);
 try{
  const res=await fetch(SUPABASE_ROOT+"rpc/"+name,{
   method:"POST",cache:"no-store",signal:controller.signal,
   headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token,
    "Content-Type":"application/json",Accept:"application/json"},
   body:JSON.stringify(args)
  });
  if(!res.ok){if([400,401,403,404].includes(res.status))return null;
   throw Error("Service HTTP "+res.status)}
  return await res.json();
 }finally{clearTimeout(timer)}
}
async function importNow(){
 if(!active||busy||!DBV.test(active.id))return;
 const selected={...active};
 busy=true;$("profile-import-run").disabled=true;
 message("Berechtigung und verfügbare Daten werden geprüft …");
 try{
  // Do not create a technical Auth account on profile selection or reading.
  const session=await getPrivateSession(false);
  if(!session){message("Noch keine Berechtigungssitzung auf diesem Gerät. Bitte deinen persönlichen Einladungslink hier öffnen und annehmen.");return}
  let cards=null;
  for(const id of acceptedInviteIds(localStorage,selected.id)){
   const value=await rpc("private_player_access_read",{p_invitation_id:id},session.access_token);
   if(value?.player?.dbv_id===selected.id&&Array.isArray(value.matches)){
    cards=value.matches.slice(0,30);
    break;
   }
  }
  await requestPrivateTrophies(selected.id,{force:true});
  const trophies=trophySnapshot(selected.id);
  const hasTrophies=trophies.state==="ready";
  if(cards===null&&!hasTrophies){
   message("Für dieses Profil konnte kein gültiger Datenzugriff bestätigt werden. Der persönliche Einladungslink muss angenommen beziehungsweise die Verwalterberechtigung unabhängig geprüft sein.");
   return;
  }
  const found=[
   cards!==null?"Profil und "+cards.length+" vorhandene Matchkarten abgerufen (maximal 30)":"Profil und Matchkarten nicht freigegeben",
   hasTrophies?trophies.results.length+" belegte Trophäen abrufbar":"Trophäen nicht freigegeben oder derzeit nicht verfügbar"
  ];
  message(found.join(". ")+". Es wurden keine zusätzlichen privaten Daten dauerhaft auf diesem Gerät gespeichert. Der Trophäenschrank in der App wird aktualisiert.");
 }catch{
  message("Abruf derzeit nicht möglich. Deine lokale Profilwahl und bereits angenommene Einladung bleiben erhalten. Bitte später erneut versuchen.");
 }finally{
  busy=false;
  $("profile-import-run").disabled=!DBV.test(active?.id||"");
 }
}
document.addEventListener("DOMContentLoaded",()=>{
 const dlg=dialog();if(!dlg)return;
 $("profile-import-run").addEventListener("click",importNow);
 $("profile-import-later").addEventListener("click",()=>dlg.close());
 $("profile-import-help").addEventListener("click",()=>dlg.close());
 window.addEventListener("badminton:profile-selected",event=>{
  const id=String(event.detail?.playerId||"");
  // No prompt when a background refresh merely re-renders the same profile.
  if(id)show(id,{force:event.detail?.force===true});
 });
 window.addEventListener("badminton:profile-import-open",event=>{
  const id=String(event.detail?.playerId||state().chosen||state().activeProfileId||"");
  if(id)show(id,{force:true});
 });
 const room=$("settings-room-profile");
 if(room){
  const wrap=document.createElement("section");wrap.className="settings-card";
  const title=document.createElement("h3");title.textContent="Meine Daten";
  const explain=document.createElement("p");explain.className="settings-hint";
  explain.textContent="Daten für dein ausgewähltes Profil nur auf Wunsch und mit gültiger Berechtigung abrufen.";
  const open=document.createElement("button");open.type="button";open.className="outline-button";
  open.textContent="Datenabruf öffnen";
  open.addEventListener("click",()=>{
   const stored=state(),id=stored.viewingFriendId||stored.activeProfileId||stored.chosen;
   if(id)show(id,{force:true});else explain.textContent="Bitte zunächst ein Spielerprofil auswählen.";
  });
  wrap.append(title,explain,open);room.append(wrap);
 }
 const pending=consumeImportPending(localStorage);
 if(pending)show(pending,{force:true});
});
