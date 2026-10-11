import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {completedMatchWinner} from "../scripts/badminton-score-rules.mjs";
const valid=[
 {score:[[21,19],[22,20]],side:1,format:21},
 {score:[[11,9],[11,7]],side:1,format:11},
 {score:[[9,11],[11,9],[11,8]],side:1,format:11},
 {score:[[15,10],[15,14]],side:1,format:15},
 {score:[[13,15],[15,11],[15,13]],side:1,format:15},
 {score:[[18,21],[21,17],[25,23]],side:1,format:21}
];
for(const {score,side,format} of valid){
 const proof=completedMatchWinner(score);
 assert.ok(proof,"evidenced, completed badminton match should count");
 assert.equal(proof.winningSide,side);
 assert.equal(proof.format,format);
}
// International and DBV 3x15: two-point lead after 14:14, capped at 21.
for(const [games,side] of [
 [[[15,13],[15,11]],1],
 [[[16,14],[17,15]],1],
 [[[21,20],[15,7]],1],
 [[[15,7],[18,20],[21,20]],1],
 [[[15,8],[14,16],[15,11]],1]
]){
 const proof=completedMatchWinner(games,{year:2027});
 assert.equal(proof?.format,15);
 assert.equal(proof?.winningSide,side);
}
assert.equal(completedMatchWinner([[15,14],[15,12]],{year:2027}),null,
 "At 14 all the new scoring requires two-point lead until 20 all");
assert.equal(completedMatchWinner([[15,14],[15,12]],{year:2025})?.format,15,
 "Historical tournament formats must not be retroactively rejected");
assert.equal(completedMatchWinner([[16,15],[15,7]],{year:2027}),null,
 "16:15 is not a finished game");
assert.equal(completedMatchWinner([[20,19],[15,11]],{year:2027}),null,
 "20:19 is not a finished game");
assert.equal(completedMatchWinner([[21,19],[21,13]],{year:2027})?.format,21,
 "Legacy 21-point matches remain possible in leagues after the rule transition");
// Five games to 11 may end after 3, 4 or 5 sets when one side wins 3.
for(const games of [
 [[11,7],[11,9],[11,8]],
 [[11,7],[7,11],[11,9],[11,8]],
 [[11,7],[7,11],[11,9],[9,11],[11,8]]
]){
 const proof=completedMatchWinner(games,{year:2026});
 assert.equal(proof?.winningSide,1);
 assert.equal(proof?.format,11);
}
for(const games of [
 [[11,7],[11,9],[11,8],[7,11]],
 [[11,7],[11,8],[8,11]],
 [[11,8],[8,11],[11,8],[11,8],[11,8]],
 [[15,9],[15,8],[15,7]]
])assert.equal(completedMatchWinner(games),null,
 "A finished match cannot have additional sets after the winning threshold");
const excluded=[
 [],[[15,11]],[[15,12],[13,15]],[[21,20],[21,15]],
 [[11,10],[15,10]],[[20,18],[20,17]],[[21,9],[21,9],[21,9]],
 [[11,11],[11,8]],[[22,20],[30,27]],[[21,15],[15,21],[11,10]],
 [[21,10],[21,12],[15,3],[15,4]]
];
for(const score of excluded)
 assert.equal(completedMatchWinner(score),null,"incomplete or contradictory score must not be invented");
const [parser,edge,ui,sw]=await Promise.all([
 "scripts/badhub-history-parser.mjs","supabase/functions/history-match-import/badhub-history-parser.mjs",
 "scripts/external-match-stats.mjs","sw.js"].map(x=>readFile(x,"utf8")));
assert.equal(parser,edge,"deployed parser and browser parser must not diverge");
assert.match(parser,/completedMatchWinner/);
assert.match(ui,/completedMatchWinner/);
assert.match(sw,/scripts\/badminton-score-rules\.mjs/);
console.log("BWBV standard 21 and shortened 11/15 badminton scores: counted only when complete.");
