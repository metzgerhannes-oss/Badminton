/** Synthetic-only CI boundary. Keep parser/auth tests; additionally ensure
 * public GitHub Actions cannot query production Supabase or publish named data.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {requireOfflineSourceScan} from "../scripts/p0-fresh-source-scan.mjs";
import {stageFreshResults} from "../scripts/p0-stage-results-oidc.mjs";

const root=".github/workflows/";
for(const name of ["p0-fresh-scan.yml","private-dbv-directory.yml"]){
 const workflow=await readFile(root+name,"utf8");
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(workflow,/id-token:\s*write|contents:\s*write/,
   name+": no production credentials");
 assert.doesNotMatch(workflow,/^\s*publish:\s*$/m,
   name+": no production publish job");
 assert.doesNotMatch(workflow,/(?:--stage|--publish|run:\s*python3\s+scripts\/publish-dbv-calendar-oidc\.py)/,
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


// Remaining four source workflows: no live fetch, publish, schedule or write
// path may be reintroduced as part of test CI. These checks run on every PR.
const offlineSourceWorkflows=[
 "bw-youth-archive.yml",
 "bwbv-youth-calendar.yml",
 "team-report-import.yml",
 "badhub-source-audit.yml"
];
function assertOfflineSourceWorkflow(name,source){
 assert.match(source,/^on:\s*$/m,name+": declared test triggers");
 assert.match(source,/^\s+pull_request:\s*$/m,name+": PR test");
 assert.match(source,/^\s+push:\s*$/m,name+": Main test");
 assert.match(source,/^\s+workflow_dispatch:\s*$/m,name+": manual offline test");
 assert.match(source,/^permissions:\s*\n\s*contents:\s*read\s*$/m,name+": read-only token");
 assert.match(source,/set -euo pipefail/,name+": propagate fixture test failure");
 assert.match(source,/python3 -m unittest discover|node tests\/badhub-tournament-view-parser\.mjs/,
  name+": preserve executable synthetic parser tests");
 assert.doesNotMatch(source,/^\s*(?:schedule|publish):\s*$/m,name+": no scheduled writer/publisher");
 assert.doesNotMatch(source,/\b(?:contents|pages|id-token):\s*write\b/i,name+": no write/OIDC grants");
 assert.doesNotMatch(source,/\b(?:git\s+push|gh\s+api|curl|wget)\b|https?:\/\//i,
  name+": no remote HTTP or git publication");
 assert.doesNotMatch(source,/--write-json|--stage|--publish|GH_TOKEN|github\.token|ACTIONS_ID_TOKEN|SUPABASE_SERVICE_ROLE_KEY/,
  name+": no live publishing argument or credential");
 assert.doesNotMatch(source,/\b(?:node|python3)\s+scripts\/(?:import-|badhub-source-audit)/,
  name+": no direct live importer or source audit");
}
for(const name of offlineSourceWorkflows){
 const workflow=await readFile(root+name,"utf8");
 assertOfflineSourceWorkflow(name,workflow);
 // Mutation probes ensure the guard actually fails on the forbidden changes.
 for(const unsafe of [
  workflow.replace("contents: read","contents: write"),
  workflow+"\n  publish:\n    runs-on: ubuntu-latest\n",
  workflow+"\n  schedule:\n    - cron: '0 0 * * *'\n",
  workflow+"\n      - run: python3 scripts/import-dbv-calendar.py --write-json\n",
  workflow+"\n      - run: curl https://example.invalid/\n"
 ]){
  assert.throws(()=>assertOfflineSourceWorkflow(name,unsafe),
   {name:"AssertionError"},name+": injected production path must fail");
 }
}

// Exception only for the PUBLIC, player-free official DBV calendar. The OIDC
// writer checks GitHub repository IDs, main ref, workflow_ref and audience
// cryptographically, and only writes dbv_calendar_entries. All other source
// workflows remain offline and write-disabled by the checks above.
const calendarFlow=await readFile(root+"dbv-calendar-source.yml","utf8");
assert.match(calendarFlow,/^\s+pull_request:\s*$/m);
assert.match(calendarFlow,/^\s+push:\s*$/m);
assert.match(calendarFlow,/^\s+schedule:\s*$/m);
assert.match(calendarFlow,/^permissions:\s*\n\s*contents:\s*read\s*$/m);
assert.match(calendarFlow,/^  publish:\s*$/m);
assert.match(calendarFlow,/if:\s*github\.ref == 'refs\/heads\/main' && github\.event_name != 'pull_request'/);
assert.match(calendarFlow,/needs: verify/);
assert.match(calendarFlow,/id-token:\s*write/);
assert.match(calendarFlow,/contents:\s*write/);
assert.match(calendarFlow,/python3 scripts\/import-dbv-calendar\.py --year 2026 --write-json --export-payload/);
assert.match(calendarFlow,/python3 scripts\/publish-dbv-calendar-oidc\.py --payload/);
assert.doesNotMatch(calendarFlow,/SUPABASE_SERVICE_ROLE_KEY|secrets\./);
assert.doesNotMatch(calendarFlow,/--stage|--source-fallback/);
const mentionedUrls=[...calendarFlow.matchAll(/https?:\\/\\/[^\s"'\\`]+/g)].map(m=>m[0]);
assert.ok(mentionedUrls.every(u=>u.startsWith("https://turniere.badminton.de/")),
 "Only the public official calendar URL may appear in the diagnostic workflow");
const calendarWriter=await readFile("supabase/functions/dbv-calendar-publish/index.ts","utf8");
for(const restricted of [
 "payload.repository_id","payload.repository_owner_id","payload.workflow_ref===WORKFLOW",
 'payload.ref==="refs/heads/main"',"jwtVerify(","maxTokenAge:",
 "/rest/v1/dbv_calendar_entries"
])assert.ok(calendarWriter.includes(restricted),"DBV OIDC writer must remain scoped: "+restricted);
assert.ok(!calendarWriter.includes("user_tournament_links"));
assert.ok(!calendarWriter.includes("private_content."));
console.log("P0: only public DBV calendar OIDC sync is narrowly scoped; private source workflows remain offline.");

const auditSource=await readFile("scripts/badhub-source-audit.mjs","utf8");
assert.doesNotMatch(auditSource,/\b\d{2}-\d{6}\b|\bdbv_id\b|fetch\s*\(|https?:\/\//,
 "Badhub live-audit entry must not contain real identities or fetch calls");
assert.match(auditSource,/Live Badhub source audit disabled/);
const {requireOfflineBadhubAudit}=await import("../scripts/badhub-source-audit.mjs");
assert.throws(()=>requireOfflineBadhubAudit(),/disabled/);
const {spawnSync}=await import("node:child_process");
const disabled=spawnSync(process.execPath,["scripts/badhub-source-audit.mjs"],
 {encoding:"utf8",timeout:4000});
assert.equal(disabled.error,undefined);
assert.notEqual(disabled.status,0,"Badhub CLI must fail closed, not return false green");
assert.match(disabled.stderr,/disabled/);
console.log("P0: four private source workflows and live Badhub probe are offline-only.");
