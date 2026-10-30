/** P1 #326: local-only replay of a VERIFIED private SQL-history bundle.
 * No network APIs, production DB credentials, public SQL files or CI replay.
 * Operator must provide a disposable localhost PostgreSQL database and marker.
 */
import {readFile,realpath,stat} from "node:fs/promises";
import {spawn} from "node:child_process";
import {resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {verifyPrivateMigrationBundle} from "./verify-private-migration-bundle.mjs";

const repoRootUrl=new URL("../",import.meta.url);
const marker="schmetterlinge_recovery_marker";
const databasePattern=/^schmetterlinge_recovery_[a-z0-9_]{1,48}$/;
export function validateReplayTarget(database,port){
 if(typeof database!=="string"||!databasePattern.test(database))
  throw Error("replay_target_must_be_disposable_local_database");
 if(!Number.isInteger(port)||port<1||port>65535)
  throw Error("replay_invalid_local_port");
 return {host:"127.0.0.1",database,port};
}
export function composeVerifiedReplaySql(bundle){
 if(!bundle||!Array.isArray(bundle.migrations)||bundle.migrations.length===0)
  throw Error("replay_missing_verified_migrations");
 // Input is already byte-verified by verifyPrivateMigrationBundle().
 // A separate newline + semicolon prevents adjacent statements from joining.
 return bundle.migrations.map(row=>{
  if(typeof row.sql!=="string"||!row.sql.trim())
   throw Error("replay_invalid_statement");
  if(/^\s*\\/m.test(row.sql))
   throw Error("replay_psql_meta_command_forbidden");
  return row.sql+"\n;\n";
 }).join("\n");
}
export function parseLocalPreflight(stdout,target){
 const fields=String(stdout).trim().split("|");
 if(fields.length!==3||fields[0]!==target.database||
    !["127.0.0.1","::1"].includes(fields[1])||
    fields[2]!==marker)
  throw Error("replay_target_marker_or_host_mismatch");
 return true;
}
function psql(args,input){
 return new Promise((resolveResult,reject)=>{
  const env={...process.env};
// libpq PGHOSTADDR/PGSERVICE can redirect even when -h is specified.
// Keep only credentials needed for the explicitly local connection.
for(const key of Object.keys(env))
 if(key.startsWith("PG")&&!["PGUSER","PGPASSWORD","PGPASSFILE"].includes(key))
  delete env[key];
env.PGHOSTADDR="127.0.0.1";
const child=spawn("psql",args,{stdio:["pipe","pipe","pipe"],env});
  let stdout="";
  child.stdout.on("data",data=>{if(stdout.length<4096)stdout+=data.toString().slice(0,4096-stdout.length);});
  // SQL and connection diagnostics are intentionally NEVER exposed.
  child.stderr.on("data",()=>{});
  child.on("error",()=>reject(Error("replay_psql_unavailable")));
  child.on("close",code=>code===0?resolveResult(stdout):
   reject(Error("replay_psql_failed")));
  child.stdin.on("error",()=>{});
  child.stdin.end(input);
 });
}
async function loadBundle(path){
 const repoRoot=await realpath(fileURLToPath(repoRootUrl));
 const fullPath=await realpath(resolve(path));
 if(fullPath===repoRoot||fullPath.startsWith(repoRoot+sep))
  throw Error("replay_private_bundle_must_be_outside_repository");
 if(!(await stat(fullPath)).isFile())throw Error("replay_private_bundle_not_file");
 const manifest=JSON.parse(await readFile(new URL("../docs/supabase-migrations-registered-20261029.json",import.meta.url),"utf8"));
 const bundle=JSON.parse(await readFile(fullPath,"utf8"));
 const verified=verifyPrivateMigrationBundle(manifest,bundle);
 return {bundle,verified};
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length<1||args.length>4||!args[0]||args[0].startsWith("--"))
  throw Error("replay_usage_private_bundle_path_required");
 const execute=args.includes("--execute");
 if(args.some(a=>a.startsWith("--")&&!["--execute"].includes(a)&&
    !a.startsWith("--database=")&&!a.startsWith("--port=")))
  throw Error("replay_unknown_option");
 const {bundle,verified}=await loadBundle(args[0]);
 // Dry-run validates the complete private history and does not connect anywhere.
 if(!execute){
  process.stdout.write(JSON.stringify({...verified,localReplaySucceeded:false,
   schemaAndAccessVerified:false})+"\n");
  return;
 }
 const dbArg=args.find(a=>a.startsWith("--database="));
 const portArg=args.find(a=>a.startsWith("--port="));
 if(!dbArg||!portArg)throw Error("replay_explicit_target_required");
 const target=validateReplayTarget(dbArg.slice(11),Number(portArg.slice(7)));
 const common=["-X","-q","-v","ON_ERROR_STOP=1","-h",target.host,
  "-p",String(target.port),"-d",target.database];
 const preflight=await psql([...common,"-t","-A","-c",
  "SELECT current_database(),inet_server_addr()::text,to_regclass('public."+marker+"')::text"],"");
 parseLocalPreflight(preflight,target);
 // One transaction; failure must abort rather than skip migrations.
 await psql([...common,"--single-transaction","-f","-"],composeVerifiedReplaySql(bundle));
 process.stdout.write(JSON.stringify({...verified,localReplaySucceeded:true,
  schemaAndAccessVerified:false})+"\n");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}catch(error){
  const reason=/^replay_/.test(error?.message||"")?error.message:"replay_failed_closed";
  process.stderr.write("Private local replay refused/failed: "+reason+"\n");
  process.exitCode=1;
 }
}
