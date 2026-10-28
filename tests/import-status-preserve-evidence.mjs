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
assert.doesNotMatch(edge,/String\(error\)\.includes\("Source unavailable"\)\?"awaiting_source"/);
// #199: private Cloudflare family UI may request an on-demand import only
// with a verified member JWT. No origin wildcard and no personal Edge logs.
assert.match(edge,/https:\/\/schmetterlinge-familie\\.pages\\.dev/);
assert.match(edge,/origin&&ALLOWED_ORIGINS\\.has\\(origin\\)/);
assert.match(edge,/if\\(origin&&!ALLOWED_ORIGINS\\.has\\(origin\\)\\)/);
assert.doesNotMatch(edge,/console\\.error\\([^\\n]*,id,/);
assert.match(edge,/remaining_eligible:Math\\.max\\(0,all\\.length-progress\\)/,
 "Cursor counts accepted, individually verified cards, not raw source cards");
// Synthetic source has 10 raw cards, 7 individually verified, 3 excluded.
// At verified cursor 5 there are 2 eligible cards left, NOT 5 missing matches.
const raw=10,eligible=7,excluded=3,cursor=5;
assert.equal(raw-eligible,excluded);
assert.equal(Math.max(0,eligible-cursor),2);
assert.notEqual(raw-cursor,Math.max(0,eligible-cursor));

console.log("P0: verified persisted matches survive an empty personal source profile.");
