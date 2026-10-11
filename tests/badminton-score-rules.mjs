import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {completedMatchWinner,explicitScoringRule,MATCH_RULES} from "../scripts/badminton-score-rules.mjs";
const ok=(games,rule,side=1)=>{
 const result=completedMatchWinner(games,{rule});
 assert.equal(result?.winningSide,side,JSON.stringify({games,rule}));
 assert.equal(result?.ruleId,rule);
 assert.equal(result?.ruleSource,"explicit");
};
for(const rule of Object.keys(MATCH_RULES))assert.ok(MATCH_RULES[rule].label);
ok([[21,19],[22,20]],"3x21");
ok([[29,27],[30,28]],"3x21");
ok([[29,27],[30,29]],"3x21");
ok([[19,21],[21,17],[25,23]],"3x21");
ok([[15,13],[16,14]],"3x15");
ok([[21,19],[21,20]],"3x15");
ok([[15,13],[13,15],[21,20]],"3x15");
ok([[11,9],[12,10],[15,14]],"5x11");
ok([[12,10],[13,11],[14,12],[15,13]],"5x11");
ok([[11,8],[8,11],[11,8],[9,11],[15,14]],"5x11");
ok([[11,8],[12,10]],"youth3x11");
ok([[15,14],[15,8]],"legacy3x15");
ok([[30,29]],"1x21");
assert.equal(completedMatchWinner([[21,14]]),null,"1x21 needs explicit tournament proof");
assert.equal(completedMatchWinner([[21,14]],{rule:"1x21"})?.ruleId,"1x21");
for(const [rule,games] of [
 ["5x11",[[11,10],[11,8],[11,7]]],
 ["5x11",[[12,11],[11,8],[11,7]]],
 ["5x11",[[15,12],[11,8],[11,7]]],
 ["5x11",[[11,7],[11,8],[11,9],[8,11]]],
 ["3x21",[[21,20],[21,13]]],
 ["3x21",[[30,27],[21,10]]],
 ["3x15",[[15,14],[15,9]]],
 ["3x15",[[21,18],[15,5]]],
 ["3x15",[[15,10],[15,11],[10,15]]],
 ["1x21",[[21,14],[21,9]]],
 ["youth3x11",[[11,10],[11,7]]],
 ["5x11",[[15,14],[15,13]]]
])assert.equal(completedMatchWinner(games,{rule}),null,rule+" invalid "+JSON.stringify(games));
assert.equal(completedMatchWinner([[15,14],[15,8]]),null,
 "A historical non-deuce rule must not be inferred from raw scores alone");
for(const [label,id] of [["3×15","3x15"],["5x11","5x11"],["1 x 21","1x21"],["3×21","3x21"]])
 assert.equal(explicitScoringRule("Wertung "+label),id);
assert.equal(explicitScoringRule("U11 2026 null"),null,"Age class is not a scoring format");
assert.equal(explicitScoringRule("3x15 und 3x21"),null,"Conflicting rules are not assumed");
const paths=["scripts/badhub-history-parser.mjs","supabase/functions/history-match-import/badhub-history-parser.mjs"];
const [local,edge,ui]=await Promise.all([...paths,"scripts/external-match-stats.mjs"].map(p=>readFile(p,"utf8")));
assert.equal(local,edge,"Browser and Edge must use exact matching parser");
assert.match(local,/completedMatchWinner/);
assert.match(ui,/completedMatchWinner/);
console.log("DBV 3x21, 3x15, 5x11/deuce and explicit 1x21 verified.");
