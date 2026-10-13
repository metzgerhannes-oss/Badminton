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
assert.match(sw,/schmetterlinge-shell-v109/);
const cutoverSql=await readFile("database/private_player_read_cutover_v114.sql","utf8");
for(const table of ["players","ranking_entries","tournament_placements","article_player_mentions",
 "player_external_match_facts","player_history_overviews","shared_tournament_hints",
 "match_participants","player_live_snapshots"]){
 assert.ok(cutoverSql.includes("public."+table),"Sensitive dataset needs explicit server-side removal: "+table);
}
assert.match(cutoverSql,/revoke select on[\s\S]+from public,anon,authenticated/i);
assert.match(cutoverSql,/revoke select \(dbv_id,status,[\s\S]+on public\.player_history_imports/i);
assert.match(cutoverSql,/revoke execute on function public\.request_player_history_demand\(text\) from public,anon,authenticated/i);
assert.match(cutoverSql,/has_table_privilege\('anon','public\.dbv_calendar_entries','SELECT'\)/);
console.log("Private-mode release gate: no public personal archives, no scheduled name re-publication, old SW cache invalidated.");
