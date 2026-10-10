/** Versioned, offline-only family data backup contract.
 * No account, API, credentials, rankings or imported third-party matches.
 * Explicitly preserves the existing shuttleboard-v1 localStorage schema. */
export const LOCAL_STORE_KEY="shuttleboard-v1";
export const BACKUP_KIND="schmetterlinge-local-backup";
export const BACKUP_VERSION=1;
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
function bookmark(row,owns){
 if(!record(row))fail("Ungültiger Turnierfavorit");
 const raw=text(row.url,1200,"Turnierlink",true);
 let parsed;
 try{parsed=new URL(raw)}catch{fail("Ungültiger DBV-Turnierlink")}
 if(parsed.protocol!=="https:"||!["dbv.turnier.de","turnier.de","www.turnier.de"].includes(parsed.hostname))
  fail("Nur offizielle DBV-Turnierlinks erlauben");
 const matched=parsed.pathname.match(/^\/tournament\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
 if(!matched)fail("DBV-Turnier-ID fehlt");
 const id=matched[1].toUpperCase();
 const playerId=text(row.playerId||"all",80,"Turnierspieler");
 if(playerId!=="all"&&!owns.has(playerId)&&playerId!=="local-charlotte")fail("Turnier verweist auf unbekannten Spieler");
 const startDate=isDate(row.startDate),endDate=isDate(row.endDate);
 if(startDate&&endDate&&endDate<startDate)fail("Turnierende vor Turnierbeginn");
 return {
  id,url:"https://dbv.turnier.de/tournament/"+id,
  name:text(row.name,100,"Turniername")||"DBV-Turnier "+id.slice(0,8),
  playerId,startDate,endDate
 };
}
export function normalizeLocalData(data){
 if(!record(data))fail("Kein gültiger Schmetterlinge-Datensatz");
 if(!Array.isArray(data.players)||data.players.length<1||data.players.length>12)
  fail("Die Sicherung benötigt 1 bis 12 eigene Spieler");
 if(!Array.isArray(data.friends)||data.friends.length>30)fail("Maximal 30 gefolgte Spieler");
 if(!Array.isArray(data.officialLinks)||data.officialLinks.length>40)fail("Maximal 40 Turnierfavoriten");
 const players=data.players.map(x=>profile(x,"eigenes"));
 const friends=data.friends.map(x=>profile(x,"Freundes"));
 const ids=new Set();
 for(const x of [...players,...friends]){
  if(ids.has(x.id))fail("Doppelte Spieler-ID in der Sicherung");
  ids.add(x.id);
 }
 const owns=new Set(players.map(x=>x.id));
 const links=data.officialLinks.map(x=>bookmark(x,owns));
 const seen=new Set();
 for(const link of links){
  const key=link.id+"|"+link.playerId;
  if(seen.has(key))fail("Doppelter Turnierfavorit");
  seen.add(key);
 }
 const original=text(data.activeProfileId||data.chosen,80,"Aktives Profil",true);
 const activeProfileId=original==="local-charlotte"&&owns.has("05-071969")
  ?"05-071969":original;
 if(!owns.has(activeProfileId))fail("Das aktive Profil ist kein eigenes Spielerprofil");
 return {players,friends,officialLinks:links,activeProfileId,
  chosen:activeProfileId,historyProfilesInitialized:true};
}
export function createLocalBackup(stored,now=new Date()){
 if(typeof stored!=="string"||!stored)fail("Noch keine lokal gespeicherten Profile vorhanden");
 if(stored.length>MAX_BACKUP_BYTES)fail("Die lokalen Daten sind zu groß");
 let raw;
 try{raw=JSON.parse(stored)}catch{fail("Lokale Daten können nicht gelesen werden")}
 const data=normalizeLocalData(raw);
 return JSON.stringify({kind:BACKUP_KIND,schemaVersion:BACKUP_VERSION,
  createdAt:now.toISOString(),data},null,2);
}
export function inspectLocalBackup(content){
 if(typeof content!=="string"||content.length>MAX_BACKUP_BYTES)fail("Sicherungsdatei zu groß");
 let archive;
 try{archive=JSON.parse(content)}catch{fail("Die Datei enthält kein gültiges JSON")}
 if(!record(archive)||archive.kind!==BACKUP_KIND||archive.schemaVersion!==BACKUP_VERSION)
  fail("Dies ist keine unterstützte Schmetterlinge-Sicherungsdatei");
 if(typeof archive.createdAt!=="string"||
  !Number.isFinite(Date.parse(archive.createdAt)))fail("Sicherungsdatum ungültig");
 const data=normalizeLocalData(archive.data);
 return {
  data,createdAt:archive.createdAt,
  summary:{players:data.players.length,friends:data.friends.length,
   tournaments:data.officialLinks.length,activePlayer:data.players.find(x=>x.id===data.activeProfileId)?.name}
 };
}
