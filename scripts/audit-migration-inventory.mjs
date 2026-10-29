/** Offline migration-coverage inventory; never contacts or mutates Supabase.
 * Snapshot contains only application migration names/versions, not player data.
 * A filename match is NOT proof of identical SQL or successful replay.
 */
import {readFile,readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

export function auditMigrationInventory(registered,localFiles){
 if(!Array.isArray(registered)||!Array.isArray(localFiles))
  throw Error("invalid_migration_inventory");
 const versions=new Map();
 for(const entry of registered){
  if(!entry||typeof entry.version!=="string"||
     !/^\d{14}$/.test(entry.version)||typeof entry.name!=="string"||
     !/^[a-z0-9_]+$/i.test(entry.name)||versions.has(entry.version))
   throw Error("invalid_or_duplicate_registered_migration");
  versions.set(entry.version,entry.name);
 }
 const files=new Set(),exactVersions=[],timestampOnly=[],nameOnly=[],unmapped=[];
 for(const filename of localFiles){
  const m=/^(\d{14})_([A-Za-z0-9_]+)\.sql$/.exec(filename);
  if(!m||files.has(filename))throw Error("invalid_or_duplicate_local_migration");
  files.add(filename);
  const [_,version,name]=m;
  const byVersion=versions.get(version);
  const byName=registered.some(row=>row.name===name);
  if(byVersion===name)exactVersions.push(filename);
  else if(byVersion)timestampOnly.push({filename,registeredName:byVersion});
  else if(byName)nameOnly.push(filename);
  else unmapped.push(filename);
 }
 const referenced=new Set([...exactVersions,...timestampOnly.map(x=>x.filename)]
  .map(f=>f.slice(0,14)));
 return {registered:registered.length,localFiles:localFiles.length,
  exactVersionAndName:exactVersions.length,
  registeredTimestampOnly:timestampOnly.length,
  sourceNameOnly:nameOnly.length,unmapped:unmapped.length,
  registeredVersionsWithoutExactTimestamp:registered.length-referenced.size,
  recoveryReplayed:false,sqlHashesVerified:false,
  exactVersions,timestampOnly,nameOnly,unmapped};
}

/** Historical database/*.sql files are candidates only: names are not SQL hashes.
 * This maps exact normalized filenames to registered migration labels without
 * changing their timestamp or asserting that the executed SQL is identical.
 */
export function auditLegacySqlCandidates(registered,legacyFiles){
 if(!Array.isArray(registered)||!Array.isArray(legacyFiles))
  throw Error("invalid_legacy_inventory");
 const byName=new Map();
 for(const entry of registered){
  if(!entry||typeof entry.name!=="string"||typeof entry.version!=="string"||
   !/^\d{14}$/.test(entry.version)||!/^[A-Za-z0-9_]+$/.test(entry.name))
   throw Error("invalid_registered_legacy_candidate");
  const key=entry.name.toLowerCase().replace(/-/g,"_");
  byName.set(key,[...(byName.get(key)||[]),entry]);
 }
 const seen=new Set(), candidates=[],ambiguous=[],unmapped=[];
 for(const filename of legacyFiles){
  if(typeof filename!=="string"||!/^[A-Za-z0-9_-]+\.sql$/.test(filename)||
   seen.has(filename))throw Error("invalid_or_duplicate_legacy_file");
  seen.add(filename);
  const key=filename.slice(0,-4).toLowerCase().replace(/-/g,"_");
  const matches=byName.get(key)||[];
  if(matches.length===1)candidates.push({filename,registeredVersion:matches[0].version,
   registeredName:matches[0].name});
  else if(matches.length>1)ambiguous.push(filename);
  else unmapped.push(filename);
 }
 return {legacyFiles:legacyFiles.length,exactNameCandidates:candidates.length,
  ambiguousNameCandidates:ambiguous.length,unmappedLegacy:unmapped.length,
  candidates,ambiguous,unmapped,sqlHashesVerified:false,recoveryReplayed:false};
}

async function report(){
 const snapshot=JSON.parse(await readFile(new URL("../docs/supabase-migrations-registered-20261029.json",import.meta.url),"utf8"));
 const directory=fileURLToPath(new URL("../supabase/migrations/",import.meta.url));
 const files=(await readdir(directory)).filter(n=>n.endsWith(".sql")).sort();
 const result=auditMigrationInventory(snapshot.registered,files);
 const legacyDir=fileURLToPath(new URL("../database/",import.meta.url));
 const legacyFiles=(await readdir(legacyDir)).filter(n=>n.endsWith(".sql")).sort();
 const legacy=auditLegacySqlCandidates(snapshot.registered,legacyFiles);
 process.stdout.write(JSON.stringify({captured_on:snapshot.captured_on,...result,legacy},null,2)+"\n");
 if(!result.registered||!result.localFiles)process.exitCode=1;
}
// Direct CLI use only. Test import never reads other files or opens sockets.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await report();
