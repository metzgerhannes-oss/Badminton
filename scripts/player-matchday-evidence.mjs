/** Player-match rows for an exact, source-backed tournament announcement.
 * No scraping or network access here. Only already authorised, authenticated
 * Supabase reads / Badhub snapshots can provide match facts.
 * Official tournament UUID and DBV ID are separate, mandatory identities.
 */
import {DBV_ID,validateSnapshot,liveView,matchdayOverview,recentMatchdayPlan,
 nextMatchTiming,opponents,matchLabel,setText,playerOutcome,
 isExplicitNonplayedLiveMatch} from "./live-radar.mjs";
import {UUID,eventId,toMatch} from "./tournament-live.mjs";
import {berlinDay} from "./today-evidence.mjs";

const obj=x=>x&&typeof x==="object"&&!Array.isArray(x)?x:null;
const short=(x,n=100)=>typeof x==="string"?x.trim().slice(0,n):"";
const matchId=m=>{const o=obj(m),v=o?.match_id??o?.match_key??o?.id;
 return typeof v==="string"?short(v,120):
 Number.isSafeInteger(v)&&v>0?String(v):"";
};
const futureOrPast=(match,now)=>{
 const timing=nextMatchTiming(match,now);
 if(timing.kind==="unknown")return "";
 return timing.kind==="forecast"?"Voraussichtlich "+timing.time:
  "Geplant "+timing.time;
};
/** Only participant rows with exact published DBV IDs; never names or location. */
export function officialPlayerGames(rows,tournamentId,playerId,dbvUuid,now=Date.now()){
 if(!UUID.test(String(tournamentId||""))||!UUID.test(String(dbvUuid||""))||
  !DBV_ID.test(String(playerId||""))||!Array.isArray(rows))return [];
 const unique=new Set(),output=[];
 for(const row of rows.slice(0,240)){
  if(!obj(row)||row.tournament_id!==tournamentId||unique.has(row.id))continue;
  const participants=Array.isArray(row.match_participants)?row.match_participants:[];
  if(!participants.some(p=>obj(p)&&obj(p.players)?.dbv_id===playerId))continue;
  // Explicit imported DBV tournament identity must match the announcement;
  // the match's individual URL may point to a separate /match/ route.
  if(typeof row.source_url!=="string")continue;
  try{
   const url=new URL(row.source_url);
   const prefix="/tournament/"+dbvUuid.toLowerCase();
   const path=url.pathname.toLowerCase().replace(/\\/$/,"");
   if(url.protocol!=="https:"||!["dbv.turnier.de","turnier.de","www.turnier.de"].includes(url.hostname)||
    !(path===prefix||path.startsWith(prefix+"/"))||url.username||url.password)continue;
  }catch{continue}
  const m=toMatch(row,now);if(!m)continue;
  unique.add(row.id);
  output.push({
   id:"official:"+m.id,source:"DBV-Import",status:m.label,
   discipline:m.discipline,side1:m.side1,side2:m.side2,
   court:m.court,scheduledAt:m.scheduledAt,sets:m.sets,
   checkedAt:m.checkedAt,category:m.category,
   live:m.category==="live"&&m.sourceFresh,
   sourceUrl:"https://dbv.turnier.de/tournament/"+dbvUuid.toUpperCase()
  });
  if(output.length>=40)break;
 }
 const priority={live:0,upcoming:1,finished:2,other:3};
 return output.sort((a,b)=>(priority[a.category]??4)-(priority[b.category]??4)||
  String(a.scheduledAt||"9999").localeCompare(String(b.scheduledAt||"9999")));
}
/** Badhub is a separate player-day feed, NOT proof that a match belongs to
 * the announced official event. Clearly label its own tournament title.
 * Only 120-second-fresh running/results or <=5m dated upcoming fixtures.
 */
export function badhubPlayerGames(row,playerId,now=Date.now()){
 const empty={source:"Badhub",tournament:"",checkedAt:null,dated:false,games:[],queue:null};
 if(!DBV_ID.test(String(playerId||""))||row?.dbv_id!==playerId||!validateSnapshot(row,playerId)||
  !Number.isFinite(now)||berlinDay(row.checked_at)!==berlinDay(now))return empty;
 const checked=Date.parse(row.checked_at);
 const age=now-checked;
 if(!Number.isFinite(age)||age< -30000||age>300000)return empty;
 const live=liveView(row,playerId,now),fresh=["playing","next","tournament"].includes(live.status);
 const day=fresh?matchdayOverview(row,playerId,now):recentMatchdayPlan(row,playerId,now);
 if(!day)return empty;
 const games=[],seen=new Set();
 function add(match,status,{scoreAllowed=false}={}){
  if(!obj(match)||isExplicitNonplayedLiveMatch(match)||games.length>=12)return;
  const key=matchId(match);
  if(key&&seen.has(key))return;
  if(key)seen.add(key);
  const score=scoreAllowed?setText(match):"";
  const opponent=opponents(match);
  const court=short(match.court,35);
  const when=futureOrPast(match,now);
  if(!opponent&&!court&&!when&&!score&&!key)return;
  const outcome=scoreAllowed?playerOutcome(match):null;
  games.push({id:key||"row:"+games.length,source:"Badhub",
   status,discipline:matchLabel(match),opponent,court,when,score,
   outcome:outcome==="win"?"Sieg":outcome==="loss"?"Niederlage":"",
   checkedAt:row.checked_at});
 }
 if(fresh&&day.running)add(day.running,"Spielt gerade",{scoreAllowed:true});
 for(const m of day.upcoming||[])add(m,fresh&&day.queue===0&&games.length===0?
  "Als Nächstes":day.datedPlan?"Spielplan – Stand prüfen":"Angesetzt");
 if(fresh)for(const m of (day.past||[]).slice(-6))add(m,"Ergebnis veröffentlicht",{scoreAllowed:true});
 return {...empty,tournament:short(day.tournament,120),checkedAt:row.checked_at,
  dated:!!day.datedPlan,queue:fresh?day.queue:null,games};
}
