/** Readable, time-zone-safe headings for a followed player's tournament day.
 * Pure presentation only: never changes source status or creates fixtures.
 */
import {berlinDay} from "./today-evidence.mjs";

const DISCIPLINES=Object.freeze({
 ME:"Mädchen-Einzel",JE:"Jungen-Einzel",HE:"Herren-Einzel",DE:"Damen-Einzel",
 MD:"Mädchen-Doppel",JD:"Jungen-Doppel",HD:"Herren-Doppel",DD:"Damen-Doppel",
 MX:"Mixed",MXD:"Mixed",XD:"Mixed",GD:"Mixed",
 WS:"Damen-Einzel",MS:"Herren-Einzel",WD:"Damen-Doppel",BD:"Herren-Doppel",
 SE:"Einzel",UE:"Einzel"
});
/** Unknown codes remain unchanged rather than getting a misleading discipline. */
export function readableDiscipline(raw){
 const text=typeof raw==="string"?raw.trim().slice(0,100):"";
 const found=text.match(/^([A-Za-z]{2,3})\s+(U\d{1,2})(?=\b|\s)/);
 if(!found)return text;
 const label=DISCIPLINES[found[1].toUpperCase()];
 return label?label+" "+found[2].toUpperCase():text;
}
const nextCalendarDay=iso=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||""))return "";
 const d=new Date(iso+"T12:00:00Z");
 if(!Number.isFinite(d.getTime()))return "";
 d.setUTCDate(d.getUTCDate()+1);
 return d.toISOString().slice(0,10);
};
const validWhen=row=>typeof row?.scheduledAt==="string"&&
 Number.isFinite(Date.parse(row.scheduledAt));
const sorted=arr=>arr.sort((a,b)=>
 (validWhen(a)?Date.parse(a.scheduledAt):Infinity)-
 (validWhen(b)?Date.parse(b.scheduledAt):Infinity));
export function personalMatchdayBuckets(matches,now=Date.now()){
 const groups={today:[],tomorrow:[],later:[],unscheduled:[],finished:[],other:[]};
 const today=berlinDay(now),tomorrow=nextCalendarDay(today);
 for(const item of Array.isArray(matches)?matches:[]){
  if(!item||typeof item!=="object")continue;
  if(item.category==="finished"){groups.finished.push(item);continue;}
  if(item.category==="other"){groups.other.push(item);continue;}
  if(item.category!=="live"&&item.category!=="upcoming")continue;
  if(!validWhen(item)){groups.unscheduled.push(item);continue;}
  const day=berlinDay(item.scheduledAt);
  (day===today?groups.today:day===tomorrow?groups.tomorrow:groups.later).push(item);
 }
 for(const key of Object.keys(groups))sorted(groups[key]);
 return groups;
}
export function calendarDayCaption(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))return "";
 return new Intl.DateTimeFormat("de-DE",{
  weekday:"short",day:"2-digit",month:"2-digit",timeZone:"UTC"
 }).format(new Date(day+"T12:00:00Z"));
}
