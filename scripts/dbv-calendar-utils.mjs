/** Official DBV calendar facets. No player participation is inferred. */
export const AGE_OPTIONS=["U9","U11","U13","U15","U17","U19","U22","O19","O35ff."];
export const LEVEL_OPTIONS=["A","B","C","D","E","Freizeit","International","Sonstige"];
export const ALLOWED_ASSOCIATIONS=new Set(["Baden-Württemberg","Bayern","Berlin-Brandenburg","Bremen","Hamburg","Hessen",
"Mecklenburg-Vorpommern","Niedersachsen","Nordrhein-Westfalen","Rheinhessen-Pfalz","Rheinland",
"Saarland","Sachsen","Sachsen-Anhalt","Schleswig-Holstein","Thüringen"]);
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function actualCalendarDay(value){
 if(typeof value!=="string"||!DATE.test(value))return false;
 const [year,month,day]=value.split("-").map(Number);
 if(year<2000||year>2100||month<1||month>12||day<1||day>31)return false;
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()+1===month&&date.getUTCDate()===day;
}
export function calendarEntry(raw){
 if(!raw||!/^dbv-calendar-\d{2,12}$/.test(String(raw.source_key||""))||
  !actualCalendarDay(raw.start_date)||!actualCalendarDay(raw.end_date)||
  raw.end_date<raw.start_date||!String(raw.title||"").trim())return null;
 const ages=Array.isArray(raw.age_groups)?raw.age_groups.filter(a=>AGE_OPTIONS.includes(a)):[];
 const level=LEVEL_OPTIONS.includes(raw.level_group)?raw.level_group:"Sonstige";
 return {
  key:raw.source_key,title:String(raw.title).slice(0,240),
  start:raw.start_date,end:raw.end_date,
  place:String(raw.location_text||"").slice(0,180),
  organizer:String(raw.organizer||"").slice(0,100),
  bundesland:String(raw.bundesland||"").slice(0,90),
  category:String(raw.category||"").slice(0,100),level,
  ages:[...new Set(ages)],
  disciplines:Array.isArray(raw.disciplines)?raw.disciplines.filter(x=>["Einzel","Doppel","Mixed"].includes(x)):[],
  deadline:actualCalendarDay(raw.registration_deadline)?raw.registration_deadline:"",
  url:safeTournamentEventUrl(raw.event_url)||"https://turniere.badminton.de/",
  hasDirectLink:Boolean(safeTournamentEventUrl(raw.event_url)),
  checked:String(raw.last_seen_at||"")
 };
}
// Only a source-provided URL with a full DBV tournament UUID is a
// verified direct detail link. A general calendar or embed is not.
function safeTournamentEventUrl(value){
 try{
  const url=new URL(String(value||""));
  if(url.protocol!=="https:"||url.hostname!=="dbv.turnier.de"||
     url.username||url.password||url.search||url.hash)return "";
  return /^\\/tournament\\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\/?$/i.test(url.pathname)
   ?url.href:"";
 }catch{return ""}
}
export function regionLabel(t){return t.bundesland||t.organizer||"Überregional"}
// The DBV U11 Masters final is national. A regional youth search should not
// silently hide this one source-backed national championship.
export function isNationalU11Masters(t){
 return Boolean(t&&t.ages?.includes("U11")&&t.level==="A"&&
   t.organizer==="DBV"&&!t.bundesland&&
   /(?:german\s+masters|masters\s+finale).*u\s*11|u\s*11.*masters/i.test(t.title||""));
}

/**
 * Only a verified identical DBV tournament UUID can collapse archive/calendar
 * cards. Matching date, city, level or title cannot prove event identity.
 * Pure local comparison: no network calls and no personal data.
 */
export function isVerifiedCalendarDuplicate(row,curated){
 if(!row?.hasDirectLink||curated?.sourceKind!=="results")return false;
 const directId=value=>{
  try{
   const url=new URL(String(value||""));
   if(url.protocol!=="https:"||url.hostname!=="dbv.turnier.de"||
      url.username||url.password||url.search||url.hash)return "";
   const match=url.pathname.match(/^\/tournament\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
   return match?match[1].toUpperCase():"";
  }catch{return ""}
 };
 const a=directId(row.url),b=directId(curated.source);
 return Boolean(a&&a===b);
}

export function filterCalendar(entries,{region="all",age="all",level="all",year="all",q="",period="upcoming",group="region",today="",includeNationalU11Masters=false}={}){
 const search=String(q).normalize("NFKC").trim().toLocaleLowerCase("de");
 const filtered=entries.filter(t=>{
  if(year!=="all"&&t.start.slice(0,4)!==year)return false;
  const nationalU11=includeNationalU11Masters&&age==="U11"&&
    ALLOWED_ASSOCIATIONS.has(region)&&isNationalU11Masters(t);
  if(region!=="all"&&regionLabel(t)!==region&&!nationalU11)return false;
  if(age!=="all"&&!t.ages.includes(age))return false;
  if(level!=="all"&&t.level!==level)return false;
  if(period==="upcoming"&&today&&t.end<today)return false;
  if(search&&!([t.title,t.place,t.organizer,t.category].join(" ")).normalize("NFKC").toLocaleLowerCase("de").includes(search))return false;
  return true;
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,"de"));
 const groups=new Map();
 for(const event of filtered){
  const labels=group==="age"?(event.ages.length?event.ages:["Ohne Altersklasse"]):
   group==="level"?[event.level]:group==="region"?[regionLabel(event)]:["Alle Termine"];
  for(const label of labels){
   if(!groups.has(label))groups.set(label,[]);
   groups.get(label).push(event);
  }
 }
 const sortByAge=(a,b)=>AGE_OPTIONS.indexOf(a)-AGE_OPTIONS.indexOf(b);
 const labels=[...groups.keys()].sort(group==="age"?sortByAge:group==="level"?
  (a,b)=>LEVEL_OPTIONS.indexOf(a)-LEVEL_OPTIONS.indexOf(b):(a,b)=>a.localeCompare(b,"de"));
 return {total:filtered.length,groups:labels.map(label=>({label,items:groups.get(label)}))};
}

/** Suggest only source-backed level alternatives without widening location/age unintentionally. */
export function alternativeCalendarLevels(entries,settings){
 if(!LEVEL_OPTIONS.includes(settings.level))return [];
 return LEVEL_OPTIONS.filter(level=>level!==settings.level).map(level=>({
  level,count:filterCalendar(entries,{...settings,level}).total
 })).filter(x=>x.count>0);
}

/** The current official DBV source outranks supplemental historical snapshots.
 * Entries are normalized and independently validated before reaching here.
 * Only identical verified source keys match; not title, location or date.
 */
export function mergeOfficialCalendarRows(current=[],archive=[]){
 const byKey=new Map();
 for(const row of archive)byKey.set(row.key,row);
 for(const row of current)byKey.set(row.key,row);
 return [...byKey.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
