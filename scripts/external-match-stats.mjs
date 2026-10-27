import {completedMatchWinner,explicitScoringRule} from "./badminton-score-rules.mjs";
import {excludeContradictoryRounds} from "./match-source-integrity.mjs";
/** Aggregate individually sourced third-party match cards, never rank points
 * or bulk Badhub career totals. Matches are explicitly not official DBV IDs. */
export const SOURCE_TYPES=["Einzel","Doppel","Mixed"];
const validUrl=value=>{
 try{
  const url=new URL(String(value||""));
  return url.protocol==="https:"&&url.hostname==="badhub.de" &&
    /^\/(?:bwbv\/(?:turnier|begegnung)|dbv\/turnier)\.php$/.test(url.pathname)&&
    /^\d+$/.test(url.searchParams.get("id")||"");
 }catch{return false}
};
export function sourceMatchYears(rows){
 return [...new Set((rows||[]).map(r=>String(r?.match_year??""))
  .filter(y=>/^20\d{2}$/.test(y)))].sort((a,b)=>b.localeCompare(a));
}
export function computeExternalStats(rows,{discipline="all",year="all"}={}){
 const input=Array.isArray(rows)?rows:[];
 // The importer already quarantines contradictory knockout rounds. Reapply the
 // same rule to historical stored cards before any year/discipline filter so
 // filtering cannot turn an impossible event into an apparent valid victory.
 const {accepted}=excludeContradictoryRounds(input);
 const allowed=new Set(accepted);
 const matching=input.filter(r=>
  (discipline==="all"||r?.discipline===discipline)&&
  (year==="all"||String(r?.match_year)===String(year)));
 const grouped=new Map();
 for(const r of matching){
  const key=r?.source_key;
  if(typeof key!=="string"||!key.trim())continue;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(r);
 }
 let wins=0,losses=0,excluded=0,quarantined=0;
 const details=[];
 for(const versions of grouped.values()){
  if(versions.length!==1){excluded++;continue;}
  const r=versions[0];
  if(!allowed.has(r)){excluded++;quarantined++;continue;}
  const games=r.games;
  const valid=[1,2].includes(r.player_side)&&[1,2].includes(r.winning_side)
   &&SOURCE_TYPES.includes(r.discipline)
   &&["tournament","league"].includes(r.category)
   &&Number.isInteger(r.match_year)&&r.match_year>=2000
   &&Array.isArray(r.opponent_names)&&r.opponent_names.length>0
   &&r.opponent_names.every(x=>typeof x==="string"&&x.trim())
   &&validUrl(r.source_url)
   &&Array.isArray(games)&&games.length<=5
   &&(games.length>0||(
    r.outcome_evidence==="badhub-bold-dash"&&
    r.category==="tournament"&&
    r.source_name==="Badhub"&&
    r.source_kind==="third-party-match-card"&&
    /^tournament:/.test(r.source_key)
   ))
   &&games.every(g=>Array.isArray(g)&&g.length===2&&g.every(x=>Number.isInteger(x)&&x>=0&&x<=40)&&g[0]!==g[1]);
  if(!valid){excluded++;continue;}
  const rule=explicitScoringRule(String(r.competition||"")+" "+String(r.event||""));
  const completion=games.length===0
   ?{winningSide:r.winning_side,ruleId:null,ruleSource:"badhub-bold-no-scores",setsWon:null}
   :completedMatchWinner(games,{year:r.match_year,rule});
  if(!completion||completion.winningSide!==r.winning_side){excluded++;continue;}
  const won=r.player_side===r.winning_side;
  won?wins++:losses++;
  details.push({...r,won,scoring:completion});
 }
 details.sort((a,b)=>b.match_year-a.match_year||
  String(b.match_date||"").localeCompare(String(a.match_date||""))||
  a.source_key.localeCompare(b.source_key));
 const total=wins+losses;
 return {total,wins,losses,excluded,quarantined,rate:total?Math.round(wins/total*100):null,details};
}
/**
 * Import cursor = source-processing position, never the number of persisted,
 * accessible match facts. Report only actual REST rows as available. The
 * provider overview and match evidence are not guaranteed to be exhaustive.
 */
/**
 * The scan's verified_count/cursor_offset describe a single import run.
 * Stored cards can span years and earlier runs; never display "N of M" as
 * if those two independent counters measure the same source population.
 */
export function importCompleteness(status,loadedCount){
 const available=Number.isSafeInteger(loadedCount)&&loadedCount>=0?loadedCount:0;
 const batch=Number.isSafeInteger(status?.verified_count)&&status.verified_count>=0
  ?status.verified_count:null;
 const cursor=Number.isSafeInteger(status?.cursor_offset)&&status.cursor_offset>0
  ?status.cursor_offset:null;
 const rejected=Number.isSafeInteger(status?.rejected_count)&&status.rejected_count>0
  ?status.rejected_count:0;
 let message=available
  ?available+" belegte Quellkarten derzeit in der App verfügbar."
  :"Noch keine Einzelmatchbelege in der App verfügbar.";
 if(batch!==null){
  message+=" Letzter Quellenlauf: "+batch+" als gültig erkannt.";
  message+=" Diese Laufzahl ist keine Gesamtzahl der Spielerhistorie.";
 }
 if(cursor!==null&&status?.status!=="complete")
  message+=" Importposition: "+cursor+" (keine Anzahl gespeicherter Spiele).";
 if(status?.status==="loading"||status?.status==="queued")
  message+=" Der Quellenabgleich läuft.";
 if(status?.status==="partial")
  message+=" Der letzte Import war teilweise abgeschlossen.";
 if(rejected)
  message+=" "+rejected+" unklare Matchkarten im protokollierten Quellenlauf ausgeschlossen.";
 if(status?.status==="awaiting_source")
  message+=" Die externe Quelle ist derzeit nicht abrufbar.";
 if(status?.status==="error")
  message+=" Der letzte Importversuch war nicht erfolgreich.";
 const checked=Date.parse(status?.last_finished_at||"");
 if(Number.isFinite(checked)){
  message+=" Letzter dokumentierter Importversuch: "+
   new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric",
    hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"})
    .format(new Date(checked))+".";
 }
 return message+" Die gesamte Spielhistorie ist damit nicht als vollständig bestätigt.";
}
