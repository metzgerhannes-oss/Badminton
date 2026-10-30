/** #298 Paket A: read-only, source-backed "Heute im Einsatz" candidate model.
 * This module NEVER requests data, writes profiles, or claims real-time team scores.
 * Caller supplies locally followed IDs plus existing, authorized PUBLIC rows.
 */
import {DBV_ID,liveView} from "./live-radar.mjs";
import {followedRoster} from "./followed-live.mjs";
import {TEAM_FOLLOWS_KEY,normalizeFollows,officialTeamUrl,confirmedResult,displayTeamName} from "./team-directory-utils.mjs";
import {validDay} from "./upcoming-tournaments.mjs";
export {TEAM_FOLLOWS_KEY};
export const TODAY_TEAM_LIMIT=12;
const exactId=x=>String(x??"").trim();
const short=(x,n=110)=>typeof x==="string"?x.trim().slice(0,n):"";
const dateParts=d=>Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
 timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"
}).formatToParts(d).map(p=>[p.type,p.value]));
export function berlinDay(now=Date.now()){
 const date=new Date(now);
 if(!Number.isFinite(date.getTime()))return "";
 const p=dateParts(date);
 return p.year+"-"+p.month+"-"+p.day;
}
/** Treat YYYY-MM-DD as a calendar day, but actual timestamps as instants
 * transformed into Europe/Berlin (including its daylight-saving changes). */
export function sourceMatchDay(raw){
 if(typeof raw!=="string")return "";
 if(validDay(raw))return raw;
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,9})?)?(?:Z|[+-]\d\d:\d\d)$/.test(raw)||!validDay(raw.slice(0,10)))return "";
 const date=new Date(raw);
 return Number.isFinite(date.getTime())?berlinDay(date):"";
}
export function fixtureReadPath(teams,{limit=TODAY_TEAM_LIMIT,day=berlinDay()}={}){
 if(!validDay(day))return null;
 const bound=Number.isSafeInteger(limit)?Math.max(1,Math.min(TODAY_TEAM_LIMIT,limit)):TODAY_TEAM_LIMIT;
 const ids=[...new Set((Array.isArray(teams)?teams:[])
  .map(t=>exactId(t?.id)).filter(id=>/^(?:nuliga:[0-9]{3,7}:[0-9]{4}-[0-9]{2}:[1-9][0-9]?|[0-9]+|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/i.test(id)))].slice(0,bound);
 if(!ids.length)return null;
 // 48h UTC bound covers every Europe/Berlin local day (UTC+1 or UTC+2).
 // Exact day-filtering happens only *after* receiving public fixtures.
 const start=new Date(day+"T00:00:00.000Z");
 const end=new Date(start.getTime()+86400000);
 start.setTime(start.getTime()-86400000);
 const query=new URLSearchParams({
  select:"id,team_id,match_date,home_team,away_team,home_score,away_score,status,source_url,source_checked_at",
  team_id:"in.("+ids.map(id=>'"'+id+'"').join(",")+")",order:"match_date.asc",limit:"96"
 });
 query.append("match_date","gte."+start.toISOString());
 query.append("match_date","lt."+end.toISOString());
 return "league_fixtures?"+query;
}
export function followedTeamSelection(rawFollows,teamRows,{limit=TODAY_TEAM_LIMIT}={}){
 const follows=normalizeFollows(rawFollows);
 const byKey=new Map((Array.isArray(teamRows)?teamRows:[])
  .filter(t=>t&&officialTeamUrl(t.source_url))
  .map(t=>[t.follow_key+"|"+t.season,t]));
 const found=[];const seen=new Set();
 for(const key of follows){
  const matching=[...byKey.values()].filter(t=>t.follow_key===key)
   .sort((a,b)=>String(b.season||"").localeCompare(String(a.season||"")));
  const t=matching[0];
  if(!t||seen.has(t.id))continue;
  seen.add(t.id);found.push(t);
 }
 const bound=Math.max(1,Math.min(TODAY_TEAM_LIMIT,Number(limit)||TODAY_TEAM_LIMIT));
 return {teams:found.slice(0,bound),remaining:Math.max(0,found.length-bound),
  unknown:Math.max(0,follows.length-found.length)};
}
export function todayTeamEvents({today,teams=[],fixtures=[]}={}){
 if(!validDay(today))return [];
 const byId=new Map(teams.filter(t=>t&&officialTeamUrl(t.source_url))
  .map(t=>[exactId(t.id),t]));
 const events=new Map(),verifiedFixtureKeys=new Map();
 for(const row of Array.isArray(fixtures)?fixtures:[]){
  const t=byId.get(exactId(row?.team_id));
  if(!t||!row?.id||sourceMatchDay(row.match_date)!==today)continue;
  const source=officialTeamUrl(row.source_url);
  if(!source)continue;
  const id=short(String(row.id),100);
  if(events.has(id))continue;
  // The same nuLiga match may be persisted once per followed team with
  // DIFFERENT row IDs. Deduplicate only if the official source URL,
  // home/away team strings and exact kickoff instant all coincide.
  // Never join by club/town or fixture date alone.
  const when=typeof row.match_date==="string"?Date.parse(row.match_date):NaN;
  if(!Number.isFinite(when))continue;
  const home=short(row.home_team,95),away=short(row.away_team,95);
  if(!home||!away)continue;
  const sourceKey=JSON.stringify([source,when,home,away]);
  const score=confirmedResult(row);
  let status="Heute angesetzt",kind="scheduled";
  if(row.status==="cancelled"){status="Abgesagt";kind="cancelled"}
  else if(row.status==="postponed"){status="Verlegt";kind="postponed"}
  else if(row.status==="finished"||row.status==="forfeit"){
   status=score?"Ergebnis veröffentlicht":"Ergebnis noch nicht belegt";
   kind=score?"result":"unverified-result";
  }else if(row.status!=="scheduled")continue;
  const event={
   id:"team:"+id,entity:"team",kind,status,name:short(displayTeamName(t),100),
   detail:home+" – "+away,
   score:score||"",when:row.match_date,sourceUrl:source,
   checkedAt:short(row.source_checked_at,48)||null,
   teamId:t.id,followKey:t.follow_key,source:"nuLiga"
  };
  const previousId=verifiedFixtureKeys.get(sourceKey);
  if(previousId){
   const previous=events.get(previousId);
   // Prefer a newer provider verification, not a local render timestamp.
   // Equal/missing timestamps keep the first verified card stable.
   const fresh=Date.parse(event.checkedAt),old=Date.parse(previous?.checkedAt);
   if(Number.isFinite(fresh)&&(!Number.isFinite(old)||fresh>old)){
    events.delete(previousId);
    events.set(id,event);
    verifiedFixtureKeys.set(sourceKey,id);
   }
   continue;
  }
  events.set(id,event);
  verifiedFixtureKeys.set(sourceKey,id);
 }
 return [...events.values()].sort((a,b)=>
  String(a.when).localeCompare(String(b.when))||a.name.localeCompare(b.name,"de"));
}
export function todayPlayerEvents({today,groups={},rows=[],now=Date.now()}={}){
 if(!validDay(today))return [];
 const {players,remaining}=followedRoster(groups);
 const byId=new Map((Array.isArray(rows)?rows:[])
  .filter(row=>row&&DBV_ID.test(row.dbv_id||"")).map(row=>[row.dbv_id,row]));
 const events=[];
 for(const p of players){
  const row=byId.get(p.id);
  // Only Badhub's validated, <=120s old source counts as an active day.
  const view=liveView(row,p.id,now);
  if(!["playing","next","tournament"].includes(view.status))continue;
  if(berlinDay(Date.parse(row.checked_at))!==today)continue;
  const source="https://badhub.de/spieler/"+p.id+"/live";
  const kind=view.status==="playing"?"playing":view.status==="next"?"next":"tournament";
  const status=kind==="playing"?"Spielt gerade":kind==="next"?"Spiel aufgerufen":"Turniertag gemeldet";
  events.push({
   id:"player:"+p.id+":"+short(view.tournament,80),entity:"player",kind,status,
   name:short(p.name,100),detail:short(view.tournament,115),
   score:"",when:null,sourceUrl:source,checkedAt:row.checked_at,
   playerId:p.id,role:p.role,source:"Badhub"
  });
 }
 return {events,remaining};
}
/** Show the prominent red 'Heute' tab only for a sourced match planned today.
 * A tournament announcement, an unconfirmed bookmark or a past/final score
 * is NOT proof of an upcoming/current match.
 */
export function hasVerifiedMatchToday(events=[]){
 return Array.isArray(events)&&events.some(event=>
  (event?.entity==="team"&&event.kind==="scheduled")||
  (event?.entity==="player"&&["next","playing"].includes(event.kind))
 );
}

/** Bookmarks are optional information only: never count as confirmed attendance. */
export function unconfirmedPlans({today,bookmarks=[],ownProfiles=[]}={}){
 if(!validDay(today))return [];
 const own=new Set((Array.isArray(ownProfiles)?ownProfiles:[])
  .map(p=>p?.id).filter(id=>DBV_ID.test(id||"")));
 const unique=new Map();
 for(const b of Array.isArray(bookmarks)?bookmarks:[]){
  if(!b||!validDay(b.startDate))continue;
  const end=validDay(b.endDate)&&b.endDate>=b.startDate?b.endDate:b.startDate;
  if(b.startDate>today||end<today||!(b.playerId==="all"||own.has(b.playerId)))continue;
  const title=short(b.name,115);
  if(!title)continue;
  const key=String(b.id||b.url||title+"|"+b.startDate);
  if(!unique.has(key))unique.set(key,{id:"plan:"+short(key,100),
   name:title,status:"Vorgemerkt · Teilnahme nicht bestätigt",kind:"unconfirmed",
   source:"Gerät",when:b.startDate});
 }
 return [...unique.values()].slice(0,12);
}
export function todayEvidence({now=Date.now(),groups={},snapshots=[],follows=[],teams=[],fixtures=[],bookmarks=[]}={}){
 const today=berlinDay(now);
 const selection=followedTeamSelection(follows,teams);
 const player=todayPlayerEvents({today,groups,rows:snapshots,now});
 const team=todayTeamEvents({today,teams:selection.teams,fixtures});
 const planned=unconfirmedPlans({today,bookmarks,ownProfiles:groups.own});
 return {today,events:[...player.events,...team],
  planned,coverage:{playersOmitted:player.remaining,teamsOmitted:selection.remaining,
   teamsUnresolved:selection.unknown}};
}
