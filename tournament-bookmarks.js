"use strict";
/**
 * Pure local helpers for manually saved official DBV tournament bookmarks.
 * Classic script to keep the existing offline PWA and older Safari compatible.
 * Does not fetch tournament pages, change the local storage schema or write remotely.
 */
var SchmetterlingeBookmarks=(function(){
 const HOSTS=new Set(["dbv.turnier.de","turnier.de","www.turnier.de"]);
 function parseDbvTournamentLink(value){
  try{
   const u=new URL(String(value).trim());
   if(u.protocol!=="https:"||!HOSTS.has(u.hostname))return null;
   const match=u.pathname.match(/^\/tournament\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
   if(!match)return null;
   const id=match[1].toUpperCase();
   return {id,url:"https://dbv.turnier.de/tournament/"+id};
  }catch{return null}
 }
 function validDate(value){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return "";
  const [year,month,day]=value.split("-").map(Number);
  if(year<100||month<1||month>12||day<1||day>31)return "";
  const date=new Date(Date.UTC(year,month-1,day));
  return date.toISOString().slice(0,10)===value?value:"";
 }
 function normalizeBookmark(value){
  const parsed=parseDbvTournamentLink(value?.url);
  if(!parsed)return null;
  const name=String(value.name||"").trim().slice(0,100)||"DBV-Turnier "+parsed.id.slice(0,8);
  return {id:parsed.id,url:parsed.url,name,playerId:String(value.playerId||"all"),
   startDate:validDate(value.startDate),endDate:validDate(value.endDate)};
 }
 function localDay(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>["year","month","day"].includes(p.type)).map(p=>[p.type,p.value]));
  return values.year+"-"+values.month+"-"+values.day;
 }
 function niceDay(value){
  return value?new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T12:00:00Z")):"";
 }
 function visible(state){
  if(state.viewingFriendId)return [];
  return state.officialLinks.filter(t=>t.playerId==="all"||t.playerId===state.activeProfileId);
 }
 function phase(bookmark,today=localDay()){
  if(!bookmark.startDate)return ["Termin offen","unknown"];
  if(today<bookmark.startDate)return ["Bevorstehend","future"];
  const end=bookmark.endDate&&bookmark.endDate>=bookmark.startDate?bookmark.endDate:bookmark.startDate;
  if(today>end)return ["Vergangen","past"];
  return ["Turniertag","today"];
 }
 function sorted(state,today=localDay()){
  const order={today:0,future:1,unknown:2,past:3};
  return visible(state).slice().sort((a,b)=>{
   const aKind=phase(a,today)[1],bKind=phase(b,today)[1];
   return order[aKind]-order[bKind]||
    (aKind==="past"?(b.startDate||"").localeCompare(a.startDate||""):
     (a.startDate||"").localeCompare(b.startDate||""))||
    a.name.localeCompare(b.name,"de");
  });
 }
 return Object.freeze({parseDbvTournamentLink,normalizeBookmark,validDate,localDay,niceDay,visible,phase,sorted});
})();
