"use strict";
/**
 * Schmetterlinge local device storage contract (v1).
 * No remote writes; do not change the existing shuttleboard-v1 key.
 * Loaded before app.js as a classic script so offline PWA and older browsers work.
 */
var SchmetterlingeStorage=(function(){
 const STORE="shuttleboard-v1";
 const SCHEMA_VERSION=1;
// Repair exactly one locally-created alias when there is a unique, compatible
// DBV profile already on this device. No remote lookup, no guessed DBV identity.
function resolveLocalAliases(state){
 const normalize=name=>String(name||"").normalize("NFKC").trim().replace(/\s+/g," ").toLocaleLowerCase("de");
 const compatible=(a,b)=>!a||!b||normalize(a)===normalize(b);
 const aliases=state.players.filter(p=>/^local-/.test(p.id));
 for(const local of aliases){
  const short=normalize(local.name);
  const official=state.players.filter(p=>/^\d{2}-\d{6}$/.test(p.id)&&(
   normalize(p.name)===short||(short&&!short.includes(" ")&&normalize(p.name).startsWith(short+" ")))&&
   compatible(local.birthYear,p.birthYear)&&compatible(local.club,p.club));
  if(official.length!==1)continue;
  const target=official[0];
  // Do not guess if two distinct players on this device share this first name.
  const first=short.split(" ")[0];
  if(state.players.some(p=>p!==local&&p!==target&&normalize(p.name).split(" ")[0]===first))continue;
  target.club=target.club||local.club;
  target.birthYear=target.birthYear||local.birthYear;
  target.url=target.url||local.url;
  state.officialLinks=state.officialLinks.map(link=>link.playerId===local.id
   ?{...link,playerId:target.id}:link);
  if(state.activeProfileId===local.id)state.activeProfileId=target.id;
  state.players=state.players.filter(p=>p!==local);
 }
}
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
   resolveLocalAliases(state);

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
