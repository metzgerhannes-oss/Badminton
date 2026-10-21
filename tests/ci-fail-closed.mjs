import assert from "node:assert/strict";
import {readFileSync, mkdtempSync, rmSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import {join} from "node:path";

// Regression against a falsely green CI: a failed test MUST abort the job,
// even when a later command would succeed. No remote services are called.
const workflow=readFileSync(".github/workflows/tests.yml","utf8");
const section=workflow.match(/\n      - name: Run tests\n        run: \|\n([\s\S]*?)(?=\n      - name: Upload failing test output)/);
assert.ok(section,"Could not locate the unit-test workflow step");
const run=section[1].replace(/^          /gm,"");
assert.match(run,/^set -euo pipefail\n/,"Outer shell must fail on errors");
assert.match(run,/trap .* ERR\n/,"Failure must emit test-output.log tail");
assert.doesNotMatch(run,/\) > test-output\.log 2>&1\s*\|\|/,"Conditional OR disables Bash errexit for the test subshell");
const start=run.indexOf("(\nset -euo pipefail\n");
const end=run.indexOf("\n) > test-output.log 2>&1",start);
assert.ok(start>=0&&end>start,"Missing fail-closed unit-test group");
// Inject a known failure followed by a success into the very same bash wrapper,
// then verify the wrapper still returns failure (the previous bug returned 0).
const probe=run.slice(0,start)+"(\nset -euo pipefail\nfalse\ntrue"+run.slice(end);
const dir=mkdtempSync(join(tmpdir(),"schmetterlinge-ci-gate-"));
try{
 const result=spawnSync("bash",["-c",probe],{cwd:dir,encoding:"utf8",timeout:3000});
 assert.equal(result.error,undefined,"Could not run isolated bash failure probe");
 assert.notEqual(result.status,0,"A failing unit test was incorrectly reported as success");
}finally{rmSync(dir,{recursive:true,force:true})}
console.log("CI failure propagation: deliberately failing test aborts the suite.");
