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
 const FRAMEWORK_SPECS=Object.freeze({
 "bwbv-2027-c-1":{start:"2027-01-16",end:"2027-01-17",url:"https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf"},
 "bwbv-2027-b-3":{start:"2027-01-30",end:"2027-01-31",url:"https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf"},
 "dbv-bw-a-2027-2":{start:"2027-02-20",end:"2027-02-21",url:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"},
 "bwbv-2027-c-2":{start:"2027-02-27",end:"2027-02-28",url:"https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf"},
 "dbv-bw-a-2027-4":{start:"2027-04-24",end:"2027-04-25",url:"https://www.badminton.de/news/badminton/turniervergabe-nachwuchsveranstaltungen-2027-1/"},
 "bwbv-2027-c-3":{start:"2027-05-08",end:"2027-05-09",url:"https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf"},
 "bwbv-2027-c-4":{start:"2027-06-26",end:"2027-06-27",url:"https://bwbv.de/wp-content/uploads/2026/03/Termine-2026_2027_Jugend.pdf"}
});
 function normalizeBookmark(value){
  // A BWBV framework date is an optional LOCAL reminder, not an actual
  // registered tournament with a turnier.de UUID or verified venue.
  if(value?.source==="bwbv-framework"){
   const id=String(value.id||""),url=String(value.url||"");
   const name=String(value.name||"").trim().slice(0,100);
   const playerId=String(value.playerId||"");
   const startDate=validDate(value.startDate),endDate=validDate(value.endDate);
   const spec=FRAMEWORK_SPECS[id];
   if(!spec||spec.url!==url||spec.start!==startDate||spec.end!==endDate||!name||
      !startDate||!startDate.startsWith("2027-")||!endDate||endDate<startDate||
      !playerId||playerId==="all")return null;
   return {id,url,name,playerId,startDate,endDate,source:"bwbv-framework",
    place:String(value.place||"").trim().slice(0,120)};
  }
  // Source calendar rows have a DBV public calendar ID, not necessarily a
  // verified turnier.de UUID. Keep them in the private local list without
  // pretending that the calendar overview is an individual DBV match page.
  if(value?.source==="dbv-calendar"){
   const id=String(value.id||"");
   const name=String(value.name||"").trim().slice(0,100);
   const startDate=validDate(value.startDate),endDate=validDate(value.endDate);
   const playerId=String(value.playerId||"");
   if(!/^dbv-calendar-\d{2,12}$/.test(id)||!name||!startDate||!endDate||endDate<startDate||
      !playerId||playerId==="all"||value.url!=="https://turniere.badminton.de/")return null;
   return {id,url:"https://turniere.badminton.de/",name,playerId,startDate,endDate,source:"dbv-calendar",
    place:String(value.place||"").trim().slice(0,120),deadline:validDate(value.deadline)};
  }
  const parsed=parseDbvTournamentLink(value?.url);
  if(!parsed)return null;
  const name=String(value.name||"").trim().slice(0,100)||"DBV-Turnier "+parsed.id.slice(0,8);
  return {id:parsed.id,url:parsed.url,name,playerId:String(value.playerId||"all"),
   startDate:validDate(value.startDate),endDate:validDate(value.endDate),
   place:String(value.place||"").trim().slice(0,120),deadline:validDate(value.deadline)};
 }
 /** Edits ONLY a private locally saved calendar/framework venue.
  * Never infer a DBV tournament UUID, rewrite dates or claim official proof.
  * A later exact-key official reconciliation remains authoritative.
  */
 function updateLocalCalendarVenue(bookmark,value){
  if(!bookmark||!["dbv-calendar","bwbv-framework"].includes(bookmark.source)||
     typeof value!=="string"||value.length>120||
     /[\x00-\x1f\x7f]/.test(value))return null;
  const next=normalizeBookmark({...bookmark,place:value.trim()});
  return next&&next.id===bookmark.id&&next.playerId===bookmark.playerId&&
   next.source===bookmark.source?next:null;
 }
 /** Only describe a calendar link as a DIRECT tournament page when the
  * exact calendar key has one verified DBV tournament UUID in the local
  * official feed. Generic overview URLs (even with hasDirectLink=true),
  * untrusted hosts and ambiguous duplicate keys must remain overview links.
  * Never join a saved calendar reminder by title or town.
  */
 function verifiedCalendarEventUrl(bookmark,rows){
  if(bookmark?.source!=="dbv-calendar"||!Array.isArray(rows))return "";
  const matching=rows.filter(row=>row?.key===bookmark.id);
  if(matching.length!==1||matching[0].hasDirectLink!==true)return "";
  return parseDbvTournamentLink(matching[0].url)?.url||"";
 }
 // Use only an already loaded official-calendar row with an exact source key or UUID.
 // A similar venue/name is NEVER sufficient to join two distinct tournaments.
 function reconcileOfficialMetadata(bookmark,rows){
  if(!bookmark||!Array.isArray(rows))return {status:"unverified"};
  const isCalendar=bookmark.source==="dbv-calendar";
  if(bookmark.source==="bwbv-framework")return {status:"unverified"};
  const own=!isCalendar&&parseDbvTournamentLink(bookmark.url);
  if(!isCalendar&&!own)return {status:"unverified"};
  const matching=rows.filter(row=>{
   if(!row||typeof row!=="object")return false;
   if(isCalendar)return row.key===bookmark.id;
   // A general DBV calendar landing page never confirms a tournament identity.
   const direct=row.hasDirectLink===true?parseDbvTournamentLink(row.url):null;
   return Boolean(direct&&direct.id===own.id);
  });
  if(matching.length!==1)return {status:"unverified"};
  const row=matching[0];
  const start=validDate(row.start),end=validDate(row.end);
  if(!start||!end||end<start)return {status:"unverified"};
  // Source-first rule: a unique, official DBV source identity decides event
  // metadata. Local bookmarks own only the player association and reminder.
  // Never identify two events by venue/title/age alone.
  const officialName=String(row.title||"").trim().slice(0,100);
  const officialPlace=String(row.place||"").trim().slice(0,120);
  const officialDeadline=validDate(row.deadline);
  const patch={};
  if(officialName&&bookmark.name!==officialName)patch.name=officialName;
  if(bookmark.startDate!==start)patch.startDate=start;
  if(bookmark.endDate!==end)patch.endDate=end;
  if(officialPlace&&bookmark.place!==officialPlace)patch.place=officialPlace;
  if(officialDeadline&&bookmark.deadline!==officialDeadline)patch.deadline=officialDeadline;
  return {status:"matched",sourceCorrected:Object.keys(patch).length>0,
   updated:Object.keys(patch).length?{...bookmark,...patch}:bookmark};
 }
 // Explain only fields changed by a uniquely verified official DBV identity.
 // This is presentation metadata; never log player names or private links.
 function describeOfficialChanges(before,after){
  const labels={name:"Titel/Kategorie",startDate:"Spieltag",endDate:"Turnierende",
   place:"Austragungsort",deadline:"Meldeschluss"};
  return Object.keys(labels).filter(key=>String(after?.[key]||"")&&
   String(before?.[key]||"")!==String(after[key])).map(key=>labels[key]);
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
 function hasTournamentToday(state,today=localDay()){
  const ownIds=new Set((state?.players||[]).map(p=>p.id));
  return (state?.officialLinks||[]).some(t=>(t.playerId==="all"||ownIds.has(t.playerId))&&t.source!=="dbv-calendar"&&t.source!=="bwbv-framework"&&phase(t,today)[1]==="today");
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
 return Object.freeze({parseDbvTournamentLink,normalizeBookmark,verifiedCalendarEventUrl,updateLocalCalendarVenue,reconcileOfficialMetadata,describeOfficialChanges,validDate,localDay,niceDay,visible,phase,hasTournamentToday,sorted});
})();
