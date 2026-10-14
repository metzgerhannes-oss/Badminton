/** Device-only snapshots. Authorization is never derived from these records:
 * the server must separately verify every new download. */
export const IMPORT_SNAPSHOT_KEY="schmetterlinge.localPlayerData.v1";
export const ACCEPTED_GRANT_KEY="schmetterlinge.acceptedPlayerInvite.v3";
export const ACCEPTED_BINDINGS_KEY="schmetterlinge.acceptedPlayerInviteBindings.v1";
const DBV=/^\d{2}-\d{6}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const txt=(value,len=120)=>String(value||"").slice(0,len);
const url=value=>typeof value==="string"&&/^https:\/\//i.test(value)&&value.length<=900?value:"";
function parse(storage,key,fallback){
 try{return JSON.parse(storage.getItem(key)||"null")??fallback}catch{return fallback}
}
export function acceptedInvitationsFor(playerId,storage){
 if(!DBV.test(String(playerId||""))||!storage)return [];
 const grants=parse(storage,ACCEPTED_GRANT_KEY,[]);
 const bindings=parse(storage,ACCEPTED_BINDINGS_KEY,{});
 const ids=Array.isArray(grants)?grants:(grants?.id?[grants.id]:[]);
 return [...new Set(ids.filter(id=>UUID.test(id)&&bindings?.[id]===playerId))].slice(-20);
}
export function cleanImportedProfile(raw,playerId){
 if(!raw||raw.dbv_id!==playerId||!DBV.test(playerId))return null;
 return {dbv_id:playerId,name:txt(raw.name,80),club:txt(raw.club,120),
  age_class:txt(raw.age_class,12),
  birth_year:Number.isInteger(raw.birth_year)&&raw.birth_year>=1900&&raw.birth_year<=2100?raw.birth_year:null};
}
export function cleanImportedMatches(rows){
 if(!Array.isArray(rows))return [];
 return rows.slice(0,30).filter(row=>row&&typeof row==="object").map(row=>({
  match_date:/^\d{4}-\d{2}-\d{2}$/.test(row.match_date)?row.match_date:"",
  discipline:txt(row.discipline,55),competition:txt(row.competition,160),
  category:txt(row.category,55),player_side:txt(row.player_side,70),
  winning_side:txt(row.winning_side,70),source_name:txt(row.source_name,90),
  source_url:url(row.source_url),
  games:Array.isArray(row.games)?row.games.slice(0,3):null
 })).filter(x=>x.match_date);
}
export function cleanImportedTrophies(raw,playerId){
 if(!raw||raw.player_dbv_id!==playerId||!Array.isArray(raw.results))return null;
 const unique=new Set();
 return raw.results.slice(0,200).flatMap(t=>{
  if(t?.playerId!==playerId||t.verified!==true||![1,2,3,4].includes(t.place)||
     !/^\d{4}-\d{2}-\d{2}$/.test(t.date)||!url(t.source?.url))return [];
  const id=txt(t.id,180);if(!id||unique.has(id))return [];
  unique.add(id);
  return [{id,playerId,verified:true,place:t.place,date:t.date,
    event:txt(t.event,180),discipline:txt(t.discipline,70),
    ageGroup:txt(t.ageGroup,20),source:{url:url(t.source.url)}}];
 });
}
export function loadImportedSnapshot(playerId,storage=globalThis.localStorage){
 if(!DBV.test(String(playerId||""))||!storage)return null;
 const saved=parse(storage,IMPORT_SNAPSHOT_KEY,{});
 const row=saved?.[playerId];
 if(!row||row.version!==1||row.playerId!==playerId||!Number.isFinite(Date.parse(row.fetchedAt)))return null;
 if(row.profile&&row.profile.dbv_id!==playerId)return null;
 if(!Array.isArray(row.matches)||row.matches.length>30)return null;
 if(row.trophies!==null&&(!Array.isArray(row.trophies)||row.trophies.length>200||
   row.trophies.some(t=>t.playerId!==playerId||t.verified!==true||![1,2,3,4].includes(t.place))))return null;
 return row;
}
export function saveImportedSnapshot(playerId,{profile,matches,trophies,fetchedAt},storage=globalThis.localStorage){
 if(!DBV.test(String(playerId||""))||!storage||!Number.isFinite(Date.parse(fetchedAt)))return false;
 if(profile?.dbv_id!==playerId&&!(profile===null&&Array.isArray(trophies)))return false;
 const safeProfile=profile?cleanImportedProfile(profile,playerId):null;
 const safeMatches=profile?cleanImportedMatches(matches):[];
 const safeTrophies=trophies===null?null:cleanImportedTrophies({player_dbv_id:playerId,results:trophies},playerId);
 if(trophies!==null&&safeTrophies===null)return false;
 const existing=parse(storage,IMPORT_SNAPSHOT_KEY,{});
 const all=existing&&typeof existing==="object"&&!Array.isArray(existing)?existing:{};
 // Keep only the five latest deliberately imported player snapshots on device.
 const bounded=Object.fromEntries(Object.entries(all)
  .filter(([id,value])=>id!==playerId&&DBV.test(id)&&value?.version===1)
  .sort((a,b)=>String(b[1]?.fetchedAt||"").localeCompare(String(a[1]?.fetchedAt||"")))
  .slice(0,4));
 bounded[playerId]={version:1,playerId,profile:safeProfile,matches:safeMatches,trophies:safeTrophies,fetchedAt};
 try{storage.setItem(IMPORT_SNAPSHOT_KEY,JSON.stringify(bounded));return true}catch{return false}
}
export function deleteImportedSnapshot(playerId,storage=globalThis.localStorage){
 if(!storage||!DBV.test(String(playerId||"")))return false;
 const stored=parse(storage,IMPORT_SNAPSHOT_KEY,{});
 if(!stored||typeof stored!=="object")return false;
 delete stored[playerId];
 try{storage.setItem(IMPORT_SNAPSHOT_KEY,JSON.stringify(stored));return true}catch{return false}
}
