/** S-01 #326: offline validation of an operator-provided PRIVATE SQL history.
 * Never requests Supabase, executes SQL, writes SQL, or prints statement text.
 * The input JSON MUST remain outside this public repository and CI artifacts.
 */
import {readFile,realpath,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";

const versionPattern=/^\d{14}$/;
const namePattern=/^[A-Za-z0-9_]+$/;
const hashPattern=/^[a-f0-9]{64}$/;

/** The private bundle format is {migrations:[{version,name,sql}]}.
 * Exact SQL text must come from the stored migration history, not a
 * reconstructed or normalized copy. Version order is significant.
 */
export function verifyPrivateMigrationBundle(manifest,bundle){
 if(!manifest||!Array.isArray(manifest.registered)||
    !bundle||!Array.isArray(bundle.migrations)||
    bundle.migrations.length!==manifest.registered.length||
    !manifest.registered.length)
  throw Error("private_migration_bundle_incomplete");
 const seen=new Set();
 let bytes=0;
 for(let i=0;i<manifest.registered.length;i++){
  const expected=manifest.registered[i],actual=bundle.migrations[i];
  if(!expected||!actual||!versionPattern.test(expected.version)||
     !namePattern.test(expected.name)||!hashPattern.test(expected.statement_sha256)||
     !Number.isSafeInteger(expected.statement_bytes)||expected.statement_bytes<1||
     expected.statement_count!==1||!versionPattern.test(actual.version)||
     !namePattern.test(actual.name)||typeof actual.sql!=="string"||
     seen.has(actual.version)||actual.version!==expected.version||
     actual.name!==expected.name)
   throw Error("private_migration_bundle_identity_mismatch");
  seen.add(actual.version);
  const byteCount=Buffer.byteLength(actual.sql,"utf8");
  if(byteCount!==expected.statement_bytes||
     createHash("sha256").update(actual.sql,"utf8").digest("hex")!==expected.statement_sha256)
   throw Error("private_migration_bundle_content_mismatch");
  bytes+=byteCount;
 }
 return {verifiedMigrations:seen.size,verifiedSqlBytes:bytes,
  exactStoredSql:true,recoveryReplayed:false};
}

async function main(){
 if(process.argv.length!==3)throw Error("private_bundle_path_required");
 // Prevent accidental inclusion of private SQL in a checkout, even through symlinks.
 const repoRoot=await realpath(fileURLToPath(new URL("../",import.meta.url)));
 const bundlePath=await realpath(resolve(process.argv[2]));
 if(bundlePath===repoRoot||bundlePath.startsWith(repoRoot+sep))
  throw Error("private_bundle_must_be_outside_repository");
 if(!(await stat(bundlePath)).isFile())throw Error("private_bundle_not_a_file");
 const manifest=JSON.parse(await readFile(new URL("../docs/supabase-migrations-registered-20261029.json",import.meta.url),"utf8"));
 const bundle=JSON.parse(await readFile(bundlePath,"utf8"));
 process.stdout.write(JSON.stringify(verifyPrivateMigrationBundle(manifest,bundle))+"\n");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main()}catch(error){
  // Deliberately do not print filenames, SQL, or JSON parser excerpts.
  process.stderr.write("Private migration validation failed: "+
   (/^private_/.test(error?.message||"")?error.message:"invalid_private_bundle")+"\n");
  process.exitCode=1;
 }
}
