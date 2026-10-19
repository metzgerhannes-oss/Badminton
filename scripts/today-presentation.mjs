/** Read-only, presentation-only projection of source-backed nuLiga fixture facts.
 * Reduces Heute cards to the scheduled kickoff and pairing; no live assumptions.
 * Opening a card navigates to the saved official source on nuLiga itself:
 * report page when already present, otherwise the official group/club page.
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
export function today'sMatchRows(events,{now=Date.now(),limit=12}={}){
 if(!Array.isArray(events))return [];
 const bounded=Number.isInteger(limit)?Math.max(1,Math.min(12,limit)):12;
 const seen=new Set(),result=[];
 for(const event of events){
  if(event?.entity!=="team"||event.kind!=="scheduled")continue;
  const kickoff=kickoffLabel(event.when,now);
  const pairing=String(event.detail||"").trim();
  const names=pairing.split(" – ");
  if(!kickoff||names.length!==2||!names.every(name=>name.trim().length>0))continue;
  const url=officialTeamUrl(event.sourceUrl);
  if(!url)continue;
  const key=event.id||kickoff+"|"+pairing;
  if(seen.has(key))continue;
  seen.add(key);
  result.push({id:key,kickoff,pairing,url});
  if(result.length>=bounded)break;
 }
 return result;
}
