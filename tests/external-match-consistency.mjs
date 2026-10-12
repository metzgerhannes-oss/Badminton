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
const noScores={...good,source_key:"unverified-empty",games:[],winning_side:2};
assert.equal(computeExternalStats([noScores]).total,0,
 "No-set results without explicit proof MUST NOT be counted");
assert.equal(computeExternalStats([{...noScores,outcome_evidence:"badhub-bold-dash"}]).total,0,
 "A proof label without the checked Badhub source and kind cannot be counted");
const declaration={...noScores,source_name:"Badhub",
 source_kind:"third-party-match-card",outcome_evidence:"badhub-bold-dash",
 source_key:"tournament:4986:me-u17:finale:sarah-storz.test"};
const verified=computeExternalStats([declaration]);
assert.equal(verified.total,1);
assert.equal(verified.losses,1);
assert.deepEqual(verified.details[0].games,[]);
assert.equal(verified.details[0].scoring.ruleSource,"badhub-bold-no-scores");
assert.equal(computeExternalStats([{...declaration,source_key:"league:4986:test"}]).total,0);
assert.equal(computeExternalStats([{...declaration,category:"league"}]).total,0);
assert.equal(computeExternalStats([{...declaration,outcome_evidence:null}]).total,0);
assert.equal(computeExternalStats([{...declaration,source_url:"https://invalid.example/"}]).total,0);
assert.equal(computeExternalStats([{...declaration,games:[[21,12]]}]).total,0,
 "Unscored proof must never replace an incomplete scored match.");

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
assert.match(sw,/schmetterlinge-shell-v91/);
console.log("v43: Historie und Home validieren dieselben belegten Matches und Dubletten.");
