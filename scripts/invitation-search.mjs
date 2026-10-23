/** Public, read-only player search for invitation onboarding; no personal data is uploaded. */
import {normalizeFriendSearch,asFriendCandidate,SEARCH_LIMIT} from "./friend-search.mjs";
import {validDbvLookup,searchDbvIdentities} from "./targeted-player-search.mjs";

const DIRECTORY="./data/player-library/";
const VALID_AGE=/^U(?:11|13|15|17|19|22)$/;
const fold=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de");

export function invitationCandidates(rows){
 const byId=new Map();
 for(const row of Array.isArray(rows)?rows:[]){
  const player=asFriendCandidate(row);
  if(player&&!byId.has(player.id))byId.set(player.id,player);
 }
 return [...byId.values()].slice(0,SEARCH_LIMIT);
}

async function backupCandidates(term,fetchImpl,signal){
 const get=async path=>{
  const response=await fetchImpl(path,{signal,cache:"no-store"});
  if(!response.ok)throw Error("DBV-Backup nicht erreichbar");
  return response.json();
 };
 const index=await get(DIRECTORY+"index.json");
 if(index?.schemaVersion!==1||!Array.isArray(index.ageGroups))throw Error("Ungültiges DBV-Backup");
 const files=await Promise.all(index.ageGroups.filter(g=>VALID_AGE.test(g.age)).map(g=>get(DIRECTORY+g.age+".json")));
 const needle=fold(term);
 const matches=[];
 const seen=new Set();
 for(const file of files){
  if(!Array.isArray(file?.players))continue;
  for(const row of file.players){
   const player=asFriendCandidate(row);
   if(!player||seen.has(player.id))continue;
   seen.add(player.id);
   if(fold(player.name).includes(needle)||player.id.includes(term))matches.push(player);
  }
 }
 return matches.sort((a,b)=>a.name.localeCompare(b.name,"de")).slice(0,SEARCH_LIMIT);
}

/** Returns only public DBV identities. An aborted request never triggers a fallback. */
export async function searchInvitationPlayers(raw,{fetchImpl=fetch,signal,savedCandidates=[]}={}){
 const term=normalizeFriendSearch(raw);
 if(!validDbvLookup(term))return {players:[],source:"none"};
 // Previously accepted invitations and locally chosen profiles can be found
 // without asking a public service for information about arbitrary people.
 const needle=fold(term);
 const onDevice=invitationCandidates(savedCandidates).filter(player=>
  fold(player.name).includes(needle)||player.id.includes(term));
 // A local hit must not hide other matching official identities.
 const combine=remote=>{
  const byId=new Map();
  for(const p of [...onDevice,...invitationCandidates(remote)])
   if(!byId.has(p.id))byId.set(p.id,p);
  return [...byId.values()].slice(0,12);
 };
 if(signal?.aborted)throw Object.assign(new Error("Search aborted"),{kind:"aborted"});
 try{
  const rows=await searchDbvIdentities(term,{fetchImpl,signal});
  if(signal?.aborted)throw Object.assign(new Error("Search aborted"),{kind:"aborted"});
  return {players:combine(rows),source:onDevice.length&&rows.length?"mixed":onDevice.length?"device":"dbv"};
 }catch(error){
  if(signal?.aborted||error?.kind==="aborted")throw error;
  // Respect 401/403 privacy restrictions; never bypass them via backup files.
  if(error?.status===401||error?.status===403)
   return {players:combine([]),source:onDevice.length?"restricted-device":"restricted"};
  try{
   const remote=await backupCandidates(term,fetchImpl,signal);
   if(signal?.aborted)throw Object.assign(new Error("Search aborted"),{kind:"aborted"});
   return {players:combine(remote),source:remote.length?(onDevice.length?"mixed-backup":"backup"):
    onDevice.length?"unavailable-device":"unavailable"};
  }catch(fallbackError){
   if(signal?.aborted)throw fallbackError;
   return {players:combine([]),source:onDevice.length?"unavailable-device":"unavailable"};
  }
 }
}
