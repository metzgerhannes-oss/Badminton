/**
 * Transforms an explicitly authorized JSON/CSV tournament export to Shuttleboard.
 * It does not fetch, scrape or reverse-engineer dbv.turnier.de.
 * Timestamps must contain an explicit offset, or a date-only value.
 */
const STATUSES = new Set(["scheduled","ready","called","live","finished","delayed","cancelled"]);
const STATUS_MAP = new Map([
 ["geplant","scheduled"],["angesetzt","scheduled"],["offen","scheduled"],["upcoming","scheduled"],
 ["spielbereit","ready"],["bereit","ready"],["ready","ready"],
 ["aufgerufen","called"],["called","called"],
 ["läuft","live"],["laufend","live"],["live","live"],["playing","live"],["in_progress","live"],
 ["beendet","finished"],["fertig","finished"],["abgeschlossen","finished"],["completed","finished"],["finished","finished"],
 ["verspätet","delayed"],["delayed","delayed"],
 ["abgesagt","cancelled"],["cancelled","cancelled"]
]);
export const clean=(s,max=200)=>String(s??"").trim().slice(0,max);
export function safeLink(x){try{const u=new URL(String(x));return u.protocol==="https:"?u.href:""}catch{return ""}}
export function dateISO(value){
 const s=clean(value,70);
 if(!s)return "";
 if(!/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d))?$/.test(s))
  throw Error("Time must be ISO 8601 with UTC offset: "+s);
 const d=new Date(s);
 if(Number.isNaN(d.getTime()))throw Error("Invalid date: "+s);
 return d.toISOString();
}
export function parseDelimited(input){
 const content=String(input).replace(/^\uFEFF/,"");
 const head=content.split(/\r?\n/,1)[0];
 const delimiter=(head.match(/;/g)||[]).length>(head.match(/,/g)||[]).length?";":",";
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<content.length;i++){
  const c=content[i];
  if(quoted){
   if(c==='"'&&content[i+1]==='"'){field+='"';i++;}
   else if(c==='"')quoted=false;
   else field+=c;
  }else if(c==='"'&&field==="")quoted=true;
  else if(c===delimiter){row.push(field);field="";}
  else if(c==="\n"||c==="\r"){
   if(c==="\r"&&content[i+1]==="\n")i++;
   row.push(field);field="";
   if(row.some(x=>x.trim()!==""))rows.push(row);
   row=[];
  }else field+=c;
 }
 if(quoted)throw Error("Unclosed quote in CSV");
 row.push(field);if(row.some(x=>x.trim()!==""))rows.push(row);
 if(rows.length<2)throw Error("CSV needs a header and at least one data row");
 if(rows.length>2001)throw Error("CSV row limit exceeded");
 const headers=rows.shift().map(x=>x.trim());
 if(!headers.includes("matchId")||!headers.includes("tournamentId"))
  throw Error("CSV needs matchId and tournamentId columns");
 return rows.map((fields,index)=>{
  if(fields.length>headers.length)throw Error("Excess CSV fields on row "+(index+2));
  return Object.fromEntries(headers.map((h,j)=>[h,(fields[j]||"").trim()]));
 });
}
function splitTeams(value){return Array.isArray(value)?value.slice(0,4).map(x=>clean(x,120)):clean(value,600).split("|").map(x=>clean(x,120)).filter(Boolean).slice(0,4)}
function splitIds(value){return Array.isArray(value)?value.slice(0,8).map(x=>clean(x,40)):clean(value,500).split("|").map(x=>clean(x,40)).filter(Boolean).slice(0,8)}
export function normalizeAuthorizedFeed(raw,{format="json",updatedAt=null,sourceUrl="",sourceName="Freigegebener Turnierexport",allowedIds=["05-070879"]}={}){
 if(!Array.isArray(allowedIds)||!allowedIds.length)throw Error("A non-empty player allowlist is mandatory");
 const allowed=new Set(allowedIds.map(x=>clean(x,40)));
 let matches=[],tournaments=[];
 if(format==="csv"){
  const rows=parseDelimited(raw);
  const events=new Map();
  matches=rows.map((r,i)=>{
   const id=clean(r.matchId,100),tournamentId=clean(r.tournamentId,100);
   if(!id||!tournamentId)throw Error("Missing match ID or tournament ID at CSV row "+(i+2));
   if(!events.has(tournamentId))events.set(tournamentId,{id:tournamentId,name:clean(r.tournamentName,200),location:clean(r.tournamentLocation,180),startDate:r.tournamentDate?dateISO(r.tournamentDate):"",url:safeLink(r.tournamentUrl)});
   return {id,tournamentId,discipline:clean(r.discipline,120),scheduledAt:r.scheduledAt?dateISO(r.scheduledAt):"",court:clean(r.court,50),status:clean(r.status||"scheduled"),players:splitTeams(r.players||[r.playerA,r.playerB].filter(Boolean)),playerIds:splitIds(r.playerIds),score:clean(r.score,150),url:safeLink(r.url)};
  });
  tournaments=[...events.values()];
 } else if(format==="json"){
  const data=typeof raw==="string"?JSON.parse(raw):raw;
  if(!data||!Array.isArray(data.matches)||!Array.isArray(data.tournaments))throw Error("JSON requires matches[] and tournaments[]");
  matches=data.matches;
  tournaments=data.tournaments;
  if(data.updatedAt)updatedAt=data.updatedAt;
  if(data.source?.name)sourceName=data.source.name;
  if(data.source?.url)sourceUrl=data.source.url;
 } else throw Error("Unsupported feed format: "+format);
 if(matches.length>2000||tournaments.length>300)throw Error("Feed capacity exceeded");
 const ids=new Set();
 const resultMatches=matches.map((m,index)=>{
  if(!m||!m.id||!m.tournamentId)throw Error("Missing match/tournament ID: "+index);
  const id=clean(m.id,100);
  if(ids.has(id))throw Error("Duplicate match ID: "+id);
  ids.add(id);
  const status=STATUS_MAP.get(clean(m.status).toLowerCase())||clean(m.status).toLowerCase();
  if(!STATUSES.has(status))throw Error("Unsupported match status: "+status);
  return {id,tournamentId:clean(m.tournamentId,100),discipline:clean(m.discipline,120),
   scheduledAt:m.scheduledAt?dateISO(m.scheduledAt):"",court:clean(m.court,50),status,
   players:splitTeams(m.players),playerIds:splitIds(m.playerIds),score:clean(m.score,150),url:safeLink(m.url)};
 }).filter(m=>m.playerIds.some(id=>allowed.has(id)));
 const matchedTournaments=new Set(resultMatches.map(m=>m.tournamentId));
 const tournamentIds=new Set();
 const resultTournaments=tournaments.map((t,index)=>{
  if(!t||!t.id)throw Error("Missing tournament ID: "+index);
  const id=clean(t.id,100);
  if(tournamentIds.has(id))throw Error("Duplicate tournament ID: "+id);
  tournamentIds.add(id);
  return {id,name:clean(t.name,200),location:clean(t.location,180),startDate:t.startDate?dateISO(t.startDate):"",url:safeLink(t.url)};
 }).filter(t=>matchedTournaments.has(t.id));
 for(const id of matchedTournaments)if(!tournamentIds.has(id))throw Error("Match references missing tournament: "+id);
 return {schemaVersion:1,connection:"connected",updatedAt:updatedAt?dateISO(updatedAt):null,source:{name:clean(sourceName,200),url:safeLink(sourceUrl)},matches:resultMatches,tournaments:resultTournaments};
}
