import assert from "node:assert/strict";
import {readFile,access} from "node:fs/promises";
const JSON_PATHS=["data/history.json","data/ranking.json","data/report-articles.json",
 "data/player-history/index.json","data/player-library/index.json"];
for(const path of JSON_PATHS){
 const data=JSON.parse(await readFile(path,"utf8"));
 assert.equal(data.privacyMode,"private",path+" must be a privacy-mode stub");
 if("players" in data) assert.equal(Array.isArray(data.players)?data.players.length:Object.keys(data.players).length,0,path+" ships named players");
 if("results" in data)assert.deepEqual(data.results,[],path+" ships player results");
 if("articles" in data)assert.deepEqual(data.articles,[],path+" ships named article mentions");
 if("profiles" in data)assert.deepEqual(data.profiles,[],path+" ships a named career snapshot");
}
for(const age of ["U11","U13","U15","U17","U19","U22"]){
 const f=JSON.parse(await readFile("data/player-library/"+age+".json","utf8"));
 assert.equal(f.privacyMode,"private");assert.deepEqual(f.players,[]);
}
await assert.rejects(access("data/player-history/05-061350.json"));
for(const workflow of [".github/workflows/ranking.yml",".github/workflows/report-discovery.yml"]){
 const content=await readFile(workflow,"utf8");
 assert.match(content,/\n\s+if: \$\{\{ false \}\}\n/,workflow+" must not re-publish personal data");
}
const sw=await readFile("sw.js","utf8");
assert.doesNotMatch(sw,/\.\/data\/player-history\/05-061350\.json/);
assert.match(sw,/schmetterlinge-shell-v114/);
console.log("Private-mode release gate: no public personal archives, no scheduled name re-publication, old SW cache invalidated.");
