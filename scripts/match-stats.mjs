/** Deterministic statistics for verified, concluded matches only.
 * Tournament placements, sets and rankings never enter this computation. */
export const DISCIPLINES=["Einzel","Doppel","Mixed"];
export function computeMatchStats(rows,{discipline="all",year="all"}={}){
 const source=Array.isArray(rows)?rows:[];
 const selected=source.filter(row=>
  (discipline==="all"||row.discipline===discipline) &&
  (year==="all"||typeof row.match_date==="string"&&row.match_date.slice(0,4)===year)
 );
 const grouped=new Map();
 for(const row of selected){
  if(!row||typeof row.match_id!=="string")continue;
  if(!grouped.has(row.match_id))grouped.set(row.match_id,[]);
  grouped.get(row.match_id).push(row);
 }
 let wins=0,losses=0,excluded=0;
 const details=[];
 for(const versions of grouped.values()){
  // Conflicting rows for the same match/player are never used as win/loss evidence.
  if(versions.length!==1){excluded++;continue}
  const m=versions[0];
  const valid=m.countable===true && m.match_status==="finished"
   && DISCIPLINES.includes(m.discipline)
   && [1,2].includes(m.player_side) && [1,2].includes(m.winning_side)
   && typeof m.source_url==="string"&&m.source_url.startsWith("https://")
   && typeof m.opponent_names==="string"&&m.opponent_names.trim();
  if(!valid){excluded++;continue}
  const won=m.player_side===m.winning_side;
  if(won)wins++;else losses++;
  details.push({...m,won});
 }
 details.sort((a,b)=>String(b.match_date||"").localeCompare(String(a.match_date||""))||a.match_id.localeCompare(b.match_id));
 const total=wins+losses;
 return {total,wins,losses,excluded,rate:total?Math.round(wins/total*100):null,details};
}
export function availableYears(rows){
 return [...new Set((rows||[]).map(x=>String(x?.match_date||"").slice(0,4))
  .filter(x=>/^20\d{2}$/.test(x)))].sort((a,b)=>b.localeCompare(a));
}
