/**
 * Select the next scheduled tournaments for one active player.
 * Only manually saved DBV bookmarks with a start date are eligible.
 * An event with an end date remains upcoming through its final local day.
 * This does not imply live results or real-time tournament availability.
 */
const DATE=/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
function validDay(value){
 if(typeof value!=="string"||!DATE.test(value))return false;
 const dt=new Date(value+"T12:00:00Z");
 return !Number.isNaN(dt.getTime())&&dt.toISOString().slice(0,10)===value;
}
export function upcomingTournaments(items,playerId,today,{limit=3}={}){
 if(!Array.isArray(items)||!validDay(today)||!playerId)return [];
 const eligible=items.filter(t=>{
  if(!t||!validDay(t.startDate))return false;
  if(t.playerId!=="all"&&t.playerId!==playerId)return false;
  const end=validDay(t.endDate)&&t.endDate>=t.startDate?t.endDate:t.startDate;
  return end>=today;
 });
 // Same DBV tournament can be linked more than once for a player.
 const unique=new Map();
 for(const tournament of eligible){
  const key=tournament.id||tournament.url;
  if(!key)continue;
  const previous=unique.get(key);
  if(!previous||(previous.playerId==="all"&&tournament.playerId===playerId))
   unique.set(key,tournament);
 }
 return [...unique.values()].sort((a,b)=>{
  // Events currently within their entered date range are shown first.
  const aCurrent=a.startDate<=today;
  const bCurrent=b.startDate<=today;
  if(aCurrent!==bCurrent)return aCurrent?-1:1;
  return a.startDate.localeCompare(b.startDate)||
    String(a.name||"").localeCompare(String(b.name||""),"de")||
    String(a.id||"").localeCompare(String(b.id||""));
 }).slice(0,Math.max(0,Math.min(3,Number.isFinite(limit)?Math.floor(limit):3)));
}
export {validDay};
