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
assert.equal(result.details[0].scoring.ruleId,null,
 "Match victory is confirmed by sourced W/L and set comparisons, not an inferred scoring rule");
assert.equal(result.details[0].scoring.ruleSource,"set-results");
assert.equal(computeExternalStats([{...good,competition:"Turnier 3x21"}]).details[0].scoring.ruleId,"3x21",
 "An explicitly published scoring format may be displayed as metadata");
const one={...good,source_key:"one",games:[[21,17]],competition:"Jugendturnier"};
assert.equal(computeExternalStats([one]).total,0,"One set without a source rule is not a match");
assert.equal(computeExternalStats([{...one,competition:"Jugendturnier 1x21"}]).total,1,
 "Explicit single-game alternative must count");
const extended11={...good,source_key:"5x11",competition:"Bundesliga 5x11",
 games:[[11,9],[12,10],[15,14]]};
assert.equal(computeExternalStats([extended11]).total,1);

const history=await readFile("external-matches.js","utf8");
const home=await readFile("stats.js","utf8");
const sw=await readFile("sw.js","utf8");
assert.match(home,/computeExternalStats\(rows/);
assert.match(history,/import \{computeExternalStats,sourceMatchYears,importCompleteness\}/);
assert.match(history,/const result=computeExternalStats\(subset,\{year,discipline\}\)/);
assert.match(history,/const filtered=result\.details/);
assert.match(history,/const PAGE_LIMIT=400,MAX_ROWS=10000/);
assert.match(history,/partial=collected\.length>=MAX_ROWS/);
assert.match(history,/import \{readPublicRows\} from "\.\/scripts\/supabase-read\.mjs"/);
assert.match(home,/import \{readPublicRows\} from "\.\/scripts\/supabase-read\.mjs"/);
assert.match(history,/readPublicRows\(route,\{signal,count:false\}\)/);
assert.match(home,/readPublicRows\(path,\{signal,count:false\}\)/);
assert.doesNotMatch(history,/fetch\(API\+/);
assert.doesNotMatch(home,/fetch\(ROOT\+/);
assert.match(history,/Der Datenstand kann derzeit nicht geprüft werden/);
assert.match(history,/external-match-retry/);
assert.match(sw,/schmetterlinge-shell-v85/);
console.log("v43: Historie und Home validieren dieselben belegten Matches und Dubletten.");
