/** Validated public DBV-ID job requests; no family account or follows stored remotely. */
export const SUPABASE_ROOT="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1";
export const PUBLIC_KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const ID=/^\d{2}-\d{6}$/;
export const validHistoryId=value=>typeof value==="string"&&ID.test(value);
export function importPost(id){
 if(!validHistoryId(id))return null;
 return {
  url:SUPABASE_ROOT+"/player_history_imports?on_conflict=dbv_id",
  body:JSON.stringify({dbv_id:id}),
  headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json",
    Prefer:"resolution=ignore-duplicates,return=minimal"}
 };
}
export function importStatusUrl(id){
 if(!validHistoryId(id))return null;
 const p=new URLSearchParams({select:"dbv_id,status,detail,source_name,imported_match_count,last_checked_at,updated_at",
  dbv_id:"eq."+id,limit:"1"});
 return SUPABASE_ROOT+"/player_history_imports?"+p;
}
export function overviewUrl(id){
 if(!validHistoryId(id))return null;
 const p=new URLSearchParams({select:"dbv_id,source_name,source_kind,summary,source_checked_on",
  dbv_id:"eq."+id,limit:"1"});
 return SUPABASE_ROOT+"/player_history_overviews?"+p;
}
export function importMessage(row){
 if(!row)return {kind:"none",title:"Noch kein Importauftrag",detail:"Eine bestätigte DBV-Spieler-ID startet die Quellenprüfung."};
 switch(row.status){
  case "queued":return {kind:"queued",title:"Historie vorgemerkt",detail:"Der erste Quellenabgleich startet automatisch. Die Quelle wird anschließend gemeinsam für alle Nutzer genutzt."};
  case "checking":return {kind:"checking",title:"Historische Quellen werden geprüft",detail:"Der Quellenabgleich läuft auf dem Server."};
  case "partial":return {kind:"partial",title:"Historische Übersicht verfügbar",detail:"Externe Karriereübersicht in Supabase übernommen. Einzelne offizielle DBV-Matches sind noch nicht importiert."};
  case "awaiting_source":return {kind:"waiting",title:"Einzelmatches noch nicht importiert",detail:"Wir können derzeit noch keine einzeln belegten historischen Matches übernehmen. Die Quellen werden weiterhin regelmäßig geprüft; vorhandene Ranglisten und Turnierergebnisse bleiben nutzbar."};
  case "error":return {kind:"error",title:"Quellenprüfung vorübergehend fehlgeschlagen",detail:"Ein erneuter automatischer Versuch ist vorgesehen."};
  default:return {kind:"none",title:"Importstatus nicht bekannt",detail:"Bitte später erneut versuchen."};
 }
}
export function retryAfterHours(row){
 if(!row)return 0;
 return row.status==="partial"||row.status==="awaiting_source"?7*24:
  row.status==="error"?1:0;
}
