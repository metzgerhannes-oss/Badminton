/**
 * Read-only, offline-only reconciliation of old match staging and pre-reimport
 * backup against the retained canonical dataset. No database/network calls.
 * Source URLs are tournament-level links, never proof that two matches coincide.
 * Never auto-merge, delete, rewrite source keys or create sports results.
 */
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const validId=id=>typeof id==="string" && /^\d{2}-\d{6}$/.test(id);
const fields=["source_name","source_kind","category","competition_id",
 "event","match_date","discipline","round_label","player_side","winning_side",
 "opponent_names","partner_names","games","outcome_evidence"];
const equal=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
const shape=row=>row&&typeof row==="object"&&
 row.payload&&typeof row.payload==="object"&&!Array.isArray(row.payload)
 ?{...row.payload,dbv_id:row.dbv_id,source_key:row.source_key}:row;
const safeRows=rows=>Array.isArray(rows)?rows.filter(r=>r&&typeof r==="object"&&validId(r.dbv_id)):[];

function proofMatches(a,b){
 if(!validId(a?.dbv_id)||a.dbv_id!==b?.dbv_id)return false;
 if(!a.match_date||!a.competition_id||!a.discipline||
    !Array.isArray(a.opponent_names)||a.opponent_names.length===0)return false;
 if(!(Array.isArray(a.games)&&a.games.length>0) && !a.outcome_evidence)return false;
 return fields.every(f=>equal(a[f],b[f]));
}
function partialOverlap(a,b){
 // Only a review hint. Opponents and results can recur.
 if(!validId(a?.dbv_id)||a.dbv_id!==b?.dbv_id)return false;
 if(!a.match_date||!a.discipline||!Array.isArray(a.opponent_names)||
   a.opponent_names.length===0||!Array.isArray(a.games)||a.games.length===0)return false;
 return ["match_date","discipline","opponent_names","games"]
   .every(f=>equal(a[f],b[f]));
}
function groups(rows){
 const index=new Map();
 for(const original of safeRows(rows)){
  const r=shape(original);
  if(!index.has(r.dbv_id))index.set(r.dbv_id,[]);
  index.get(r.dbv_id).push(r);
 }
 return index;
}
export function classifyRow(original,currentById,quarantineById){
 const row=shape(original);
 if(!validId(row?.dbv_id)||!row?.source_key)return "invalid_identity";
 const current=currentById.get(row.dbv_id)||[];
 if(current.some(c=>c.source_key===row.source_key)){
  // A reused ID with conflicting contents must not count as a clean match.
  return current.some(c=>c.source_key===row.source_key&&proofMatches(row,c))
   ?"canonical_same_key":"conflicting_same_key";
 }
 if((quarantineById.get(row.dbv_id)||[]).some(q=>q.source_key===row.source_key))
  return "already_quarantined";
 const strict=current.filter(c=>proofMatches(row,c));
 if(strict.length===1)return "strict_rekey_candidate";
 if(strict.length>1)return "ambiguous_rekey_candidate";
 if(current.some(c=>partialOverlap(row,c)))return "partial_overlap_review";
 return "unresolved";
}
export function summarizeMatchReconciliation({stage=[],backup=[],current=[],quarantine=[]}={}){
 for(const [name,list] of Object.entries({stage,backup,current,quarantine})){
  if(!Array.isArray(list)||list.length>50000)
   throw Error("Invalid or oversized local dataset: "+name);
 }
 const byId=groups(current),quarantineById=groups(quarantine);
 const result={stage:{},backup:{},years:{stage:{},backup:{}},
  totals:{stage:stage.length,backup:backup.length,current:current.length,quarantine:quarantine.length}};
 for(const origin of ["stage","backup"]){
  for(const original of origin==="stage"?stage:backup){
   const status=classifyRow(original,byId,quarantineById);
   result[origin][status]=(result[origin][status]||0)+1;
   const row=shape(original);
   const year=Number(row?.match_year||String(row?.match_date||"").slice(0,4));
   const label=Number.isInteger(year)&&year>=1900&&year<=2100?String(year):"unknown";
   const bucket=result.years[origin][label]||(result.years[origin][label]={});
   bucket[status]=(bucket[status]||0)+1;
  }
 }
 return result;
}
export function renderAggregateReport(report){
 // Report receives aggregate-only input and never prints names, IDs or links.
 const headings={canonical_same_key:"Identischer aktueller Schlüssel und Beleg",
  conflicting_same_key:"Gleicher Schlüssel, widersprüchlicher Inhalt",
  already_quarantined:"Bereits in Quarantäne",
  strict_rekey_candidate:"Fachlich identisch, anderer Schlüssel – prüfen",
  ambiguous_rekey_candidate:"Mehrere identische Kandidaten – prüfen",
  partial_overlap_review:"Teilübereinstimmung – Quelle prüfen",
  unresolved:"Kein belegbarer Matchabgleich – Quelle prüfen",
  invalid_identity:"Ungültige Quellenidentität"};
 const lines=["# Match-Reconciliation – anonymisiertes Offline-Audit",
  "Alle Vergleiche sind nur Vorschläge: Es erfolgen KEINE Schreib-, Lösch- oder Importvorgänge.",
  "Identische Turnier-URLs alleine begründen ausdrücklich keine Übereinstimmung."];
 for(const origin of ["stage","backup"]){
  lines.push("",origin==="stage"?"## Staging":"## Historisches Backup",
   "Geprüfte Zeilen: "+report.totals[origin]);
  for(const [status,n] of Object.entries(report[origin]))
   lines.push("- "+(headings[status]||"Unbekannter Status")+": "+n);
  lines.push("Jahresverteilung: "+
   Object.entries(report.years[origin]).sort(([a],[b])=>a.localeCompare(b))
    .map(([y,counts])=>y+"="+Object.values(counts).reduce((a,b)=>a+b,0)).join(", "));
 }
 return lines.join("\n")+"\n";
}
export async function fromLocalBackup(path){
 const input=JSON.parse(await readFile(path,"utf8"));
 return renderAggregateReport(summarizeMatchReconciliation(input));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.env.CI||process.env.GITHUB_ACTIONS){
  console.error("Private reconciliation is disabled in CI");process.exitCode=2;
 }else if(process.argv.length===4&&process.argv[2]==="--from-backup-json"){
  fromLocalBackup(process.argv[3]).then(r=>process.stdout.write(r)).catch(()=>{
   console.error("Invalid local private reconciliation input");process.exitCode=1;
  });
 }else{
  console.error("Use --from-backup-json FILE locally; production network is disabled");
  process.exitCode=2;
 }
}
