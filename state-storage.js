"use strict";
/**
 * Schmetterlinge local device storage contract (v1).
 * No remote writes; do not change the existing shuttleboard-v1 key.
 * Loaded before app.js as a classic script so offline PWA and older browsers work.
 */
var SchmetterlingeStorage=(function(){
 const STORE="shuttleboard-v1";
 const SCHEMA_VERSION=1;
function restore(state,normalizeBookmark){
 try{
  const saved=JSON.parse(localStorage.getItem(STORE)||"null");
  if(saved&&typeof saved==="object"){
   if(Array.isArray(saved.players))state.players=saved.players.filter(p=>p&&typeof p.name==="string"&&typeof p.id==="string").slice(0,12);
   const philipp=state.players.find(p=>p.id==="05-070879"); if(philipp&&!philipp.birthYear)philipp.birthYear=2016;
   // Migrate the original local-only Charlotte profile to her confirmed DBV-ID.
   // Keep any existing user favourites and active profile selection intact.
   const legacyCharlotte=state.players.find(p=>p.id==="local-charlotte"&&p.name==="Charlotte Metzger");
   const officialCharlotte=state.players.find(p=>p.id==="05-071969");
   if(legacyCharlotte){
     if(officialCharlotte){
       state.players=state.players.filter(p=>p!==legacyCharlotte);
     }else{
       legacyCharlotte.id="05-071969";
       legacyCharlotte.birthYear=2014;
       legacyCharlotte.url=legacyCharlotte.url||"https://turniere.badminton.de/ranking";
     }
   }
   const charlotte=state.players.find(p=>p.id==="05-071969");
   if(charlotte){
     charlotte.birthYear=2014;
     if(!charlotte.url)charlotte.url="https://turniere.badminton.de/ranking";
   }
   if(Array.isArray(saved.officialLinks))state.officialLinks=saved.officialLinks.map(normalizeBookmark).filter(Boolean).map(t=>t.playerId==="local-charlotte"?{...t,playerId:"05-071969"}:t).slice(0,40);
   if(Array.isArray(saved.friends))state.friends=saved.friends.filter(p=>p&&/^\d{2}-\d{6}$/.test(p.id)&&typeof p.name==="string"&&p.name.trim()).slice(0,30);
   const preferred=typeof saved.activeProfileId==="string"?saved.activeProfileId:(typeof saved.chosen==="string"?saved.chosen:"");
   const canonicalPreferred=preferred==="local-charlotte"&&state.players.some(p=>p.id==="05-071969")?"05-071969":preferred;
   if(canonicalPreferred!=="all"&&state.players.some(p=>p.id===canonicalPreferred))state.activeProfileId=canonicalPreferred;
   if(!saved.historyProfilesInitialized&&!state.players.some(p=>p.name==="Charlotte Metzger"))
    state.players.push({id:"05-071969",name:"Charlotte Metzger",birthYear:2014,url:"https://turniere.badminton.de/ranking"});
  }
 }catch{}
 // Legacy device profiles retain all favourites; fill only missing known club fields.
 for(const p of state.players){
  if(["05-070879","05-071969"].includes(p.id)&&!p.club)p.club="SpVgg Mössingen";
 }
 if(!state.players.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.players[0]?.id||"";
 state.friends=state.friends.filter(p=>!state.players.some(own=>own.id===p.id));
 state.chosen=state.activeProfileId;
}
function save(state){
 try{localStorage.setItem(STORE,JSON.stringify({players:state.players,friends:state.friends,officialLinks:state.officialLinks,activeProfileId:state.activeProfileId,chosen:state.activeProfileId,historyProfilesInitialized:true}))}catch{}
}

 return Object.freeze({STORE,SCHEMA_VERSION,restore,save});
})();
