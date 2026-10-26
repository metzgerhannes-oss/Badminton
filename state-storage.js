"use strict";
/**
 * Schmetterlinge local device storage contract (v1).
 * No remote writes; do not change the existing shuttleboard-v1 key.
 * Loaded before app.js as a classic script so offline PWA and older browsers work.
 */
var SchmetterlingeStorage=(function(){
 const STORE="shuttleboard-v1";
 const SCHEMA_VERSION=1;
// Device-owned profiles retain their identities. Never infer a DBV link from
// first names, stale labels or missing birth year/club information.
function restore(state,normalizeBookmark){
 try{
  const saved=JSON.parse(localStorage.getItem(STORE)||"null");
  if(saved&&typeof saved==="object"){
   if(Array.isArray(saved.players))state.players=saved.players.filter(p=>p&&typeof p.name==="string"&&typeof p.id==="string").slice(0,12);
   // Retain all existing local profile IDs and bookmark ownership unchanged.
   if(Array.isArray(saved.officialLinks))state.officialLinks=saved.officialLinks.map(normalizeBookmark).filter(Boolean).slice(0,40);
   if(Array.isArray(saved.friends))state.friends=saved.friends.filter(p=>p&&/^\d{2}-\d{6}$/.test(p.id)&&typeof p.name==="string"&&p.name.trim()).slice(0,30);
   const preferred=typeof saved.activeProfileId==="string"?saved.activeProfileId:(typeof saved.chosen==="string"?saved.chosen:"");
   if(preferred!=="all"&&state.players.some(p=>p.id===preferred))state.activeProfileId=preferred;

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
// Pure local profile-navigation transitions: no cloud writes, new storage
// schema or implicit changes to the user's chosen own starting profile.
function selectOwn(state,id){
 if(!state.players.some(p=>p.id===id))return false;
 state.activeProfileId=id;
 state.viewingFriendId=null;
 state.chosen=id;
 return true;
}
function selectFriend(state,id){
 if(!state.friends.some(p=>p.id===id))return false;
 state.viewingFriendId=id;
 state.chosen=id;
 return true;
}
function showOwn(state){
 state.viewingFriendId=null;
 state.chosen=state.activeProfileId;
}
function unfollow(state,id){
 if(!state.friends.some(p=>p.id===id))return false;
 state.friends=state.friends.filter(p=>p.id!==id);
 if(state.viewingFriendId===id)showOwn(state);
 return true;
}
 return Object.freeze({STORE,SCHEMA_VERSION,restore,save,selectOwn,selectFriend,showOwn,unfollow});
})();
