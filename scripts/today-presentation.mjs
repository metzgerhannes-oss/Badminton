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


/** #298 F08: a compact, verifiable player/team projection from the EXISTING
 * read-only evidence model. No request, polling or publication side effect.
 * A browser-rendered live claim must expire even if a tab was suspended. */
const PLAYER_ID=/^\d{2}-\d{6}$/;
const PLAYER_STATUS=Object.freeze({
 playing:"Spielt gerade",next:"Spiel aufgerufen",tournament:"Turniertag gemeldet"
});
const TEAM_STATUS=Object.freeze({
 scheduled:"Heute angesetzt",result:"Ergebnis veröffentlicht",
 postponed:"Verlegt",cancelled:"Abgesagt", "unverified-result":"Ergebnis noch nicht belegt"
});
const ORDER=Object.freeze({playing:0,next:1,scheduled:2,tournament:3,result:4,
 postponed:5,cancelled:6,"unverified-result":7});
const safeText=(value,max=115)=>typeof value==="string"?value.trim().slice(0,max):"";
export function todayDisplayRows(events,{now=Date.now(),limit=102}={}){
 if(!Array.isArray(events)||!Number.isFinite(new Date(now).getTime()))return [];
 const bounded=Number.isSafeInteger(limit)?Math.max(1,Math.min(102,limit)):102;
 const rows=[],seen=new Set();
 for(const event of events){
  if(!event||typeof event!=="object")continue;
  const id=safeText(event.id,120);
  if(!id||seen.has(id))continue;
  if(event.entity==="player"){
   const playerId=safeText(event.playerId,20);
   if(!PLAYER_ID.test(playerId)||!Object.hasOwn(PLAYER_STATUS,event.kind))continue;
   // A provider URL, DBV ID, same-day check and strict 120-second TTL all
   // have to match. Local profile names never confer LIVE authorization.
   const url="https://badhub.de/spieler/"+playerId+"/live";
   if(event.source!=="Badhub"||event.sourceUrl!==url)continue;
   const check=Date.parse(event.checkedAt);
   if(!Number.isFinite(check)||check>Number(now)||Number(now)-check>120000
    ||berlinDay(check)!==berlinDay(now))continue;
   const name=safeText(event.name,90);
   if(!name)continue;
   seen.add(id);
   rows.push({id,entity:"player",kind:event.kind,label:"Spieler",
    status:PLAYER_STATUS[event.kind],name,detail:safeText(event.detail),
    kickoff:"",pairing:"",score:"",url,priority:ORDER[event.kind],order:rows.length});
  }else if(event.entity==="team"){
   if(!Object.hasOwn(TEAM_STATUS,event.kind)||event.source!=="nuLiga")continue;
   const kickoff=kickoffLabel(event.when,now);
   const pairing=safeText(event.detail,210);
   const parts=pairing.split(" – ");
   if(!kickoff||parts.length!==2||parts.some(s=>!s.trim()))continue;
   const source=officialTeamUrl(event.sourceUrl);
   if(!source)continue;
   const score=event.kind==="result"?safeText(event.score,7):"";
   // The evidence layer only emits "result" for a validated official score;
   // never render an unsubstantiated end result from a bare status.
   if(event.kind==="result"&&!/^(?:0|[1-9]\d?):(?:0|[1-9]\d?)$/.test(score))continue;
   const url=["scheduled","result"].includes(event.kind)?directMeetingReport(source):"";
   seen.add(id);
   rows.push({id,entity:"team",kind:event.kind,label:"Mannschaft",
    status:TEAM_STATUS[event.kind],name:safeText(event.name,100),detail:"",kickoff,pairing,score,
    url,priority:ORDER[event.kind],order:rows.length});
  }
 }
 return rows.sort((a,b)=>a.priority-b.priority||a.order-b.order)
  .slice(0,bounded).map(({priority,order,...row})=>row);
}
