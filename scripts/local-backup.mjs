/** Versioned, offline-only family data backup contract.
 * No account, API, credentials, rankings or imported third-party matches.
 * Explicitly preserves the existing shuttleboard-v1 localStorage schema. */
export const LOCAL_STORE_KEY="shuttleboard-v1";
export const SPOND_STORE_KEY="schmetterlinge.calendarEvents.v1";
export const BACKUP_KIND="schmetterlinge-local-backup";
export const BACKUP_VERSION=2;
export const LEGACY_BACKUP_VERSION=1;
export const MAX_BACKUP_BYTES=200_000;
const DBV=/^\d{2}-\d{6}$/;
const control=/[\u0000-\u001f\u007f]/;
function fail(reason){throw new Error(reason)}
function record(x){return !!x && typeof x==="object"&&!Array.isArray(x)}
function text(x,max,label,required=false){
 if(x===undefined||x===null||x===""){
  if(required)fail(label+" fehlt");
  return "";
 }
 if(typeof x!=="string"||x.length>max||control.test(x))fail(label+" ist ungültig");
 const value=x.trim();
 if(required&&!value)fail(label+" fehlt");
 return value;
}
function httpsURL(value){
 if(value==null||value==="")return "";
 const raw=text(value,1200,"Profil-Link");
 let url;
 try{url=new URL(raw)}catch{fail("Ungültiger Profil-Link")}
 if(url.protocol!=="https:"||url.username||url.password)fail("Nur sichere https-Links erlauben");
 return url.href;
}
function profile(p,kind){
 if(!record(p))fail("Ungültiges "+kind+"-Profil");
 const id=text(p.id,80,"Spieler-ID",true);
 const name=text(p.name,80,"Spielername",true);
 if(kind==="Freundes"&&!DBV.test(id))fail("Freundesprofil ohne gültige DBV-ID");
 const birth=p.birthYear;
 if(birth!==undefined&&birth!==null&&birth!==""&&
  (!Number.isInteger(birth)||birth<2000||birth>2035))fail("Geburtsjahr ungültig");
 const result={id,name,club:text(p.club,120,"Verein"),url:httpsURL(p.url)};
 if(birth!==undefined&&birth!==null&&birth!=="")result.birthYear=birth;
 return result;
}
function isDate(value){
 if(value==null||value==="")return "";
 const d=text(value,10,"Turnierdatum",true);
 if(!/^\d{4}-\d\d-\d\d$/.test(d))fail("Turnierdatum ungültig");
 const x=new Date(d+"T12:00:00Z");
 if(!Number.isFinite(x.getTime())||x.toISOString().slice(0,10)!==d)fail("Turnierdatum ungültig");
 return d;
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
function bookmark(row,owns){
 if(!record(row))fail("Ungültiger Turnierfavorit");
 const raw=text(row.url,1200,"Turnierlink",true);
 const playerId=text(row.playerId||"all",80,"Turnierspieler");
 if(playerId!=="all"&&!owns.has(playerId))fail("Turnier verweist auf unbekannten Spieler");
 const startDate=isDate(row.startDate),endDate=isDate(row.endDate);
 if(startDate&&endDate&&endDate<startDate)fail("Turnierende vor Turnierbeginn");
 const place=text(row.place,120,"Austragungsort");
 const deadline=isDate(row.deadline);
 const name=text(row.name,100,"Turniername");
 if(row.source==="dbv-calendar"){
  const id=text(row.id,80,"DBV-Kalenderkennung",true);
  if(!/^dbv-calendar-\d{2,12}$/.test(id)||raw!=="https://turniere.badminton.de/"||
     !owns.has(playerId)||!startDate||!endDate||endDate<startDate||!name)
   fail("DBV-Kalendervormerkung ungültig");
  return {id,url:raw,name,playerId,startDate,endDate,source:"dbv-calendar",place,deadline};
 }
 if(row.source==="bwbv-framework"){
  const id=text(row.id,80,"Rahmenterminkennung",true),spec=FRAMEWORK_SPECS[id];
  if(!spec||spec.url!==raw||spec.start!==startDate||spec.end!==endDate||
     !owns.has(playerId)||!name)fail("Rahmenterminquelle oder Datum ungültig");
  return {id,url:raw,name,playerId,startDate,endDate,source:"bwbv-framework",place};
 }
 let parsed;
 try{parsed=new URL(raw)}catch{fail("Ungültiger DBV-Turnierlink")}
 if(parsed.protocol!=="https:"||!["dbv.turnier.de","turnier.de","www.turnier.de"].includes(parsed.hostname))
  fail("Nur offizielle DBV-Turnierlinks erlauben");
 const matched=parsed.pathname.match(/^\/tournament\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
 if(!matched)fail("DBV-Turnier-ID fehlt");
 const id=matched[1].toUpperCase();
 return {id,url:"https://dbv.turnier.de/tournament/"+id,
  name:name||"DBV-Turnier "+id.slice(0,8),playerId,startDate,endDate,place,deadline};
}
export function normalizeLocalData(data){
 if(!record(data))fail("Kein gültiger Schmetterlinge-Datensatz");
 if(!Array.isArray(data.players)||data.players.length>12)
  fail("Maximal 12 eigene Spieler");
 if(!Array.isArray(data.friends)||data.friends.length>30)fail("Maximal 30 gefolgte Spieler");
 // An invited family member may FOLLOW an accepted player without owning
 // any profile. Their local follows must be portable between Safari and PWA.
 // Refuse a completely blank device instead of producing a misleading backup.
 if(!data.players.length&&!data.friends.length)
  fail("Keine lokalen Spielerprofile oder gefolgten Spieler zum Sichern");
 if(!Array.isArray(data.officialLinks)||data.officialLinks.length>40)fail("Maximal 40 Turnierfavoriten");
 const players=data.players.map(x=>profile(x,"eigenes"));
 const friends=data.friends.map(x=>profile(x,"Freundes"));
 // A DBV identity may be both an own profile and an independently followed
 // player. Reject duplicates *within* a role, not across distinct roles.
 for(const list of [players,friends]){
  const ids=new Set();
  for(const x of list){
   if(ids.has(x.id))fail("Doppelte Spieler-ID in der Sicherung");
   ids.add(x.id);
  }
 }
 const owns=new Set(players.map(x=>x.id));
 const links=data.officialLinks.map(x=>bookmark(x,owns));
 const seen=new Set();
 for(const link of links){
  const key=link.id+"|"+link.playerId;
  if(seen.has(key))fail("Doppelter Turnierfavorit");
  seen.add(key);
 }
 // A followed player is NEVER an owned profile: a follower-only backup
 // carries an empty Home selection. Its follow list remains intact and does
 // not implicitly confer any server permission after import.
 let activeProfileId="";
 if(players.length){
  activeProfileId=text(data.activeProfileId||data.chosen,80,"Aktives Profil",true);
  if(!owns.has(activeProfileId))fail("Das aktive Profil ist kein eigenes Spielerprofil");
 }else if(data.activeProfileId!==undefined&&data.activeProfileId!==""){
  fail("Ein gefolgter Spieler darf nicht als eigenes Profil gesichert werden");
 }
 return {players,friends,officialLinks:links,activeProfileId,
  chosen:activeProfileId,historyProfilesInitialized:true};
}
/** Preserve only explicitly imported, locally owned calendar events. Spond IDs are
 * regenerated using the same deterministic algorithm as spond-calendar.js. */
function calendarId(event){
 const raw=event.uid?"".concat(event.uid):
  "fallback:"+event.name.toLocaleLowerCase("de")+"|"+event.startDate+"|"+event.location.toLocaleLowerCase("de");
 let h=2166136261;
 for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)}
 return "calendar-"+(h>>>0).toString(16).padStart(8,"0");
}
export function normalizeCalendarEvents(rows,ownIds){
 if(!Array.isArray(rows)||rows.length>120)fail("Maximal 120 private Kalendertermine");
 if(!(ownIds instanceof Set))fail("Spielerzuordnungen fehlen");
 const result=[],seen=new Set();
 for(const row of rows){
  if(!record(row))fail("Ungültiger Kalendertermin");
  const name=text(row.name,140,"Kalendername",true);
  const startDate=isDate(row.startDate),endDate=isDate(row.endDate)||startDate;
  if(!startDate||endDate<startDate)fail("Kalenderdatum ungültig");
  const playerId=text(row.playerId,80,"Kalenderspieler",true);
  if(!ownIds.has(playerId))fail("Kalendertermin verweist auf unbekanntes eigenes Profil");
  const location=text(row.location,120,"Kalenderort");
  const uid=text(row.uid,160,"Kalenderkennung");
  const importedAt=text(row.importedAt,40,"Importdatum");
  if(importedAt&&!Number.isFinite(Date.parse(importedAt)))fail("Importdatum ungültig");
  const clean={name,startDate,endDate,location,uid,playerId,importedAt,source:"spond"};
  clean.id=calendarId(clean);
  const identity=clean.id+"|"+playerId;
  if(seen.has(identity))fail("Doppelter Kalendertermin");
  seen.add(identity);result.push(clean);
 }
 return result;
}
function parseCalendarStorage(value,ownIds){
 if(value===null||value===undefined||value==="")return [];
 if(typeof value!=="string"||value.length>MAX_BACKUP_BYTES)fail("Lokale Kalenderdaten sind zu groß");
 let rows;try{rows=JSON.parse(value)}catch{fail("Lokale Kalenderdaten können nicht gelesen werden")}
 return normalizeCalendarEvents(rows,ownIds);
}
export function createLocalBackup(stored,now=new Date(),calendarStored="[]"){
 if(typeof stored!=="string"||!stored)fail("Noch keine lokal gespeicherten Profile vorhanden");
 if(stored.length>MAX_BACKUP_BYTES)fail("Die lokalen Daten sind zu groß");
 let raw;
 try{raw=JSON.parse(stored)}catch{fail("Lokale Daten können nicht gelesen werden")}
 const data=normalizeLocalData(raw);
 const calendarEvents=parseCalendarStorage(calendarStored,new Set(data.players.map(p=>p.id)));
 const archive=JSON.stringify({kind:BACKUP_KIND,schemaVersion:BACKUP_VERSION,
  createdAt:now.toISOString(),data,calendarEvents},null,2);
 if(new TextEncoder().encode(archive).byteLength>MAX_BACKUP_BYTES)fail("Die Sicherung ist zu groß");
 return archive;
}
export function inspectLocalBackup(content){
 if(typeof content!=="string"||content.length>MAX_BACKUP_BYTES)fail("Sicherungsdatei zu groß");
 let archive;
 try{archive=JSON.parse(content)}catch{fail("Die Datei enthält kein gültiges JSON")}
 if(!record(archive)||archive.kind!==BACKUP_KIND||
   ![LEGACY_BACKUP_VERSION,BACKUP_VERSION].includes(archive.schemaVersion))
  fail("Dies ist keine unterstützte Schmetterlinge-Sicherungsdatei");
 if(typeof archive.createdAt!=="string"||
  !Number.isFinite(Date.parse(archive.createdAt)))fail("Sicherungsdatum ungültig");
 const data=normalizeLocalData(archive.data);
 const calendarEvents=archive.schemaVersion===LEGACY_BACKUP_VERSION
  ?null:normalizeCalendarEvents(archive.calendarEvents,new Set(data.players.map(p=>p.id)));
 return {
  data,calendarEvents,createdAt:archive.createdAt,
  summary:{players:data.players.length,friends:data.friends.length,
   tournaments:data.officialLinks.length,calendarEvents:calendarEvents?.length??null,
   activePlayer:data.players.find(x=>x.id===data.activeProfileId)?.name||"Kein eigenes Profil"}
 };
}
