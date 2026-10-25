import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,settings,app,teams,storage,sw,release,css]=await Promise.all(
 ["index.html","settings-rooms.js","app.js","teams.js","state-storage.js","sw.js","app-release.js","canonical-follows-v183.css"].map(path=>readFile(path,"utf8")));
const player=html.slice(html.indexOf('id="view-spieler"'),html.indexOf('id="view-mannschaft"'));
const team=html.slice(html.indexOf('id="view-mannschaft"'),html.indexOf('id="view-einstellungen"'));
const prefs=html.slice(html.indexOf('id="view-einstellungen"'),html.indexOf('</main>'));
for(const [name,region,ids] of [
 ["Spieler",player,["friend-list","followed-player-search","add-friend-manual"]],
 ["Mannschaften",team,["team-followed","team-settings-list","team-add-open"]],
 ["Familie",prefs,["profile-list","add-player","owner-admin-panel","owner-activation-setup"]]
 ]){
 for(const id of ids)assert.ok(region.includes('id="'+id+'"'),name+" missing "+id);
}
for(const id of ["friend-settings-list","team-settings-list","settings-players-add","settings-teams-add","add-friend"]){
 assert.ok(!prefs.includes('id="'+id+'"'),"Settings must not contain duplicate "+id);
}
assert.ok(!player.includes('id="add-player"'),"Following is not family-profile creation");
assert.ok(!team.includes('id="add-player"'),"Following a team is not a profile");
assert.match(player, /id="player-own-preview"[^>]*hidden/);
assert.match(settings, /"#einstellungen\/spieler":"#spieler"/);
assert.match(settings, /"#einstellungen\/mannschaften":"#mannschaft"/);
assert.doesNotMatch(settings, /\{id:"spieler"/);
assert.doesNotMatch(settings, /\{id:"mannschaften"/);
assert.match(app, /data-friend-grip/);
assert.doesNotMatch(player,/id="friend-manage-details"/);
assert.doesNotMatch(player,/id="friend-settings-list"/);
assert.doesNotMatch(player,/id="player-add-open"/);
assert.match(teams, /data-team-move/);
assert.match(app, /SchmetterlingeStorage\.unfollow\(state,id\)/);
assert.match(storage, /selectOwn/);
assert.match(storage, /selectFriend/);
assert.match(css, /min-height:44px/);
const current=release.match(/version:"(v\d+)"/)?.[1];
assert.ok(Number(current?.slice(1))>=183,"IA-2 must survive subsequent releases");
assert.ok(sw.includes('const CACHE="schmetterlinge-shell-'+current+'"'));
for(const group of ["ASSETS","SHELL_ASSETS","ESSENTIAL"]){
 assert.match(sw,new RegExp("const "+group+"=\\[[^;]*canonical-follows-v183\\.css"));
}
console.log("v183 IA-2: canonical follows, family isolation, safe legacy links and PWA verified.");
