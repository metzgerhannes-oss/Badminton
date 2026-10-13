import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [hub,css,index,app,sw,release]=await Promise.all([
 "settings-rooms.js","settings-rooms.css","index.html","app.js","sw.js","app-release.js"
].map(f=>readFile(f,"utf8")));
const rooms=["profile","spieler","mannschaften","darstellung","einladungen","daten","quellen"];
for(const id of rooms)assert.match(hub,new RegExp('id:"'+id+'"'));
assert.match(hub,/const hub=document\.createElement\("div"\)/);
assert.match(hub,/a\.href="#einstellungen\/"/);
assert.match(hub,/className="settings-room-back"/);
assert.match(hub,/search\.type="search"/);
assert.match(hub,/search\.setAttribute\("aria-controls","friend-settings-list"\)/);
assert.match(hub,/MutationObserver\(filterFollowed\)/);
assert.match(hub,/room\.hidden=id!==key/);
assert.match(hub,/rooms\.get\("spieler"\)\.room\.append\(follow\)/);
assert.match(hub,/rooms\.get\("mannschaften"\)\.room\.append\(teamSection\)/);
for(const selector of [".player-management","#owner-admin-panel","#owner-activation-setup",".language-settings",".club-branding-card",".invitation-card",".backup-card"])
 assert.ok(hub.includes(selector),"Missing original settings control: "+selector);
assert.match(hub,/localStorage\.getItem\("shuttleboard-v1"\)/);
assert.doesNotMatch(hub,/localStorage\.setItem|fetch\(|private_owner_player_attest/,"Navigation should never change data, grants or auth state");
assert.match(app,/\.slice\(1\)\.split\("\/"\)\[0\]/);
assert.match(index,/href="#einstellungen\/spieler"/);
assert.match(index,/settings-rooms\.css/);
assert.match(index,/settings-rooms\.js/);
assert.match(sw,/settings-rooms\.css/);
assert.match(sw,/settings-rooms\.js/);
assert.match(sw,/schmetterlinge-shell-v121/);
assert.match(release,/version:"v121"/);
assert.match(css,/#view-einstellungen>\.settings-room\[hidden\]/);
assert.match(css,/#settings-followed-player-search/);
console.log("v120 settings: 7 focused rooms, local-only followed list, accessible search and subroute.");
