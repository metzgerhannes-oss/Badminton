/**
 * Live source audit intentionally disabled until operator/source rights are
 * explicitly approved (#56). GitHub Actions may only run synthetic fixtures.
 * No real player identity, URL or network request belongs in this entry point.
 */
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";

export function requireOfflineBadhubAudit() {
 throw new Error("Live Badhub source audit disabled: use synthetic parser fixtures");
}

if (process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1])) {
 try { requireOfflineBadhubAudit(); }
 catch {
  console.error("Live Badhub audit disabled; run synthetic parser tests instead.");
  process.exitCode=1;
 }
}
