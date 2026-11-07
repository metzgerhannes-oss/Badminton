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
// Spielform from the published event code, never guessed from age or player name.
export function gameFormat(label){
 const token=short(label,90).toUpperCase().match(/^(MXD|MIX|JE|ME|HE|DE|SE|UE|WS|MS|JD|MD|HD|DD|BD|WD|MX|GD|XD)(?=\s|$)/)?.[1];
 if(["JE","ME","HE","DE","SE","UE","WS","MS"].includes(token))return "Einzel";
 if(["JD","MD","HD","DD","BD","WD"].includes(token))return "Doppel";
 if(["MXD","MIX","MX","GD","XD"].includes(token))return "Mixed";
 return "";
}
export function ownTournamentGameGroups(games){
 const rows=Array.isArray(games)?games:[];
 return {
  upcoming:rows.filter(x=>x?.category==="live"||x?.category==="upcoming"),
  finished:rows.filter(x=>x?.category==="finished"),
  other:rows.filter(x=>x?.category==="other")
 };
}
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
  const own=participants.filter(p=>obj(p)&&obj(p.players)?.dbv_id===playerId&&
   (p.side===1||p.side===2));
  // One exact DBV identity on exactly one side: no match attribution by name.
  if(own.length!==1)continue;
  const playerSide=own[0].side;
  // Explicit imported DBV tournament identity must match the announcement;
  // the match's individual URL may point to a separate /match/ route.
  if(typeof row.source_url!=="string")continue;
  try{
   const url=new URL(row.source_url);
   const prefix="/tournament/"+dbvUuid.toLowerCase();
   const path=url.pathname.toLowerCase().replace(new RegExp("/$"),"");
   if(url.protocol!=="https:"||!["dbv.turnier.de","turnier.de","www.turnier.de"].includes(url.hostname)||
    !(path===prefix||path.startsWith(prefix+"/"))||url.username||url.password)continue;
  }catch{continue}
  const m=toMatch(row,now);if(!m)continue;
  unique.add(row.id);
  output.push({
   id:"official:"+m.id,source:"DBV-Import",status:m.label,
   discipline:m.discipline,format:gameFormat(m.discipline),
   opponent:(playerSide===1?m.side2:m.side1)==="Noch offen"?"":(playerSide===1?m.side2:m.side1),
   playerSide,side1:m.side1,side2:m.side2,
   court:m.court,scheduledAt:m.scheduledAt,
   // Published DBV scores are side1:side2; show them from THIS player's side.
   sets:playerSide===2?m.sets.map(s=>s.split(":").reverse().join(":")):m.sets,
   checkedAt:m.checkedAt,category:m.category,
   outcome:m.category==="finished"&&m.winningSide!==null?
    (m.winningSide===playerSide?"Sieg":"Niederlage"):"",
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
   status,discipline:matchLabel(match),format:gameFormat(matchLabel(match)),
   category:status==="Ergebnis veröffentlicht"?"finished":status==="Spielt gerade"?"live":"upcoming",
   opponent,court,when,score,
   outcome:outcome==="win"?"Sieg":outcome==="loss"?"Niederlage":"",
   checkedAt:row.checked_at});
 }
 if(fresh&&day.running)add(day.running,"Spielt gerade",{scoreAllowed:true});
 for(const [i,m] of (day.upcoming||[]).entries()){
  const queue=i===0&&fresh&&Number.isInteger(day.queue)?day.queue:null;
  const status=day.datedPlan?"Spielplan – Stand prüfen":
   queue===0?"Als Nächstes":queue===1?"Noch 1 Spiel davor":
   queue!==null?"Noch "+queue+" Spiele davor":"Angesetzt";
  add(m,status);
 }
 if(fresh)for(const m of (day.past||[]).slice(-6))add(m,"Ergebnis veröffentlicht",{scoreAllowed:true});
 return {...empty,tournament:short(day.tournament,120),checkedAt:row.checked_at,
  dated:!!day.datedPlan,queue:fresh?day.queue:null,games};
}
