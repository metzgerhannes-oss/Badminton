#!/usr/bin/env node
/**
 * F09: fail-closed, local-only Supabase migration lineage inventory.
 * Does not run SQL, contact Supabase, or publish migration names/statements.
 * A hash match is a byte-level guard, NOT proof that a database replay worked.
 */
import {createHash} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";

const VERSIONED=/^(\d{14})_[a-zA-Z0-9_-]+\.sql$/;
const HASH=/^[a-f0-9]{64}$/;

export function auditLineage(local,applied,legacySqlCount=0,expectedAppliedCount=null){
 if(!Array.isArray(local)||!Array.isArray(applied))
  throw new Error("Expected local/applied migration arrays");
 const localMap=new Map(),appliedMap=new Map();
 let duplicates=0,invalid=0;
 for(const row of local){
  if(!/^\d{14}$/.test(row.version)||!HASH.test(row.sha256||"")){
   invalid++;continue;
  }
  if(localMap.has(row.version))duplicates++;
  else localMap.set(row.version,row.sha256);
 }
 for(const row of applied){
  // Migration input must be metadata only: never accept raw SQL in a report.
  if(Object.hasOwn(row,"statements")||Object.hasOwn(row,"sql")||
     Object.hasOwn(row,"query"))throw new Error("Raw migration SQL is prohibited");
  if(!/^\d{14}$/.test(row.version)||(
      row.sha256!==undefined && !HASH.test(row.sha256))){
   invalid++;continue;
  }
  if(appliedMap.has(row.version))duplicates++;
  else appliedMap.set(row.version,row.sha256||null);
 }
 let absentLocally=0,unverifiedSql=0,shaMismatch=0,shaMatched=0;
 for(const [version,appliedSha] of appliedMap){
  const localSha=localMap.get(version);
  if(!localSha)absentLocally++;
  else if(!appliedSha)unverifiedSql++;
  else if(appliedSha!==localSha)shaMismatch++;
  else shaMatched++;
 }
 let notApplied=0;
 for(const version of localMap.keys())if(!appliedMap.has(version))notApplied++;
 // A manifest is not evidence of completeness by itself: the expected
 // count must be independently checked against the authorized DB read-only.
 const appliedCountVerified=Number.isSafeInteger(expectedAppliedCount)&&
  expectedAppliedCount>0&&applied.length===expectedAppliedCount&&
  appliedMap.size===expectedAppliedCount;
 const lineageReady=appliedCountVerified&&localMap.size>0&&duplicates===0&&
  invalid===0&&absentLocally===0&&notApplied===0&&
  unverifiedSql===0&&shaMismatch===0;
 return {
  local_versioned_sql:localMap.size,applied_migrations:appliedMap.size,
  legacy_sql_files:legacySqlCount,applied_count_verified:appliedCountVerified,
  duplicates,invalid_entries:invalid,
  applied_without_local_file:absentLocally,local_without_applied_record:notApplied,
  hash_missing:unverifiedSql,hash_mismatch:shaMismatch,hash_verified:shaMatched,
  lineage_ready:lineageReady,
  isolated_replay_verified:false
 };
}
export async function inspectLocal(root=process.cwd()){
 const sqlDir=path.join(root,"supabase","migrations");
 const local=[];
 for(const name of await readdir(sqlDir)){
  if(!name.endsWith(".sql"))continue;
  const match=VERSIONED.exec(name);
  if(!match)throw new Error("Unversioned SQL in supabase/migrations");
  const bytes=await readFile(path.join(sqlDir,name));
  local.push({version:match[1],
   sha256:createHash("sha256").update(bytes).digest("hex")});
 }
 let legacySqlCount=0;
 const legacy=await readdir(path.join(root,"database"),{recursive:true,withFileTypes:true});
 for(const f of legacy)if(f.isFile()&&f.name.endsWith(".sql"))legacySqlCount++;
 return {local,legacySqlCount};
}
export function formatSafeReport(report){
 // Strict allowlist; never print supplied manifest text or migration names.
 const keys=["local_versioned_sql","applied_migrations","legacy_sql_files",
  "applied_count_verified","duplicates","invalid_entries","applied_without_local_file",
  "local_without_applied_record","hash_missing","hash_mismatch","hash_verified",
  "lineage_ready","isolated_replay_verified"];
 return ["F09 migration lineage (offline / counts only)",
  ...keys.map(k=>k+": "+String(report[k])),
  "No reset/replay performed; never run a production db reset."].join("\n")+"\n";
}
async function main(){
 const [command,file,flag,count,extra]=process.argv.slice(2);
 const inventory=command==="--inventory-only";
 const manifestMode=command==="--manifest";
 if(inventory){
  if(file!==undefined)throw new Error("Inventory takes no extra arguments");
 }else if(manifestMode){
  // A separately verified read-only count is required. A partial manifest
  // must never make the audit report lineage_ready=true.
  if(!file||flag!=="--expected-applied-count"||extra!==undefined||
     !/^[1-9][0-9]*$/.test(count||"")||
     !Number.isSafeInteger(Number(count)))
   throw new Error("Use --manifest PRIVATE_JSON --expected-applied-count N");
 }else throw new Error("Use --inventory-only OR --manifest PRIVATE_JSON --expected-applied-count N");
 if(manifestMode&&(process.env.CI||process.env.GITHUB_ACTIONS))
  throw new Error("Private migration manifests are forbidden in CI");
 const {local,legacySqlCount}=await inspectLocal();
 if(inventory){
  process.stdout.write(formatSafeReport(auditLineage(local,[],legacySqlCount)));
  return;
 }
 const manifest=JSON.parse(await readFile(file,"utf8"));
 if(!manifest||!Array.isArray(manifest.migrations))
  throw new Error("Expected migrations metadata array");
 const report=auditLineage(local,manifest.migrations,legacySqlCount,Number(count));
 process.stdout.write(formatSafeReport(report));
 if(!report.lineage_ready)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(()=>{console.error("F09 offline audit failed (details withheld)");process.exitCode=2;});
