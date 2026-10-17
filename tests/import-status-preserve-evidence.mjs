import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {missingSourceStatus} from "../supabase/functions/history-match-import/source-availability.mjs";

assert.equal(missingSourceStatus(true),"partial","Stored sourced match facts are never awaiting source");
assert.equal(missingSourceStatus(false),"awaiting_source","Truly empty accounts remain awaiting original sources");
assert.equal(missingSourceStatus(undefined),"awaiting_source","Unknown proof is never silently promoted");

const edge=await readFile("supabase/functions/history-match-import/index.ts","utf8");
assert.match(edge,/async function hasStoredMatchFact\(id:string\)/);
assert.match(edge,/player_external_match_facts\?select=source_key&dbv_id=eq\./,
 "Query one actual individually evidenced match, never infer history from a ranking or counter");
assert.match(edge,/encodeURIComponent\(id\)/);
assert.match(edge,/status:missingSourceStatus\(saved\)/);
assert.match(edge,/await updateNoNewSource\(id,/);
assert.doesNotMatch(edge,/await update\(id,\{status:"awaiting_source"/,
 "No unconditional downgrade to awaiting_source when existing match facts are stored");
assert.match(edge,/source_temporarily_unavailable/);
assert.match(edge,/no_source_matches/);
console.log("P0: verified persisted matches survive an empty personal source profile.");
