import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {computeExternalStats} from "../scripts/external-match-stats.mjs";
const good={source_key:"ok",category:"tournament",discipline:"Einzel",match_year:2026,
 player_side:1,winning_side:1,opponent_names:["Test"],games:[[21,14],[21,17]],
 source_url:"https://badhub.de/bwbv/turnier.php?id=555"};
const cards=[good,{...good,source_key:"bad-score",winning_side:2},
 {...good,source_key:"bad-source",source_url:"https://wrong.invalid/1"},
 {...good,source_key:"duplicated"},{...good,source_key:"duplicated"}];
const result=computeExternalStats(cards);
const dbvCrossfed={...good,source_key:"tournament:dbv-950:md-u17:test",
 source_url:"https://badhub.de/dbv/turnier.php?id=950",match_year:2025};
assert.equal(computeExternalStats([dbvCrossfed]).total,1,
 "Public Badhub crossfed DBV tournament proof is accepted at correct URL");
assert.equal(result.total,1);assert.equal(result.wins,1);
assert.equal(result.losses,0);assert.equal(result.excluded,3);
assert.equal(computeExternalStats(cards,{year:"2025"}).total,0);
const history=await readFile("external-matches.js","utf8");
const home=await readFile("stats.js","utf8");
const sw=await readFile("sw.js","utf8");
assert.match(home,/computeExternalStats\(rows/);
assert.match(history,/import \{computeExternalStats,sourceMatchYears,importCompleteness\}/);
assert.match(history,/const result=computeExternalStats\(subset,\{year,discipline\}\)/);
assert.match(history,/const filtered=result\.details/);
assert.match(history,/const PAGE_LIMIT=400,MAX_ROWS=10000/);
assert.match(history,/partial=collected\.length>=MAX_ROWS/);
assert.match(history,/if\(!Array\.isArray\(data\)\)throw/);
assert.match(history,/Der Datenstand kann derzeit nicht geprüft werden/);
assert.match(history,/external-match-retry/);
assert.match(sw,/schmetterlinge-shell-v53/);
console.log("v43: Historie und Home validieren dieselben belegten Matches und Dubletten.");
