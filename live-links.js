import {badhubLiveUrl,badhubCareerUrl} from "./scripts/live-links.mjs";
const $=id=>document.getElementById(id);
function updateLinks(id){
 const area=$("external-live-player");
 const direct=$("external-live-open"),career=$("external-live-career");
 if(!area||!direct||!career)return;
 const live=badhubLiveUrl(id),results=badhubCareerUrl(id);
 area.hidden=!live;
 if(!live){direct.removeAttribute("href");career.removeAttribute("href");return;}
 direct.href=live;
 career.href=results;
}
document.addEventListener("DOMContentLoaded",()=>{
 updateLinks(window.badmintonActivePlayerId||"");
 window.addEventListener("badminton:profile-change",event=>{
  updateLinks(String(event.detail?.playerId||""));
 });
});
