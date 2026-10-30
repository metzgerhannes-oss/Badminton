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
export function demandPost(id){
 if(!validHistoryId(id))return null;
 return {url:SUPABASE_ROOT+"/rpc/request_player_history_demand",
  body:JSON.stringify({target_id:id}),
  headers:{apikey:PUBLIC_KEY,"Content-Type":"application/json",Accept:"application/json"}};
}
export function importStatusPath(id){
 if(!validHistoryId(id))return null;
 const p=new URLSearchParams({select:"dbv_id,status,detail,source_name,imported_match_count,last_checked_at,updated_at",
  dbv_id:"eq."+id,limit:"1"});
 return "player_history_imports?"+p;
}
export function importStatusUrl(id){
 const path=importStatusPath(id);
 return path?SUPABASE_ROOT+"/"+path:null;
}
export function overviewPath(id){
 if(!validHistoryId(id))return null;
 const p=new URLSearchParams({select:"dbv_id,source_name,source_kind,summary,source_checked_on",
  dbv_id:"eq."+id,limit:"1"});
 return "player_history_overviews?"+p;
}
export function overviewUrl(id){
 const path=overviewPath(id);
 return path?SUPABASE_ROOT+"/"+path:null;
}
export function importMessage(row){
 if(!row)return {kind:"none",title:"Noch kein Importauftrag",detail:"Eine bestätigte DBV-Spieler-ID startet die Quellenprüfung."};
 // The verified per-player coverage RPC returns a count of stored source
 // cards, not a career total. Never infer unimported matches from the count.
 const count=Number.isSafeInteger(row.match_cards)&&row.match_cards>0
  ?" "+row.match_cards+" gespeicherte Einzelmatchkarten (Teilbestand, keine Gesamtkarriere).":"";
 switch(row.status){
  case "queued":return {kind:"queued",title:"Historie vorgemerkt",detail:"Der erste Quellenabgleich startet automatisch. Die Quelle wird anschließend gemeinsam für alle Nutzer genutzt."};
  case "checking":return {kind:"checking",title:"Historische Quellen werden geprüft",detail:"Der Quellenabgleich läuft auf dem Server."};
  case "complete":return {kind:"complete",title:"Verfügbare Quellen verarbeitet",
   detail:"Der letzte geprüfte Quellenlauf ist abgeschlossen. Dies bestätigt nicht die Vollständigkeit aller Karriere- und DBV-Spiele."+count};
  case "partial":return {kind:"partial",title:"Historische Einzelspiele teilweise verfügbar",
   detail:"Der geprüfte Quellenbestand ist unvollständig oder enthält ausgeschlossene Karten. Bereits belegte Spiele bleiben sichtbar."+count};
  case "awaiting_source":return {kind:"waiting",title:"Weitere Matchquelle noch nicht verfügbar",
   detail:"Die geprüfte Quelle liefert derzeit keine neuen eindeutigen Einzelmatches. Vorhandene Ranglisten und Turnierergebnisse bleiben sichtbar."+count};
  case "error":return {kind:"error",title:"Quellenprüfung vorübergehend fehlgeschlagen",
   detail:"Ein neuer Quellenabgleich ist derzeit nicht abgeschlossen; vorhandene Einzelmatchbelege bleiben gespeichert."+count};
  default:return {kind:"none",title:"Importstatus nicht bekannt",detail:"Bitte später erneut versuchen."};
 }
}
export function retryAfterHours(row){
 if(!row)return 0;
 return row.status==="partial"||row.status==="awaiting_source"?7*24:
  row.status==="error"?1:0;
}

// A 200 response may mean the source job was SKIPPED or saw no fresh
// evidence. Only a server-confirmed positive write warrants a match refresh.
// Reject malformed counters: never claim new matches from an HTTP status alone.
export function historyImportOutcome(body){
 if(!body||typeof body!=="object"||Array.isArray(body))return null;
 if(body.queued===false)return {acknowledged:true,changed:false};
 if(body.queued!==true||!Number.isSafeInteger(body.stored)||
  body.stored<0||body.stored>120)return null;
 return {acknowledged:true,changed:body.stored>0};
}
