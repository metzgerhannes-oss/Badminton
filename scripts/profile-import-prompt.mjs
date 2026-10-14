/** One prompt after explicit profile selection. Never a permission grant. */
export const PENDING_KEY="schmetterlinge.dataImportPrompt.v1";
export const SEEN_KEY="schmetterlinge.dataImportIntroSeen.v1";
export const ACCEPTED_KEY="schmetterlinge.acceptedPlayerInvite.v3";
export const BINDINGS_KEY="schmetterlinge.acceptedPlayerInviteBindings.v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID=/^\d{2}-\d{6}$/;
const cleanId=value=>String(value||"").trim().slice(0,60);

export function markImportPending(storage,playerId){
 const id=cleanId(playerId);if(!id)return;
 try{storage.setItem(PENDING_KEY,id)}catch{}
}
export function consumeImportPending(storage){
 try{const id=cleanId(storage.getItem(PENDING_KEY));storage.removeItem(PENDING_KEY);return id}
 catch{return ""}
}
export function shouldShowImportIntro(storage,playerId,{force=false}={}){
 const id=cleanId(playerId);if(!id)return false;
 if(force)return true;
 try{const seen=JSON.parse(storage.getItem(SEEN_KEY)||"[]");return !Array.isArray(seen)||!seen.includes(id)}
 catch{return true}
}
export function markImportIntroSeen(storage,playerId){
 const id=cleanId(playerId);if(!id)return;
 try{
  const current=JSON.parse(storage.getItem(SEEN_KEY)||"[]");
  const ids=Array.isArray(current)?current.filter(x=>typeof x==="string"&&x.length<=60):[];
  storage.setItem(SEEN_KEY,JSON.stringify([...new Set([...ids,id])].slice(-50)));
 }catch{}
}
function parse(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||"null")??fallback}catch{return fallback}}
export function acceptedInviteIds(storage,playerId){
 if(!ID.test(String(playerId||"")))return [];
 const bound=parse(storage,BINDINGS_KEY,{});
 const accepted=parse(storage,ACCEPTED_KEY,[]);
 const ids=Array.isArray(accepted)?accepted:(accepted?.id?[accepted.id]:[]);
 return [...new Set(ids.filter(id=>UUID.test(id)&&bound?.[id]===playerId))].slice(-20);
}
