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
