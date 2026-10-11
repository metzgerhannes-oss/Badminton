/** Public, consented tournament pointers for followed DBV identities.
 * Match scores, courts and times ALWAYS come from official match caches,
 * not from these community suggestions. No local family data is uploaded.
 * Writes require a verified Supabase identity and are deliberately not
 * exposed by the current local-only app.
 */
import {readPublicRows} from "./supabase-read.mjs";
const DBV=/^\d{2}-\d{6}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const limit=30;
export function sharedTournamentQuery(raw){
 const ids=[...new Set((Array.isArray(raw)?raw:[]).filter(x=>typeof x==="string"&&DBV.test(x)))].slice(0,limit);
 if(!ids.length)return "";
 const qs=new URLSearchParams({
  select:"dbv_player_id,tournament_id,title,start_date,end_date,reported_at",
  dbv_player_id:"in.("+ids.join(",")+")",
  is_shared:"eq.true",
  order:"start_date.asc.nullslast",
  limit:"150"
 });
 return "shared_player_tournaments?"+qs.toString();
}
export function normalizeSharedTournaments(rows,requestedIds){
 const allowed=new Set((Array.isArray(requestedIds)?requestedIds:[]).filter(x=>DBV.test(String(x))));
 const byKey=new Map();
 for(const row of Array.isArray(rows)?rows:[]){
  if(!allowed.has(row?.dbv_player_id)||!UUID.test(String(row?.tournament_id||"")))continue;
  const start=typeof row.start_date==="string"&&DAY.test(row.start_date)?row.start_date:"";
  const end=typeof row.end_date==="string"&&DAY.test(row.end_date)&&row.end_date>=start?row.end_date:"";
  const title=String(row.title||"").trim().slice(0,120);
  if(!title)continue;
  const record={playerId:row.dbv_player_id,tournamentId:String(row.tournament_id).toUpperCase(),
   title,startDate:start,endDate:end,source:"community",
   officialUrl:"https://dbv.turnier.de/tournament/"+String(row.tournament_id).toUpperCase()};
  const key=record.playerId+":"+record.tournamentId;
  const prior=byKey.get(key);
  if(!prior||(record.startDate&&!prior.startDate))byKey.set(key,record);
 }
 return [...byKey.values()].sort((a,b)=>
  (a.startDate||"9999-12-31").localeCompare(b.startDate||"9999-12-31")||
  a.title.localeCompare(b.title,"de")).slice(0,150);
}
/** Returns a bounded, read-only result. Table not deployed = unavailable,
 * never invent registrations or suppress an actual local tournament. */
export async function readSharedTournaments(ids,{fetchImpl=fetch,signal}={}){
 const path=sharedTournamentQuery(ids);
 if(!path)return {rows:[],available:true};
 try{
  const {rows}=await readPublicRows(path,{fetchImpl,signal,count:false,retries:0,timeoutMs:6500});
  return {rows:normalizeSharedTournaments(rows,ids),available:true};
 }catch(error){
  if(signal?.aborted)throw error;
  return {rows:[],available:false};
 }
}
