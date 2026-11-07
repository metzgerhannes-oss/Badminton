/** Public, source-attributed player participation announcements.
 * A club announcement is evidence of a planned appearance, NEVER a DBV draw,
 * a confirmed match, a court, a start time, or an active LIVE result.
 * All matches are by exact DBV player ID + official tournament UUID.
 * Append source-backed records only; do not infer attendance from rankings,
 * tournament age classes, town, name similarity, or bookmarks.
 */
import {validDay} from "./upcoming-tournaments.mjs";

const DBV_ID=/^\d{2}-\d{6}$/;
const TOURNAMENT_ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const VERIFIED_PLAYER_EVENTS=Object.freeze([
 Object.freeze({
  playerId:"05-067866",
  tournamentId:"FCBE16EF-D5A9-493A-9935-B6FF78669F6C",
  name:"Südostdeutsche Meisterschaften U13–U19",
  location:"Augsburg · Erhard-Wunderlich-Sporthalle",
  startDate:"2026-11-07",
  endDate:"2026-11-08",
  tournamentUrl:"https://dbv.turnier.de/tournament/FCBE16EF-D5A9-493A-9935-B6FF78669F6C",
  evidenceUrl:"https://www.spvgg.org/abteilungen/badminton/aktuelles/suedostdeutsche-meisterschaft-u13-u19-am-07-08-november-2026",
  evidenceDate:"2026-11-03",
  evidenceLabel:"Teilnahme laut Vereinsankündigung vom 03.11.2026"
 })
]);
export function validVerifiedPlayerEvent(row){
 if(!row||!DBV_ID.test(String(row.playerId||""))||
  !TOURNAMENT_ID.test(String(row.tournamentId||""))||
  !validDay(row.startDate)||!validDay(row.endDate)||
  row.endDate<row.startDate||!validDay(row.evidenceDate)||
  row.evidenceDate>row.endDate)return false;
 if(typeof row.name!=="string"||!row.name.trim()||
  typeof row.evidenceLabel!=="string"||!row.evidenceLabel.trim())return false;
 try{
  const t=new URL(row.tournamentUrl),e=new URL(row.evidenceUrl);
  return t.protocol==="https:"&&t.hostname==="dbv.turnier.de"&&
   t.pathname.toLowerCase()==="/tournament/"+row.tournamentId.toLowerCase()&&
   t.search===""&&t.hash===""&&e.protocol==="https:"&&
   e.hostname==="www.spvgg.org"&&e.pathname.startsWith("/abteilungen/badminton/aktuelles/");
 }catch{return false}
}
export function verifiedPlayerEvents(playerId,day,{currentOnly=false,events=VERIFIED_PLAYER_EVENTS}={}){
 if(!DBV_ID.test(String(playerId||""))||!validDay(day)||!Array.isArray(events))return [];
 return events.filter(row=>validVerifiedPlayerEvent(row)&&row.playerId===playerId&&
  row.endDate>=day&&(!currentOnly||row.startDate<=day))
  .sort((a,b)=>a.startDate.localeCompare(b.startDate));
}
export function verifiedRosterEvents(groups,day,{events=VERIFIED_PLAYER_EVENTS}={}){
 if(!validDay(day))return [];
 const ids=new Set([...(Array.isArray(groups?.own)?groups.own:[]),
  ...(Array.isArray(groups?.friends)?groups.friends:[])]
  .map(row=>String(row?.id||"")).filter(id=>DBV_ID.test(id)));
 const rows=[];
 for(const id of ids)for(const row of verifiedPlayerEvents(id,day,{currentOnly:true,events})){
  rows.push(row);
 }
 return rows;
}
