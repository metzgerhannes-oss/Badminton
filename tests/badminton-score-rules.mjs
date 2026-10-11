import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {completedMatchWinner,explicitScoringRule,MATCH_RULES} from "../scripts/badminton-score-rules.mjs";
const check=(scores,rule,side=1)=>{
 const result=completedMatchWinner(scores,{rule});
 assert.equal(result?.winningSide,side,JSON.stringify({scores,rule}));
 assert.equal(result?.ruleId,rule);
 assert.equal(result?.ruleSource,rule?"explicit":"set-results");
};
for(const rule of Object.keys(MATCH_RULES))assert.ok(MATCH_RULES[rule].label);
for(const scores of [
 [[21,19],[22,20]],[[21,20],[21,13]],[[30,28],[30,29]],
 [[15,14],[15,9]],[[11,10],[11,4]],[[10,11],[11,7],[11,10]],
 [[21,10],[12,10]],[[9,11],[11,8],[11,9]]
])check(scores,null,1);
check([[13,15],[15,8],[15,14]],"3x15",1);
check([[15,14],[15,8]],"legacy3x15");
check([[11,8],[12,10]],"youth3x11");
check([[30,29]],"1x21");
check([[11,10],[11,8],[11,7]],"5x11");
check([[12,10],[13,11],[9,11],[15,13]],"5x11");
check([[11,8],[8,11],[11,8],[9,11],[15,14]],"5x11");
check([[11,10],[11,8],[11,7]],null);
check([[11,10],[8,11],[11,7],[8,11],[11,7]],null);
assert.equal(completedMatchWinner([[11,8],[8,11],[11,9]],{rule:"5x11"}),null,
 "Two game wins in 5x11 are not a completed match");
assert.equal(completedMatchWinner([[21,14]]),null,
 "Do not infer 1-set matches without a declared rule");
for(const [scores,rule] of [
 [[],null], [[[10,10],[11,8]],null], [[[21,9],[21,9],[21,9]],null],
 [[[21,8],[21,4],[8,21]],"3x21"],
 [[[11,7],[11,8],[11,9],[8,11]],null],
 [[[21,10],[21,11],[21,9]],"3x21"],
 [[[11,7],[11,8],[11,9],[8,11]],"5x11"],
 [[[21,-1],[21,4]],null],
 [[[21,21],[21,4]],null],
 [[[21,10],[21,11]],"unknown"]
])assert.equal(completedMatchWinner(scores,{rule}),null,"Invalid or contradictory "+JSON.stringify(scores));
for(const [s,rule] of [["3×15","3x15"],["5x11","5x11"],["1 x 21","1x21"],["3×21","3x21"]])
 assert.equal(explicitScoringRule("Wertung "+s),rule);
assert.equal(explicitScoringRule("U11 2026"),null);
assert.equal(explicitScoringRule("3x15 und 3x21"),null);
const [local,edge,ui]=await Promise.all([
 "scripts/badhub-history-parser.mjs",
 "supabase/functions/history-match-import/badhub-history-parser.mjs",
 "scripts/external-match-stats.mjs"].map(p=>readFile(p,"utf8")));
assert.equal(local,edge);
assert.match(local,/completion.winningSide!==winningSide/);
assert.match(ui,/completion.winningSide!==r.winning_side/);
console.log("Reported set winners and official source W/L reconciled; format is non-blocking.");
