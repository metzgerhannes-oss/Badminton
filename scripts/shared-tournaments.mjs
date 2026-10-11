/** Community entries are user-reported links, never evidence of participation. */
export const DBV_ID=/^\d{2}-\d{6}$/;
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_SHARES=20;
export function communityPath(playerId){
 if(!DBV_ID.test(String(playerId||"")))return null;
 const q=new URLSearchParams({
  select:"player_dbv_id,external_tournament_id,title,start_date,end_date,updated_at,shared_at",
  player_dbv_id:"eq."+playerId,order:"start_date.asc.nullslast",limit:String(MAX_SHARES)
 });
 return "shared_tournament_hints?"+q.toString();
}
export function sharedRecord(row){
 if(!row||!DBV_ID.test(row.player_dbv_id)||!UUID.test(row.external_tournament_id))return null;
 const id=row.external_tournament_id.toUpperCase();
 const title=String(row.title||"").trim().slice(0,120);
 if(!title)return null;
 const date=value=>/^\d{4}-\d\d-\d\d$/.test(value||"")?value:"";
 return {id,playerId:row.player_dbv_id,name:title,startDate:date(row.start_date),
  endDate:date(row.end_date),
  url:"https://dbv.turnier.de/tournament/"+id,source:"community"};
}
export function sharedItems(rows,playerId,today){
 if(!DBV_ID.test(playerId)||!/^\d{4}-\d\d-\d\d$/.test(today))return [];
 const byId=new Map();
 for(const row of Array.isArray(rows)?rows:[]){
  const item=sharedRecord(row);
  if(!item||item.playerId!==playerId)continue;
  // Do not call a shared event officially attended.
  if(item.endDate&&item.endDate<today)continue;
  if(!item.endDate&&item.startDate&&item.startDate<today)continue;
  if(!byId.has(item.id))byId.set(item.id,item);
 }
 return [...byId.values()].sort((a,b)=>(a.startDate||"9999").localeCompare(b.startDate||"9999")||a.name.localeCompare(b.name,"de")).slice(0,6);
}
export function sharePayload(bookmark,userId){
 if(!bookmark||!DBV_ID.test(bookmark.playerId)||!UUID.test(bookmark.id)||
  !UUID.test(userId))throw Error("Zum Teilen muss ein bestätigtes DBV-Spielerprofil gewählt sein.");
 const title=String(bookmark.name||"").trim().slice(0,120);
 if(title.length<3)throw Error("Bitte einen Turniernamen angeben.");
 const date=value=>/^\d{4}-\d\d-\d\d$/.test(value||"")?value:null;
 const start=date(bookmark.startDate),end=date(bookmark.endDate);
 if(end&&!start)throw Error("Bitte auch den Beginn eintragen.");
 if(end&&end<start)throw Error("Das Turnierende liegt vor dem Beginn.");
 return {user_id:userId,player_dbv_id:bookmark.playerId,
  external_tournament_id:bookmark.id,title,start_date:start,end_date:end,
  is_shared:true,shared_at:new Date().toISOString()};
}
export function sharedKey(item){return item.playerId+"|"+item.id;}
