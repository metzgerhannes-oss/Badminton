// Free, privacy-preserving daily DBV calendar health check (GitHub Actions only).
// Neither imports data nor calls Supabase. No user identifiers or source payload in logs.
import {readFile} from "node:fs/promises";

const EXPECTED_REPOSITORY="metzgerhannes-oss/Badminton";
const MAX_AGE_MS=72*60*60*1000;
const ALLOWED_EVENTS=new Set(["push","schedule","workflow_dispatch"]);

export function assessCalendarHealth(snapshot,runs,now=new Date()){
 const problems=[];
 const nowMs=new Date(now).getTime();
 const capturedMs=Date.parse(snapshot?.capturedAt||"");
 const entries=Array.isArray(snapshot?.entries)?snapshot.entries:[];
 if(snapshot?.source!=="https://turniere.badminton.de/"){
  problems.push("Kalender-Snapshot hat keine erwartete offizielle Quelle.");
 }
 if(!Number.isFinite(capturedMs)||capturedMs>nowMs+60*60*1000||nowMs-capturedMs>MAX_AGE_MS){
  problems.push("Öffentlicher Kalender-Snapshot ist älter als 72 Stunden oder ungültig.");
 }
 if(entries.length===0) problems.push("Öffentlicher Kalender-Snapshot ist leer.");
 const completed=(Array.isArray(runs)?runs:[])
  .filter(run=>run.head_branch==="main"&&ALLOWED_EVENTS.has(run.event)&&run.status==="completed")
  .sort((a,b)=>Date.parse(b.created_at||"")-Date.parse(a.created_at||""));
 const latest=completed[0];
 if(!latest||!Number.isFinite(Date.parse(latest.created_at||""))||
  nowMs-Date.parse(latest.created_at)>MAX_AGE_MS){
  problems.push("Kein abgeschlossener DBV-Kalender-Import auf main in den letzten 72 Stunden.");
 }else if(latest.conclusion!=="success"){
  problems.push("Der letzte abgeschlossene DBV-Kalender-Import war nicht erfolgreich.");
 }
 const byYear={};
 for(const row of entries){
  const year=String(row?.start_date||"").slice(0,4);
  if(/^20\d{2}$/.test(year))byYear[year]=(byYear[year]||0)+1;
 }
 return {problems,entryCount:entries.length,byYear,
  capturedAt:Number.isFinite(capturedMs)?new Date(capturedMs).toISOString():null,
  lastImportAt:latest?.created_at||null};
}

// A failed Pages workflow is an operational problem even when code CI passed.
// Verify the actual Build -> Deploy -> Report chain, not only the commit SHA.
// Cancelled superseded runs do not raise false alarms during rapid releases.
export function assessPagesHealth(runs,jobs=[]){
 const relevant=(Array.isArray(runs)?runs:[])
  .filter(run=>run.name==="pages build and deployment"&&run.head_branch==="main"&&
   run.status==="completed"&&!["cancelled","skipped"].includes(run.conclusion))
  .sort((a,b)=>Date.parse(b.created_at||"")-Date.parse(a.created_at||""));
 const latest=relevant[0],problems=[];
 if(!latest)problems.push("Kein abgeschlossenes GitHub-Pages-Deployment auf main gefunden.");
 else if(latest.conclusion!=="success")
  problems.push("Letztes GitHub-Pages-Deployment auf main fehlgeschlagen.");
 else{
  const completed=new Map((Array.isArray(jobs)?jobs:[]).map(job=>[job.name,job]));
  for(const name of ["build","deploy","report-build-status"]){
   const job=completed.get(name);
   if(!job||job.status!=="completed"||job.conclusion!=="success")
    problems.push("Pages-Teilprüfung "+name+" nicht erfolgreich abgeschlossen.");
  }
 }
 return {problems,runId:latest?.id||null,commit:latest?.head_sha||null};
}

async function fetchGitHubJson(path,token){
 const res=await fetch("https://api.github.com/repos/"+EXPECTED_REPOSITORY+path,{
  headers:{"Accept":"application/vnd.github+json",
   "Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28"},
  signal:AbortSignal.timeout(10000)
 });
 if(!res.ok)throw Error("GitHub Betriebsprüfung HTTP "+res.status+" auf "+path.split("?")[0]);
 return res.json();
}

async function main(){
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
 if(repo!==EXPECTED_REPOSITORY||!token)throw Error("GitHub runtime credentials or repository missing");
 const snapshot=JSON.parse(await readFile(new URL("../data/dbv-calendar.json",import.meta.url),"utf8"));
 const [data,pages]=await Promise.all([
  fetchGitHubJson("/actions/workflows/dbv-calendar-source.yml/runs?branch=main&per_page=15",token),
  fetchGitHubJson("/actions/runs?branch=main&per_page=100",token)
 ]);
 const result=assessCalendarHealth(snapshot,data.workflow_runs,new Date());
 const pagesRuns=Array.isArray(pages.workflow_runs)?pages.workflow_runs:[];
 const recent=pagesRuns.filter(run=>run.name==="pages build and deployment"&&
  run.head_branch==="main"&&run.status==="completed"&&
  !["cancelled","skipped"].includes(run.conclusion))
  .sort((a,b)=>Date.parse(b.created_at||"")-Date.parse(a.created_at||""))[0];
 const details=recent?.conclusion==="success"?
  await fetchGitHubJson("/actions/runs/"+recent.id+"/jobs?per_page=30",token):{jobs:[]};
 const deployed=assessPagesHealth(pagesRuns,details.jobs);
 console.log("DBV calendar health: "+result.entryCount+" published entries; years "+
  JSON.stringify(result.byYear)+"; captured "+result.capturedAt+
  "; last import "+result.lastImportAt);
 if(result.problems.length||deployed.problems.length){
  for(const problem of result.problems)console.error("DBV calendar health alert: "+problem);
  for(const problem of deployed.problems)console.error("Pages deployment health alert: "+problem);
  process.exitCode=1;
 }else console.log("DBV calendar and GitHub Pages deployment health: OK");
 console.log("Latest verified Pages run: "+(deployed.runId||"none"));
}

if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 main().catch(error=>{console.error("DBV calendar monitoring unavailable: "+error.message);process.exitCode=1});
}
