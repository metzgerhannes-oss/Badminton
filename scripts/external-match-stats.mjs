/** Aggregate individually sourced third-party match cards, never rank points
 * or bulk Badhub career totals. Matches are explicitly not official DBV IDs. */
export const SOURCE_TYPES=["Einzel","Doppel","Mixed"];
const validUrl=value=>{
 try{
  const url=new URL(String(value||""));
  return url.protocol==="https:"&&url.hostname==="badhub.de" &&
    /^\/bwbv\/(?:turnier|begegnung)\.php$/.test(url.pathname)&&
    /^\d+$/.test(url.searchParams.get("id")||"");
 }catch{return false}
};
export function sourceMatchYears(rows){
 return [...new Set((rows||[]).map(r=>String(r?.match_year??""))
  .filter(y=>/^20\d{2}$/.test(y)))].sort((a,b)=>b.localeCompare(a));
}
export function computeExternalStats(rows,{discipline="all",year="all"}={}){
 const matching=(Array.isArray(rows)?rows:[]).filter(r=>
  (discipline==="all"||r?.discipline===discipline)&&
  (year==="all"||String(r?.match_year)===String(year)));
 const grouped=new Map();
 for(const r of matching){
  const key=r?.source_key;
  if(typeof key!=="string"||!key.trim())continue;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(r);
 }
 let wins=0,losses=0,excluded=0;
 const details=[];
 for(const versions of grouped.values()){
  if(versions.length!==1){excluded++;continue;}
  const r=versions[0];
  const games=r.games;
  const valid=[1,2].includes(r.player_side)&&[1,2].includes(r.winning_side)
   &&SOURCE_TYPES.includes(r.discipline)
   &&["tournament","league"].includes(r.category)
   &&Number.isInteger(r.match_year)&&r.match_year>=2000
   &&Array.isArray(r.opponent_names)&&r.opponent_names.length>0
   &&r.opponent_names.every(x=>typeof x==="string"&&x.trim())
   &&validUrl(r.source_url)
   &&Array.isArray(games)&&games.length>=2&&games.length<=5
   &&games.every(g=>Array.isArray(g)&&g.length===2&&g.every(x=>Number.isInteger(x)&&x>=0&&x<=40)&&g[0]!==g[1]);
  if(!valid){excluded++;continue;}
  const side1=games.filter(x=>x[0]>x[1]).length;
  const side2=games.filter(x=>x[1]>x[0]).length;
  const winner=side1>side2?1:side2>side1?2:null;
  if(winner!==r.winning_side){excluded++;continue;}
  const won=r.player_side===r.winning_side;
  won?wins++:losses++;
  details.push({...r,won});
 }
 details.sort((a,b)=>b.match_year-a.match_year||
  String(b.match_date||"").localeCompare(String(a.match_date||""))||
  a.source_key.localeCompare(b.source_key));
 const total=wins+losses;
 return {total,wins,losses,excluded,rate:total?Math.round(wins/total*100):null,details};
}
export function importCompleteness(status,loadedCount){
 if(!status||!Number.isInteger(status.verified_count)||status.verified_count<=0)
  return "Importbestand noch nicht vollständig abgeglichen.";
 const total=status.verified_count;
 const done=Math.min(total,Math.max(loadedCount,Number(status.cursor_offset)||0));
 const excluded=Math.max(0,Number(status.rejected_count)||0);
 return done<total
  ?done+" von "+total+" auswertbaren Spielen importiert; weitere folgen."
  :done+" auswertbare Quellenmatches übernommen."+
      (excluded?" "+excluded+" unklare Matchkarten ausgeschlossen.":"");
}
