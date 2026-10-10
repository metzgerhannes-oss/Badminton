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
   // Only migrate a legacy ID that ALREADY exists on this device.
   // Do not inject names, birth years, club memberships or any new family
   // profiles from publicly delivered JavaScript.
   const oldProfile=state.players.find(p=>p.id==="local-charlotte");
   const samePerson=state.players.find(p=>p.id==="05-071969");
   if(oldProfile){
     if(samePerson)state.players=state.players.filter(p=>p!==oldProfile);
     else oldProfile.id="05-071969";
   }
   if(Array.isArray(saved.officialLinks))state.officialLinks=saved.officialLinks.map(normalizeBookmark).filter(Boolean).map(t=>t.playerId==="local-charlotte"?{...t,playerId:"05-071969"}:t).slice(0,40);
   if(Array.isArray(saved.friends))state.friends=saved.friends.filter(p=>p&&/^\d{2}-\d{6}$/.test(p.id)&&typeof p.name==="string"&&p.name.trim()).slice(0,30);
   const preferred=typeof saved.activeProfileId==="string"?saved.activeProfileId:(typeof saved.chosen==="string"?saved.chosen:"");
   const canonicalPreferred=preferred==="local-charlotte"&&state.players.some(p=>p.id==="05-071969")?"05-071969":preferred;
   if(canonicalPreferred!=="all"&&state.players.some(p=>p.id===canonicalPreferred))state.activeProfileId=canonicalPreferred;

  }
 }catch{}
 // Preserve the user's own stored fields; do not infer a family club or birth year.
 if(!state.players.some(p=>p.id===state.activeProfileId))state.activeProfileId=state.players[0]?.id||"";
 state.friends=state.friends.filter(p=>!state.players.some(own=>own.id===p.id));
 state.chosen=state.activeProfileId;
}
function save(state){
 try{localStorage.setItem(STORE,JSON.stringify({players:state.players,friends:state.friends,officialLinks:state.officialLinks,activeProfileId:state.activeProfileId,chosen:state.activeProfileId,historyProfilesInitialized:true}))}catch{}
}

 return Object.freeze({STORE,SCHEMA_VERSION,restore,save});
})();
