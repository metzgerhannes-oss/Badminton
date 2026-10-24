import {WIZARD_KEY,parseStep,nextStep} from "./scripts/onboarding-wizard-state.mjs";
/* Guided, resumable first-run help. Reuses existing profile, team and tournament
   controls; it never creates a second copy of personal data or grants access. */
const $=id=>document.getElementById(id);
let dialog,resume,step=0,actionVisited=false,retries=0;
const screens=[
 {title:"Dein Profil",description:"Dein erstes Spielerprofil ist bereit.",action:"Weiter"},
 {title:"Weitere Spieler",description:"Füge bei Bedarf weitere eigene Spielerprofile hinzu.",action:"Spielerprofil hinzufügen"},
 {title:"Mannschaft",description:"Suche eine Mannschaft, der du folgen möchtest.",action:"Mannschaft suchen"},
 {title:"Turniere",description:"Merke interessante Turniere mit + für dein Profil vor.",action:"Turniere auswählen"}
];
function readStep(){try{return parseStep(localStorage.getItem(WIZARD_KEY))}catch{return null}}
function saveStep(value){try{localStorage.setItem(WIZARD_KEY,String(value));return true}catch{return false}}
function ownProfileExists(){
 try{
  const data=JSON.parse(localStorage.getItem("shuttleboard-v1")||"null");
  return Array.isArray(data?.players)&&data.players.some(p=>p&&typeof p.id==="string");
 }catch{return false}
}
function updateResume(){if(resume)resume.hidden=readStep()===null||dialog?.open===true}
function render(){
 const screen=screens[step];
 $("onboarding-progress").textContent=(step+1)+" von 4";
 $("onboarding-title").textContent=screen.title;
 $("onboarding-description").textContent=screen.description;
 $("onboarding-back").hidden=step===0;
 $("onboarding-skip").hidden=step===0;
 $("onboarding-action").textContent=step===0?"Weiter":actionVisited?(step===3?"Fertig":"Weiter"):screen.action;
}
function close(){if(dialog.open)dialog.close();updateResume()}
function finish(){
 try{localStorage.removeItem(WIZARD_KEY)}catch{}
 close();resume.hidden=true;
 location.hash="#start";
}
function advance(){
 const next=nextStep(step);
 if(next===null){finish();return}
 if(!saveStep(next))return;
 step=next;actionVisited=false;render();
}
function open(){
 const current=readStep();
 if(current===null){updateResume();return}
 if(!ownProfileExists())return;
 if(!window.badmintonAppAccess?.allowed)return;
 if(dialog.open)return;
 if(Array.from(document.querySelectorAll("dialog[open]")).some(d=>d!==dialog)){
  if(retries++<25)setTimeout(open,800);
  return;
 }
 retries=0;step=current;render();resume.hidden=true;dialog.showModal();
}
function performAction(){
 if(step===0||actionVisited){advance();return}
 actionVisited=true;
 close();
 if(step===1){
  location.hash="#einstellungen/profile";
  requestAnimationFrame(()=>window.openPlayerForm?.());
 }else if(step===2){
  location.hash="#mannschaft";
  requestAnimationFrame(()=>{
   const trigger=$("team-add-open");
   if(trigger?.getAttribute("aria-expanded")!=="true")trigger?.click();
   $("team-search")?.focus({preventScroll:true});
  });
 }else if(step===3){
  location.hash="#turniere";
  requestAnimationFrame(()=>{
   $("dbv-calendar-q")?.scrollIntoView({block:"center"});
   $("dbv-calendar-q")?.focus({preventScroll:true});
  });
 }
 updateResume();
}
function init(){
 dialog=document.createElement("dialog");
 dialog.id="onboarding-wizard";
 dialog.setAttribute("aria-labelledby","onboarding-title");
 dialog.innerHTML='<div class="onboarding-head"><span>Einrichtung</span><strong id="onboarding-progress" aria-live="polite">1 von 4</strong></div>'+
  '<h2 id="onboarding-title"></h2><p id="onboarding-description"></p>'+
  '<div class="onboarding-actions"><button type="button" id="onboarding-back">Zurück</button>'+
  '<button type="button" id="onboarding-skip">Überspringen</button>'+
  '<button type="button" id="onboarding-action" class="onboarding-primary">Weiter</button></div>'+
  '<button type="button" id="onboarding-later" class="onboarding-later">Später fortfahren</button>';
 document.body.append(dialog);
 resume=document.createElement("button");
 resume.id="onboarding-resume";resume.type="button";
 resume.textContent="Einrichtung fortsetzen";resume.hidden=true;document.body.append(resume);
 $("onboarding-back").addEventListener("click",()=>{
  if(step===0)return;
  step-=1;actionVisited=false;saveStep(step);render();
 });
 $("onboarding-skip").addEventListener("click",advance);
 $("onboarding-action").addEventListener("click",performAction);
 $("onboarding-later").addEventListener("click",close);
 resume.addEventListener("click",open);
 dialog.addEventListener("close",updateResume);
 const help=$("settings-room-hilfe");
 if(help){
  const button=document.createElement("button");
  button.id="onboarding-restart";button.type="button";
  button.className="settings-grant-action";
  button.textContent="Einrichtung erneut ansehen";
  button.addEventListener("click",()=>{
   if(!saveStep(0))return;
   actionVisited=false;
   if(!ownProfileExists()){location.assign("./welcome.html?from=app");return}
   open();
  });
  (help.querySelector(".settings-grant-card")||help).append(button);
 }
 updateResume();
 window.addEventListener("badminton:app-access-granted",()=>setTimeout(open,300));
 setTimeout(open,700);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
