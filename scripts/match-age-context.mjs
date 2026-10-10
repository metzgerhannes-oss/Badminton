/** Context of a match relative to the player's youth age class in the match year.
 * Never infer the age of opponents: this is the published EVENT age category.
 * Missing/multiple age categories and league/adult matches remain unclassified. */
export const AGE_CLASSES=[9,11,13,15,17,19,22];
export function ownAgeClass(birthYear,year){
 const born=Number(birthYear),played=Number(year);
 if(!Number.isInteger(born)||!Number.isInteger(played)||
    born<1900||played<2000||played>2100||born>played)return null;
 const age=played-born; // age at end of competition calendar year
 const limit=AGE_CLASSES.find(value=>age<value);
 return limit?"U"+limit:null;
}
export function matchEventClass(event){
 const text=String(event||"").toUpperCase();
 const matches=[...text.matchAll(/(?:^|[^A-Z0-9])U\s*(9|11|13|15|17|19|22)(?![0-9])/g)];
 const unique=[...new Set(matches.map(m=>Number(m[1])))];
 return unique.length===1?"U"+unique[0]:null;
}
export function classifyMatchAge(row,birthYear,{official=false}={}){
 const year=Number(official?String(row?.match_date||"").slice(0,4):
   row?.match_year||String(row?.match_date||"").slice(0,4));
 const own=ownAgeClass(birthYear,year);
 const event=(!official&&row?.category!=="tournament")?null:
  matchEventClass(official?row?.event_code:row?.event);
 const category=own&&event
  ?Number(event.slice(1))===Number(own.slice(1))?"own":
   Number(event.slice(1))>Number(own.slice(1))?"higher":"unclassified"
  :"unclassified";
 // A lower class is not silently shown as a valid "own" or "higher" entry.
 return {category,own,event,year:Number.isInteger(year)&&year>=2000?year:null};
}
export function ageContextBreakdown(stats,birthYear,{official=false,filter="all"}={}){
 const buckets={own:{wins:0,losses:0},higher:{wins:0,losses:0},
  unclassified:{wins:0,losses:0}};
 const annotated=(stats?.details||[]).map(row=>{
  const ageContext=classifyMatchAge(row,birthYear,{official});
  const bucket=buckets[ageContext.category];
  row.won?bucket.wins++:bucket.losses++;
  return {...row,ageContext};
 });
 const details=filter==="all"?annotated:annotated.filter(row=>row.ageContext.category===filter);
 const wins=details.filter(row=>row.won).length,losses=details.length-wins,total=wins+losses;
 return {total,wins,losses,rate:total?Math.round(wins/total*100):null,
  excluded:stats?.excluded||0,details,buckets};
}
