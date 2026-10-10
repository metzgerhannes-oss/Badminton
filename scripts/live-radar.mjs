/** Pure checks for the public matchday snapshot cached by Supabase.
 * Provider data is user-provided content, never HTML and never a DBV-owned match. */
export const DBV_ID=/^\d{2}-\d{6}$/;
export const LIVE_API="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1";
export const PUBLISHABLE="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
export function watchRequest(id){
 if(!DBV_ID.test(id||""))return null;
 return {
  url:LIVE_API+"/player_live_watches",
  body:JSON.stringify({dbv_id:id}),
  headers:{apikey:PUBLISHABLE,"Content-Type":"application/json",Prefer:"return=minimal"}
 };
}
export function snapshotPath(id){
 if(!DBV_ID.test(id||""))return null;
 const query=new URLSearchParams({
  select:"dbv_id,provider,source_url,checked_at,payload,last_error_at",
  dbv_id:"eq."+id,limit:"1"
 });
 return "player_live_snapshots?"+query;
}
export function snapshotUrl(id){
 const path=snapshotPath(id);
 return path?LIVE_API+"/"+path:null;
}
export function validSource(url,id){
 return DBV_ID.test(id||"") && url==="https://badhub.de/spieler/"+id+"/live";
}
export function freshness(row,now=Date.now()){
 const checked=Date.parse(row?.checked_at||"");
 if(!Number.isFinite(checked))return {ageMs:Infinity,fresh:false,stale:true};
 const age=Math.max(0,now-checked);
 return {ageMs:age,fresh:age<=120000,stale:age>120000};
}
const object=x=>x&&typeof x==="object"&&!Array.isArray(x)?x:null;
const str=(value,len=100)=>String(value??"").trim().slice(0,len);
export function sourceSets(match){
 const m=object(match);
 if(!m)return [];
 let entries=m.sets;
 if(typeof m.sets_json==="string"){
  try{entries=JSON.parse(m.sets_json)}catch{entries=[]}
 }
 if(!Array.isArray(entries))return [];
 const flip=m.is_team1===0||m.is_team1===false;
 return entries.filter(s=>Array.isArray(s)&&s.length>=2&&
  s.slice(0,2).every(n=>Number.isInteger(n)&&n>=0&&n<=40)&&(s[0]+s[1]>0))
  .slice(0,5).map(s=>flip?[s[1],s[0]]:[s[0],s[1]]);
}
export function setText(match){return sourceSets(match).map(x=>x.join(":")).join(" · ");}
export function opponents(match){
 const m=object(match);if(!m)return "";
 const arr=m.lineup?.opponents;
 if(Array.isArray(arr)){
  const names=arr.map(p=>str(p?.name,70)).filter(Boolean);
  if(names.length)return names.slice(0,2).join(" / ");
 }
 return str(m.opponent_name||m.opponent,110);
}
export function matchLabel(match){
 const m=object(match);if(!m)return "Begegnung";
 return str(m.class||m.class_label||m.discipline||"Begegnung",90);
}
export function validateSnapshot(row,id){
 if(!row||!validSource(row.source_url,id)||row.provider!=="Badhub")return false;
 const p=object(row.payload);
 if(!p||!Array.isArray(p.upcoming)||!Array.isArray(p.past)||!Array.isArray(p.entries))return false;
 if(p.tournament!=null&&!object(p.tournament))return false;
 if(p.running!=null&&!object(p.running))return false;
 return true;
}
export function liveView(row,id,now=Date.now()){
 if(!validateSnapshot(row,id))return {status:"unavailable",age:null};
 const age=freshness(row,now);
 const p=row.payload;
 if(!age.fresh)return {status:"stale",age:age.ageMs};
 if(!p.tournament)return {status:"idle",age:age.ageMs,summary:"Kein laufendes Turnier laut Quelle"};
 return {
  // Queue position must be known: the source hides an unplaced match.
  status:p.running?"playing":(Number.isInteger(p.next?.queue_position)?"next":"tournament"),
  age:age.ageMs,
  tournament:str(p.tournament.name,120),
  running:object(p.running),
  next:Number.isInteger(p.next?.queue_position)?object(p.next):null,
  upcoming:p.upcoming.filter(object).slice(0,12),
  past:p.past.filter(object).slice(0,8),
  entries:p.entries.filter(object).slice(0,10)
 };
}
/** User-facing meaning of the last SOURCED result, not a cache-maintenance warning.
 * A stale active match must never display old scores as if live.
 * A stale empty result remains an appropriately qualified source observation.
 */
export function radarSituation(row,id,now=Date.now()){
 if(!validateSnapshot(row,id)){
  return {kind:"pending",title:"Turnierdaten werden geprüft",
   detail:"Wir prüfen, ob für dieses Spielerprofil aktuell Begegnungen gemeldet sind.",
   checkedAt:null,showScore:false};
 }
 const {fresh,ageMs}=freshness(row,now);
 const checkedAt=row.checked_at;
 if(!row.payload.tournament){
  // A report from yesterday cannot support "currently no match".
  if(ageMs>30*60000){
   return {kind:"pending",title:"Turnierstatus wird geprüft",
    detail:"Bei der letzten Quellenprüfung war kein Turnier gemeldet. Ein aktuellerer Stand wird automatisch abgefragt.",
    checkedAt,ageMs,showScore:false};
  }
  return {kind:"idle",title:"Derzeit kein Turniertag gemeldet",
   detail:fresh
    ?"Die öffentliche Quelle meldet für diesen Spieler derzeit keine laufenden Turnierspiele."
    :"Bei der letzten Prüfung war kein Turniertag gemeldet. Neuere Meldungen werden erneut abgefragt.",
   checkedAt,ageMs,showScore:false,isCurrent:fresh};
 }
 if(!fresh){
  return {kind:"updating",title:"Aktueller Spielstand wird geprüft",
   detail:"Die Quelle hat einen Turniertag gemeldet. Bis zum nächsten bestätigten Abgleich werden keine älteren Satzstände als live angezeigt.",
   checkedAt,ageMs,showScore:false,
   tournament:str(row.payload.tournament.name,120)};
 }
 return {kind:"current",title:"Aktueller Turniertag",detail:"",checkedAt,ageMs,showScore:true};
}
export function playerOutcome(match){
 const m=object(match);
 if(!m||typeof m.team1_won!=="boolean"||
    ![true,false,1,0].includes(m.is_team1))return null;
 // The source delivers is_team1 as boolean or 0/1. Never infer unknown sides.
 return m.team1_won===Boolean(m.is_team1)?"win":"loss";
}
export function sourceTime(value){
 if(!value||!Number.isFinite(Number(value)))return "";
 const n=Number(value);
 if(n<1e10||n>3e13)return "";
 const d=new Date(n);
 return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"}).format(d)+" Uhr";
}
