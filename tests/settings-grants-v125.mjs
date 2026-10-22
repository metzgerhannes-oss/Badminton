import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [rooms,css,reader,share]=await Promise.all([
 "settings-rooms.js","settings-rooms.css","private-player-reader.js","player-access.js"
].map(p=>readFile(p,"utf8")));
assert.match(rooms,/title:"Zugänge & Freigaben"/);
for(const label of ["Von mir erteilte Freigaben","Von mir angenommene Freigaben"])
 assert.ok(rooms.includes(label),"Missing grant section: "+label);
assert.match(rooms,/appendTo\("einladungen","\.invitation-card"\)/,
 "App-issued invitations and revocation belong in the grant management room");
assert.doesNotMatch(rooms,/App-Installationslink \(ohne Spielerrechte\)/,
 "An invitation granting sourced results must not be mislabeled as a bare installation link");
assert.match(rooms,/appendTo\("einladungen","#owner-admin-panel"\)/);
assert.match(rooms,/appendTo\("einladungen","#owner-activation-setup"\)/);
assert.doesNotMatch(rooms,/searchLink\.href|ownerLink\.href/,
 "IA-3: avoid duplicate management routes from within the grants overview");
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
console.log("Grant settings separate device-local player links and owner-only server-issued app invitations.");
