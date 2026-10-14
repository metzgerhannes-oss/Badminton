import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [rooms,css,reader,share]=await Promise.all([
 "settings-rooms.js","settings-rooms.css","private-player-reader.js","player-access.js"
].map(p=>readFile(p,"utf8")));
assert.match(rooms,/title:"Einladungen & Freigaben"/);
for(const label of ["Spieler suchen","Von mir erteilte Freigaben","Von mir angenommene Freigaben"])
 assert.ok(rooms.includes(label),"Missing grant section: "+label);
assert.match(rooms,/appendTo\("daten","\.invitation-card"\)/,
 "Public installation must not be presented as a player grant");
assert.match(rooms,/const setupDetails=document.createElement\("details"\)/);
assert.match(rooms,/searchLink.href="#spieler"/);
assert.match(rooms,/ownerLink.href="#einstellungen\/profile"/);
assert.match(rooms,/schmetterlinge\.privatePlayerInvites\.v1/);
assert.match(rooms,/schmetterlinge\.acceptedPlayerInvite\.v3/);
assert.match(rooms,/Annahmestatus nicht geprüft/);
assert.match(rooms,/Zugang sicher prüfen/);
assert.doesNotMatch(rooms,/localStorage\.setItem|\bfetch\(|private_owner_player_attest/,
 "Grant overview must not create auth, write data or invent server statuses");
assert.match(rooms,/validUuid\(invitation\?\.id\)/);
assert.match(rooms,/li\.append\(make\("strong"/);
assert.doesNotMatch(rooms,/invitation\.token|token_digest/,
 "Never render stored access tokens or token hashes");
assert.match(reader,/private_player_access_read/);
assert.match(share,/private_player_invite_revoke/);
assert.match(css,/\.settings-grant-list/);
console.log("Grant settings are device-local and make no authorization claims.");
