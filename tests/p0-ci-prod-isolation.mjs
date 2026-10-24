/** Synthetic-only CI boundary. Keep parser/auth tests; additionally ensure
 * public GitHub Actions cannot query production Supabase or publish named data.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {requireOfflineSourceScan} from "../scripts/p0-fresh-source-scan.mjs";
import {stageFreshResults} from "../scripts/p0-stage-results-oidc.mjs";

const root=".github/workflows/";
for(const name of ["p0-fresh-scan.yml","private-dbv-directory.yml","dbv-calendar-source.yml"]){
 const workflow=await readFile(root+name,"utf8");
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(workflow,/id-token:\s*write|contents:\s*write/,
   name+": no production credentials");
 assert.doesNotMatch(workflow,/^\s*publish:\s*$/m,
   name+": no production publish job");
 assert.doesNotMatch(workflow,/(?:--stage|--publish|scripts\/publish-dbv-calendar-oidc\.py)/,
   name+": no live stage/publish path");
 assert.doesNotMatch(workflow,/https:\/\/[^\s]+\.supabase\.co/,
   name+": no live Supabase address");
}
const scanner=await readFile("scripts/p0-fresh-source-scan.mjs","utf8");
const staging=await readFile("scripts/p0-stage-results-oidc.mjs","utf8");
const edge=await readFile("supabase/functions/spvgg-match-rebuild/index.ts","utf8");
for(const [label,source] of [["P0 scanner",scanner],["OIDC client",staging],["Edge",edge]]){
 assert.doesNotMatch(source,/\b\d{2}-\d{6}\b/,label+": no player IDs");
 assert.doesNotMatch(source,/https:\/\/[^\s]+\.supabase\.co/,label+": no live API");
}
assert.equal(requireOfflineSourceScan().status,"disabled");
assert.throws(()=>requireOfflineSourceScan(["--stage"]),/disabled/);
assert.throws(()=>requireOfflineSourceScan(["--source-fallback"]),/disabled/);
await assert.rejects(stageFreshResults([{id:"synthetic"}],{sources_ok:1}),/disabled/);
assert.match(edge,/status:410/);
assert.match(edge,/reconciliation_disabled/);
assert.match(await readFile(root+"private-dbv-directory.yml","utf8"),
 /python -m unittest discover/);
assert.match(await readFile(root+"dbv-calendar-source.yml","utf8"),
 /python3 -m unittest discover/);
console.log("P0: three CI source workflows are synthetic and write-disabled.");
