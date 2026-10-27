/**
 * Offline-only privacy-preserving match import coverage diagnosis.
 * Real source data is supplied separately via authorized Badminton backup;
 * never query production Supabase from GitHub Actions.
 * No names, DBV IDs, source URLs or match rows are printed or uploaded.
 */
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {computeExternalStats} from "./external-match-stats.mjs";

const goodNumber=x=>Number.isSafeInteger(x)&&x>=0?x:0;
const parsedTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const ID=/^\d{2}-\d{6}$/;

export function diagnosis(job,history,stored,valid,now=Date.now()){
 if(!job)return history?"not_started":"facts_without_queue";
 const state=String(job.status||"unknown");
 const updated=parsedTime(job.last_started_at||job.updated_at);
 const expected=goodNumber(job.verified_count);
 // verified_count counts the last source scan, not all canonical facts.
 // Cursor is a processing position, NOT the number of persisted matches.
 const scanKnown=Number.isSafeInteger(job.verified_count)&&job.verified_count>=0;
 if(state==="error")return "import_error";
 if(state==="awaiting_source")return "source_unavailable";
 if(state==="loading"&&parsedTime(job.lease_until)!==null &&
     parsedTime(job.lease_until)<now)return "expired_lease";
 if(state==="loading"&&updated!==null&&now-updated>15*60000)return "loading_delayed";
 if(state==="queued"&&updated!==null&&now-updated>3*3600000)return "queued_delayed";
 if(stored>0&&valid===0)return "no_countable_proofs";
 if(state==="partial"&&job.rejected_count>0)return "sources_excluded";
 if(state==="queued"||state==="loading")return "in_progress";
 if(scanKnown&&stored!==expected)return "batch_scope_not_comparable";
 return "not_proven_complete";
}
export const FINDING_DE={
 import_error:"Importfehler",
 source_unavailable:"Quelle nicht abrufbar",
 expired_lease:"Import-Lease abgelaufen",
 loading_delayed:"Import lädt ungewöhnlich lange",
 queued_delayed:"Auftrag ungewöhnlich lange vorgemerkt",
 batch_scope_not_comparable:"Importlauf und historischer Speicherstand haben unterschiedliche Zählbasis",
 no_countable_proofs:"Quellkarten vorhanden, aber keine zählbar",
 sources_excluded:"Import mit ausgeschlossenen Quellen",
 not_started:"Nur Historienauftrag; kein Einzelmatch-Importstatus",
 facts_without_queue:"Weder Importauftrag noch verifizierte Historienqueue",
 in_progress:"In Bearbeitung",
 not_proven_complete:"Kein aktueller Fehler erkennbar; Karrierevollständigkeit unbekannt"
};
export function makeReport(historyRows,jobRows,factRows,{now=Date.now()}={}){
 const history=new Map(historyRows.filter(x=>ID.test(x.dbv_id)).map(x=>[x.dbv_id,x]));
 const jobs=new Map(jobRows.filter(x=>ID.test(x.dbv_id)).map(x=>[x.dbv_id,x]));
 const facts=new Map();
 for(const row of factRows){
  if(!ID.test(row.dbv_id))continue;
  if(!facts.has(row.dbv_id))facts.set(row.dbv_id,[]);
  facts.get(row.dbv_id).push(row);
 }
 const ids=[...new Set([...history.keys(),...jobs.keys(),...facts.keys()])].sort();
 const items=ids.map(id=>{
  const historyStatus=history.get(id)?.status||"–";
  const job=jobs.get(id),rows=facts.get(id)||[];
  const validated=computeExternalStats(rows);
  const finding=diagnosis(job,history.has(id),rows.length,validated.total,now);
  return {dbv_id:id,history_status:historyStatus,
   import_status:job?.status||"–",source_cards:goodNumber(job?.source_count),
   eligible:goodNumber(job?.verified_count),cursor:goodNumber(job?.cursor_offset),
   stored:rows.length,countable:validated.total,excluded:validated.excluded,
   last_started:job?.last_started_at||null,last_finished:job?.last_finished_at||null,
   finding};
 });
 const grouped={};
 for(const row of items)grouped[row.finding]=(grouped[row.finding]||0)+1;
 return {timestamp:new Date(now).toISOString(),players:items.length,
  history_jobs:history.size,match_jobs:jobs.size,
  stored:factRows.length,countable:items.reduce((a,x)=>a+x.countable,0),
  excluded:items.reduce((a,x)=>a+x.excluded,0),
  grouped,items};
}
/** Only aggregate fields may leave the local audit process. */
export function publicSummary(report,limits={}){
 const truncated=["history","imports","facts"].filter(key=>limits[key]===true);
 const grouped={};
 for(const [key,count] of Object.entries(report.grouped||{})){
  if(Object.hasOwn(FINDING_DE,key)&&Number.isSafeInteger(count)&&count>=0)
   grouped[key]=count;
 }
 return {timestamp:report.timestamp,players:report.players,
  history_jobs:report.history_jobs,match_jobs:report.match_jobs,
  stored:report.stored,countable:report.countable,excluded:report.excluded,
  grouped,truncated};
}
export function printReport(report,limits={}){
 const safe=publicSummary(report,limits);
 const lines=[
  "# Badminton: anonymisierte Importabdeckung",
  "Stand (UTC): "+safe.timestamp,
  "Historienaufträge: "+safe.history_jobs+
   " | Einzelmatch-Importstatus: "+safe.match_jobs+
   " | untersuchte Profile: "+safe.players,
  "Tatsächlich gespeicherte Quellkarten: "+safe.stored+
   " | fachlich zählbare Spiele: "+safe.countable+
   " | ausgeschlossene Quellkarten: "+safe.excluded,
  "",
  "## Befunde (nur aggregierte Profilanzahlen)",
  ...Object.entries(safe.grouped).sort((a,b)=>b[1]-a[1])
   .map(([key,n])=>"- "+FINDING_DE[key]+": "+n),
  "",
  "**Grenzen:** Keine DBV-IDs, Namen, Gegner, Quellenlinks oder Einzelprofile in Logs/Artefakten.",
  "Importstatus bedeutet nicht vollständige Karrierehistorie; fehlende Belege werden nicht als null Spiele gewertet.",
  "Nur aus autorisiertem Badminton-Backup lokal eingelesene Daten; keine Netzwerkabfragen oder produktiven CI-Requests."
 ];
 if(safe.truncated.length)lines.push("**Stichprobe gekappt:** "+safe.truncated.join(", ")+
  " – Summen sind Untergrenzen; keine Vollständigkeit behaupten.");
 return lines.join("\n")+"\n";
}
/** Local-only input JSON {history:[],jobs:[],facts:[],limits?:{}}. */
export async function reportFromBackupFile(file){
 const input=JSON.parse(await readFile(file,"utf8"));
 if(!Array.isArray(input.history)||!Array.isArray(input.jobs)||!Array.isArray(input.facts))
  throw new Error("Invalid backup coverage input; expected history/jobs/facts arrays");
 return printReport(makeReport(input.history,input.jobs,input.facts),input.limits||{});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 if(process.env.CI||process.env.GITHUB_ACTIONS){
  console.error("Coverage backup processing is disabled in CI");process.exitCode=2;
 }else if(args.length===2&&args[0]==="--from-backup-json"){
  reportFromBackupFile(args[1]).then(x=>process.stdout.write(x))
   .catch(()=>{console.error("Invalid local backup coverage input");process.exitCode=1});
 }else{
  console.error("Use --from-backup-json FILE locally; --live network mode is disabled");
  process.exitCode=2;
 }
}
