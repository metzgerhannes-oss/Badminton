/** Read-only, presentation-only projection of source-backed nuLiga fixture facts.
 * Reduces Heute cards to the scheduled kickoff and pairing; no live assumptions.
 * A card opens ONLY a verified direct nuLiga match report URL.
 * A group, club or fixture listing must never masquerade as live results.
 * No cross-origin fetch, scraping, app storage or extra Supabase query.
 */
import {officialTeamUrl} from "./team-directory-utils.mjs";
import {berlinDay} from "./today-evidence.mjs";
const instant=/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,9})?)?(?:Z|[+-]\d\d:\d\d)$/;
export function kickoffLabel(value,now=Date.now()){
 if(typeof value!=="string"||!instant.test(value))return "";
 const date=new Date(value);
 if(!Number.isFinite(date.getTime())||berlinDay(date)!==berlinDay(now))return "";
 return new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit",
  hour12:false,timeZone:"Europe/Berlin"}).format(date)+" Uhr";
}
/** Accept only a direct per-match report from an official nuLiga domain.
 * No report means no link, rather than a misleading group/club overview.
 */ 
export function directMeetingReport(raw){
 const validated=officialTeamUrl(raw);
 if(!validated)return "";
 const u=new URL(validated);
 if(!/\/wa\/(?:groupMeetingReport|clubMeetingReport)$/.test(u.pathname))return "";
 if(!/^[0-9]{1,10}$/.test(u.searchParams.get("meeting")||""))return "";
 return validated;
}
export function todayMatchRows(events,{now=Date.now(),limit=12}={}){
 if(!Array.isArray(events))return [];
 const bounded=Number.isInteger(limit)?Math.max(1,Math.min(12,limit)):12;
 const seen=new Set(),result=[];
 for(const event of events){
  if(event?.entity!=="team"||!["scheduled","result"].includes(event.kind))continue;
  const kickoff=kickoffLabel(event.when,now);
  const pairing=String(event.detail||"").trim();
  const names=pairing.split(" – ");
  if(!kickoff||names.length!==2||!names.every(name=>name.trim().length>0))continue;
  const source=officialTeamUrl(event.sourceUrl);
  if(!source)continue;
  const url=directMeetingReport(source);
  const key=event.id||kickoff+"|"+pairing;
  if(seen.has(key))continue;
  seen.add(key);
  result.push({id:key,kickoff,pairing,url});
  if(result.length>=bounded)break;
 }
 return result;
}
