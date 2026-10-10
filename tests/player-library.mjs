import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeText,selectPlayers,clubGroups} from "../scripts/library-utils.mjs";
const players=[
 {id:"05-111111",name:"Mia Beispiel",club:"SV Mössingen",ageClass:"U11",association:"BAW"},
 {id:"05-222222",name:"Ben Muster",club:"TV Reutlingen",ageClass:"U13",association:"BAW"},
 {id:"06-333333",name:"Alex Muster",club:"SV Mössingen",ageClass:"U15",association:"HAM"}
];
assert.equal(normalizeText(" MöSSingen "),"mossingen");
assert.equal(selectPlayers(players,{query:"mossingen"}).length,2);
assert.equal(selectPlayers(players,{club:"TV Reutlingen"}).length,1);
assert.equal(selectPlayers(players,{association:"BAW"}).length,2);
assert.equal(selectPlayers(players,{query:"05-222222"})[0].name,"Ben Muster");
const grouped=clubGroups(selectPlayers(players));
assert.equal(grouped.length,2);
assert.equal(grouped[0].players.length,2);
const view=await readFile("index.html","utf8");
const app=await readFile("app.js","utf8");
const shell=await readFile("sw.js","utf8");
assert.match(view,/id="view-spieler"/);
assert.match(view,/id="library-club"/);
assert.match(view,/id="library-age"/);
assert.match(view,/data-page="spieler"/);
assert.match(app,/badmintonLibraryToggleFollow/);
assert.match(app,/badmintonLibraryView/);
assert.match(shell,/library\.js/);
console.log("Verified player directory: search/group/filter UI and local follow bridge valid.");
