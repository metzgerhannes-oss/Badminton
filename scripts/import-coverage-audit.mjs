/**
 * Bounded, read-only inventory of public match-import queues and stored facts.
 * No private follows, personal names, source-site scraping, or import triggers.
 * Run: node scripts/import-coverage-audit.mjs --live
 */
import {writeFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";
import {computeExternalStats} from "./external-match-stats.mjs";

const ROOT="https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/";
const KEY="sb_publishable_WdNC1AoOLe4rqDomSVnxWw_wq64M5kE";
const LIMIT=400,MAX_STATUSES=4000,MAX_FACTS=10000;
const goodNumber=x=>Number.isSafeInteger(x)&&x>=0?x:0;
const parsedTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const utcDay=x=>x?new Date(x).toISOString().slice(0,10):"–";
const ID=/^\d{2}-\d{6}$/;
const SOURCE_FIELDS="dbv_id,source_key,category,discipline,match_year,player_side,winning_side,opponent_names,games,source_url";

async function readTable(table,select,max=MAX_STATUSES){
 const result=[];
 for(let offset=0;offset<max;offset+=LIMIT){
  const params=new URLSearchParams({select,limit:String(LIMIT),offset:String(offset)});
  const response=await fetch(ROOT+table+"?"+params,{
   cache:"no-store",
   headers:{apikey:KEY,Accept:"application/json"},
   signal:AbortSignal.timeout(18000)
  });
  if(!response.ok)throw Error(table+" public REST HTTP "+response.status);
  const batch=await response.json();
  if(!Array.isArray(batch)||batch.length>LIMIT)throw Error(table+" unexpected REST data");
  result.push(...batch);
  if(batch.length<LIMIT)return {rows:result,truncated:false};
 }
 return {rows:result,truncated:true};
}
export function diagnosis(job,history,stored,valid,now=Date.now()){
 if(!job)return history?"not_started":"facts_without_queue";
 const state=String(job.status||"unknown");
 const updated=parsedTime(job.last_started_at||job.updated_at);
 const checked=parsedTime(job.last_finished_at);
 const expected=goodNumber(job.verified_count);
 const cursor=goodNumber(job.cursor_offset);
 const gap=stored<expected;
 if(state==="error")return "import_error";
 if(state==="awaiting_source")return "source_unavailable";
 if(state==="loading"&&parsedTime(job.lease_until)!==null &&
     parsedTime(job.lease_until)<now)return "expired_lease";
 if(state==="loading"&&updated!==null&&now-updated>15*60000)return "loading_delayed";
 if(state==="queued"&&updated!==null&&now-updated>3*3600000)return "queued_delayed";
 if(gap&&cursor>=expected&&["complete","partial"].includes(state))
  return "processed_but_missing";
 if(gap&&cursor<expected&&updated!==null&&now-updated>3*3600000)
  return "batch_backlog";
 if(stored>expected&&expected>0)return "status_behind_facts";
 if(stored>0&&valid===0)return "no_countable_proofs";
 if(state==="partial"&&job.rejected_count>0)return "sources_excluded";
 if(state==="queued"||state==="loading")return "in_progress";
 if(gap)return "import_not_finished";
 return "not_proven_complete";
}
export const FINDING_DE={
 import_error:"Importfehler",
 source_unavailable:"Quelle nicht abrufbar",
 expired_lease:"Import-Lease abgelaufen",
 loading_delayed:"Import lädt ungewöhnlich lange",
 queued_delayed:"Auftrag ungewöhnlich lange vorgemerkt",
 processed_but_missing:"Verarbeitet, aber weniger Quellbelege gespeichert",
 batch_backlog:"Teilimport wartet auf Folgepaket",
 status_behind_facts:"Importstatus älter als vorhandene Belege",
 no_countable_proofs:"Quellkarten vorhanden, aber keine zählbar",
 sources_excluded:"Import mit ausgeschlossenen Quellen",
 not_started:"Nur Historienauftrag; kein Einzelmatch-Importstatus",
 facts_without_queue:"Weder Importauftrag noch verifizierte Historienqueue",
 in_progress:"In Bearbeitung",
 import_not_finished:"Teilimport noch nicht abgeschlossen",
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
export function printReport(report,limits,issues=35){
 const lines=[
  "# Badminton: tatsächliche Importabdeckung",
  "Stand (UTC): "+report.timestamp,
  "Öffentlich vorgemerkte IDs: "+report.history_jobs+
   " | Einzelmatch-Importstatus: "+report.match_jobs+
   " | untersuchte Spieler: "+report.players,
  "Tatsächlich abrufbare Quellkarten: "+report.stored+
   " | davon fachlich zählbare Spiele: "+report.countable+
   " | ausgeschlossene Quellkarten: "+report.excluded,
  "",
  "## Befunde (Anzahl Spieler)",
  ...Object.entries(report.grouped).sort((a,b)=>b[1]-a[1])
   .map(([key,n])=>"- "+(FINDING_DE[key]||key)+": "+n),
  "",
  "## Priorisierte Prüfungen",
  "| Öffentliche DBV-ID | Importstatus | verarbeitet | importierbar | gespeichert | zählbar | Befund |",
  "|---|---|---:|---:|---:|---:|---|"
 ];
 const priority=["processed_but_missing","expired_lease","import_error","source_unavailable",
  "batch_backlog","not_started","loading_delayed","queued_delayed",
  "no_countable_proofs","status_behind_facts","sources_excluded","import_not_finished",
  "in_progress","not_proven_complete","facts_without_queue"];
 const sorted=[...report.items].sort((a,b)=>
  priority.indexOf(a.finding)-priority.indexOf(b.finding)||a.dbv_id.localeCompare(b.dbv_id));
 for(const x of sorted.slice(0,issues)){
  lines.push("| "+x.dbv_id+" | "+x.import_status+" | "+x.cursor+
    " | "+x.eligible+" | "+x.stored+" | "+x.countable+" | "+
    (FINDING_DE[x.finding]||x.finding)+" |");
 }
 if(sorted.length>issues)lines.push("Weitere "+(sorted.length-issues)+" Profile nicht einzeln gezeigt.");
 const truncated=Object.entries(limits).filter(([,v])=>v).map(([name])=>name);
 lines.push("","**Grenzen:** Nur öffentlich registrierte DBV-IDs, keine lokalen Follow-Listen anderer Geräte.",
  "Der Importstatus misst Verarbeitung, nicht Vollständigkeit aller historischen Spiele.",
  "Diese Prüfung greift nur lesend auf unsere bestehenden Supabase-Ansichten zu. "+
  "Sie ruft weder Badhub/DBV noch die Edge-Importfunktion auf.");
 if(truncated.length)lines.push("**Stichprobe gekappt:** "+truncated.join(", ")+
  " – Summen sind Untergrenzen; Einzelstatus nicht als vollständig bewerten.");
 return lines.join("\n")+"\n";
}
async function main(){
 const [h,j,f]=await Promise.all([
  readTable("player_history_imports","dbv_id,status,requested_at,last_checked_at,updated_at"),
  readTable("player_external_match_imports",
   "dbv_id,status,cursor_offset,verified_count,rejected_count,source_count,last_started_at,last_finished_at,lease_until,updated_at"),
  readTable("player_external_match_facts",SOURCE_FIELDS,MAX_FACTS)
 ]);
 const report=makeReport(h.rows,j.rows,f.rows);
 const md=printReport(report,{history:h.truncated,imports:j.truncated,facts:f.truncated});
 console.log(md);
 if(process.env.GITHUB_STEP_SUMMARY)await writeFile(process.env.GITHUB_STEP_SUMMARY,md,{flag:"a"});
 if(process.env.AUDIT_OUTPUT)await writeFile(process.env.AUDIT_OUTPUT,
  JSON.stringify({report,limits:{history:h.truncated,imports:j.truncated,facts:f.truncated}},null,2)+"\n");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.argv.includes("--live")){console.error("Use --live for a read-only audit");process.exitCode=2}
 else main().catch(err=>{console.error("SUPABASE_AUDIT_UNVERIFIABLE",err.message);process.exitCode=1});
}
