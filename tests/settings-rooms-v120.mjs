import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [hub,css,index,app,sw,release]=await Promise.all([
 "settings-rooms.js","settings-rooms.css","index.html","app.js","sw.js","app-release.js"
].map(f=>readFile(f,"utf8")));

// The v120 rooms still exist in v183, but follower management has one canonical
// home in its subject view, not duplicate controls inside Settings.
const rooms=["profile","darstellung","einladungen","daten","hilfe"];
for(const id of rooms)assert.match(hub,new RegExp('id:"'+id+'"'));
for(const removed of ["spieler","mannschaften"])
 assert.doesNotMatch(hub,new RegExp('\\{id:"'+removed+'"'),"No duplicated settings room: "+removed);
assert.match(hub,/const hub=document\.createElement\("div"\)/);
assert.match(hub,/a\.href="#einstellungen\/"/);
assert.match(hub,/className="settings-room-back"/);
assert.match(hub,/room\.hidden=id!==key/);
assert.match(hub,/"#einstellungen\/spieler":"#spieler"/);
assert.match(hub,/"#einstellungen\/mannschaften":"#mannschaft"/);
assert.match(index,/id="player-add-open"/);
assert.match(index,/id="friend-settings-list"/);
assert.match(index,/id="team-settings-list"/);
for(const selector of [".player-management","#owner-admin-panel","#owner-activation-setup",
 ".language-settings",".club-branding-card",".invitation-card",".backup-card"])
 assert.ok(hub.includes(selector),"Missing original settings control: "+selector);
assert.match(hub,/localStorage\.getItem\("shuttleboard-v1"\)/);
assert.doesNotMatch(hub,/localStorage\.setItem|\bfetch\s*\(|private_owner_player_attest/,
 "Settings navigation must not change data, grants or authentication");
assert.match(app,/SchmetterlingeStorage\.showOwn\(state\)/);
assert.match(hub,/id:"profile",title:"Profile & Familie"/,
 "A single dedicated family-profile settings room must stay accessible");
assert.match(index,/settings-rooms\.css/);
assert.match(index,/settings-rooms\.js/);
assert.match(sw,/settings-rooms\.css/);
assert.match(sw,/settings-rooms\.js/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
assert.match(release,/version:"v[1-9][0-9]*"/);
assert.match(css,/#view-einstellungen>\.settings-room\[hidden\]/);
console.log("v183 settings: five remaining rooms, canonical follow routes and unchanged access controls.");
