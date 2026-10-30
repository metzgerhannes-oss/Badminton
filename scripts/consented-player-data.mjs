/** Explicit, one-way device copy of already server-authorized sport records.
 * This is DATA ONLY. Never use it to authorize another server request. */
export const KEY="schmetterlinge.consentedPlayerData.v1";
const DBV=/^\d{2}-\d{6}$/;
const safeText=(v,n=160)=>String(v??"").slice(0,n);
const https=v=>typeof v==="string"&&v.length<=1000&&/^https:\/\/[^\s]+$/i.test(v)?v:"";
const get=(storage,key,fallback)=>{try{return JSON.parse(storage?.getItem(key)||"null")??fallback}catch{return fallback}};
export function cleanMatch(row,player){
 if(!row||row.dbv_id!==player||!DBV.test(player)||!/^\d{4}-\d\d-\d\d$/.test(row.match_date||"")||
  !https(row.source_url)||typeof row.source_key!=="string"||![1,2].includes(row.player_side)||
  ![1,2].includes(row.winning_side)||!Array.isArray(row.opponent_names)||!Array.isArray(row.games))return null;
 // Keep the evidence fields used by computeExternalStats. Dropping match_year,
 // source_kind or outcome_evidence makes locally copied matches silently vanish
 // from the win/loss statistics, even though the cards are still present.
 const matchYear=Number.isInteger(row.match_year)?row.match_year:Number(row.match_date.slice(0,4));
 if(matchYear<2000||matchYear>2100)return null;
 return {dbv_id:player,source_key:safeText(row.source_key,240),source_url:https(row.source_url),
  match_date:row.match_date,match_year:matchYear,
  player_side:row.player_side,winning_side:row.winning_side,
  competition:safeText(row.competition),event:safeText(row.event),
  round_label:safeText(row.round_label,120),
  discipline:safeText(row.discipline,75),category:safeText(row.category,75),
  source_name:safeText(row.source_name,100),source_kind:safeText(row.source_kind,100),
  outcome_evidence:safeText(row.outcome_evidence,75),
  opponent_names:row.opponent_names.slice(0,4).map(x=>safeText(x,100)),
  partner_names:(Array.isArray(row.partner_names)?row.partner_names:[]).slice(0,4).map(x=>safeText(x,100)),
  games:row.games.slice(0,5).filter(g=>Array.isArray(g)&&g.length===2&&g.every(n=>Number.isInteger(n)&&n>=0&&n<=40)).map(g=>[g[0],g[1]])};
}
export function cleanTrophy(row,player){
 if(!row||!DBV.test(player)||row.playerId!==player||row.verified!==true||
  ![1,2,3,4].includes(row.place)||!/^\d{4}-\d\d-\d\d$/.test(row.date||"")||
  !https(row.source?.url)||!row.id)return null;
 return {id:safeText(row.id,180),playerId:player,verified:true,place:row.place,date:row.date,
  event:safeText(row.event,180),discipline:safeText(row.discipline,75),
  ageGroup:safeText(row.ageGroup,30),source:{url:https(row.source.url)}};
}
export function loadPlayerCopy(player,storage=globalThis.localStorage){
 if(!DBV.test(player))return null;
 const item=get(storage,KEY,{})?.[player];
 if(!item||item.version!==1||item.playerId!==player||!Number.isFinite(Date.parse(item.fetchedAt)))return null;
 // Local storage is not proof of source verification. A damaged or stale
 // device copy must never turn unverified placements into offline trophies.
 // Fail closed for the entire category instead of silently dropping rows and
 // displaying an apparently complete zero/partial result.
 if(item.matches!==null&&(!Array.isArray(item.matches)||item.matches.length>10000||
  item.matches.some(row=>!cleanMatch(row,player))))return null;
 if(item.trophies!==null&&(!Array.isArray(item.trophies)||item.trophies.length>200||
  item.trophies.some(row=>!cleanTrophy(row,player))))return null;
 // Return only the same allowlisted fields that the consented writer stores.
 // This is display data, never a server grant or an authorization token.
 return {version:1,playerId:player,fetchedAt:item.fetchedAt,
  coverage:"quellenabhaengiges_teilarchiv",
  matches:item.matches===null?null:item.matches.map(row=>cleanMatch(row,player)),
  trophies:item.trophies===null?null:item.trophies.map(row=>cleanTrophy(row,player))};
}
export function savePlayerCopy(player,{matches=null,trophies=null},storage=globalThis.localStorage,now=new Date().toISOString()){
 if(!DBV.test(player)||(!Array.isArray(matches)&&!Array.isArray(trophies))||!Number.isFinite(Date.parse(now)))return null;
 const unique=new Set(),trophySeen=new Set();
 const goodMatches=Array.isArray(matches)?matches.slice(0,10000).flatMap(row=>{
  const value=cleanMatch(row,player);if(!value||unique.has(value.source_key))return [];
  unique.add(value.source_key);return [value];
 }):null;
 const goodTrophies=Array.isArray(trophies)?trophies.slice(0,200).flatMap(row=>{
  const value=cleanTrophy(row,player);if(!value||trophySeen.has(value.id))return [];
  trophySeen.add(value.id);return [value];
 }):null;
 const old=get(storage,KEY,{});
 const safe=Object.fromEntries(Object.entries(old&&typeof old==="object"&&!Array.isArray(old)?old:{})
  .filter(([id,v])=>id!==player&&DBV.test(id)&&v?.version===1)
  .sort((a,b)=>String(b[1]?.fetchedAt||"").localeCompare(String(a[1]?.fetchedAt||""))).slice(0,3));
 const item={version:1,playerId:player,fetchedAt:now,coverage:"quellenabhaengiges_teilarchiv",
  matches:goodMatches,trophies:goodTrophies};
 safe[player]=item;
 try{storage.setItem(KEY,JSON.stringify(safe));return item}catch{return null}
}
export function deletePlayerCopy(player,storage=globalThis.localStorage){
 const old=get(storage,KEY,{});
 if(!DBV.test(player)||!Object.hasOwn(old,player))return false;
 delete old[player];try{storage.setItem(KEY,JSON.stringify(old));return true}catch{return false}
}

/** User-requested portable export of the already-consented, local data copy.
 * Never include auth, device sessions or unknown extra storage fields. */
export function serializePlayerDataExport(player,storage=globalThis.localStorage){
 const saved=loadPlayerCopy(player,storage);
 if(!saved)return null;
 const matches=Array.isArray(saved.matches)?saved.matches
  .map(row=>cleanMatch(row,player)).filter(Boolean):null;
 const trophies=Array.isArray(saved.trophies)?saved.trophies
  .map(row=>cleanTrophy(row,player)).filter(Boolean):null;
 return JSON.stringify({
  format:"schmetterlinge-player-data-export",
  version:1,playerId:player,fetchedAt:saved.fetchedAt,
  coverage:"quellenabhaengiges_teilarchiv",matches,trophies
 },null,2);
}
