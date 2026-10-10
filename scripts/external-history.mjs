/** External historical aggregates are source-labelled, never official per-match imports. */
const ID=/^\d{2}-\d{6}$/;
const POSITIVE=x=>Number.isInteger(x)&&x>=0;
export function validateExternalCareer(data,id){
 if(!data||data.schemaVersion!==1||!ID.test(id)||data.dbvId!==id||data.sourceStatus!=="third-party-aggregated")return false;
 if(!data.source||data.source.name!=="Badhub")return false;
 try{
  const url=new URL(data.source.url);
  if(url.protocol!=="https:"||url.hostname!=="badhub.de"||!url.pathname.endsWith("/"+id))return false;
 }catch{return false}
 const {matches,wins,losses,tournament,league}=data.totals||{};
 if(![matches,wins,losses,tournament?.matches,tournament?.wins,league?.matches,league?.wins].every(POSITIVE))return false;
 if(matches!==wins+losses||matches!==tournament.matches+league.matches||wins!==tournament.wins+league.wins)return false;
 if(!Array.isArray(data.years)||!data.years.length)return false;
 const unique=new Set();
 for(const y of data.years){
  if(!Number.isInteger(y.year)||y.year<1990||y.year>2100||unique.has(y.year))return false;
  unique.add(y.year);
  if(![y.tournaments,y.placements,y.gold,y.silver,y.bronze].every(POSITIVE))return false;
  if(y.gold+y.silver+y.bronze>y.placements)return false;
 }
 return Array.isArray(data.highlights)&&data.highlights.every(h=>
  typeof h.event==="string"&&h.event.trim()&&
  /^\d{4}-\d\d-\d\d$/.test(h.startDate)&&
  ["Einzel","Doppel","Mixed"].includes(h.discipline)&&
  POSITIVE(h.place)&&h.place>0);
}
export function seasonYears(data){
 return (data?.years||[]).map(x=>x.year).sort((a,b)=>b-a);
}
export function chooseHistory(data,{year="all",discipline="all"}={}){
 const years=(data.years||[]).filter(x=>year==="all"||String(x.year)===year).slice().sort((a,b)=>b.year-a.year);
 const highlights=(data.highlights||[]).filter(x=>
  (year==="all"||x.startDate.slice(0,4)===year)&&
  (discipline==="all"||x.discipline===discipline)
 ).slice().sort((a,b)=>b.startDate.localeCompare(a.startDate)||a.event.localeCompare(b.event));
 return {years,highlights};
}
export function lifetimeRate(data){return data.totals.matches?Math.round(data.totals.wins/data.totals.matches*100):null}
export function externalProfileLink(dbvId){return ID.test(dbvId)?"https://badhub.de/spieler/"+dbvId+"?saison=all&src=gesamt":null}
