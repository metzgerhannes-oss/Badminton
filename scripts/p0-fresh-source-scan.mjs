/** Offline-only source inventory guard.
 * The former P0 named-club scanner must not run from public GitHub Actions.
 * Use synthetic parser tests and authorized LOCAL backup-only coverage audit.
 */
import {pathToFileURL} from "node:url";
export function requireOfflineSourceScan(args=[]){
 if(args.includes("--stage")||args.includes("--source-fallback"))
  throw Error("Production source staging disabled; offline fixtures only");
 return Object.freeze({status:"disabled",reason:"external_source_rights_pending"});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{requireOfflineSourceScan(process.argv.slice(2));
  console.error("P0 network inventory disabled; run offline fixture tests instead");
  process.exitCode=2;
 }catch{console.error("P0 production staging prohibited in CI");process.exitCode=2;}
}
