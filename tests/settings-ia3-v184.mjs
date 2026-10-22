import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [rooms,html,css,sw,release,storage,backup]=await Promise.all([
 "settings-rooms.js","index.html","settings-rooms.css","sw.js","app-release.js",
 "state-storage.js","backup.js"
].map(file=>readFile(file,"utf8")));
const current=release.match(/version:"(v\d+)"/)?.[1];
assert.ok(Number(current?.slice(1))>=184,"IA-3 must be present in v184 and later releases");
assert.ok(sw.includes('const CACHE="schmetterlinge-shell-'+current+'"'));
assert.ok(html.includes(">"+current+"</span>"),"HTML release badge must match the current app");
const definitions=rooms.match(/const definitions=\[([\s\S]*?)\n \];/)?.[1];
assert.ok(definitions,"Settings areas must have one static canonical definition");
const entries=[...definitions.matchAll(/\{id:"([^"]+)",title:"([^"]+)"/g)]
 .map(m=>({id:m[1],title:m[2]}));
assert.deepEqual(entries,[
 {id:"profile",title:"Profile & Familie"},
 {id:"darstellung",title:"App & Darstellung"},
 {id:"einladungen",title:"Zugänge & Freigaben"},
 {id:"daten",title:"Daten & Datenschutz"},
 {id:"hilfe",title:"Hilfe & Informationen"}
],"Exactly five distinct settings areas, matching IA-1");
assert.match(rooms,/const grid=document\.createElement\("nav"\)/);
assert.match(rooms,/setAttribute\("aria-label","Einstellungsbereiche"\)/);
assert.ok(rooms.includes('a.href="#einstellungen/"+d.id'),"Room links must target their unique canonical settings hash");
for(const [room,control]of [
 ["profile",".player-management"],
 ["darstellung",".language-settings"],
 ["darstellung",".club-branding-card"],
 ["einladungen",".invitation-card"],
 ["einladungen","#owner-admin-panel"],
 ["einladungen","#owner-activation-setup"],
 ["daten",".backup-card"]
])assert.ok(rooms.includes('appendTo("'+room+'","'+control+'")'),
 "Existing control moved to incorrect settings area: "+control);
assert.doesNotMatch(rooms,/appendTo\("profile","#owner-(?:admin-panel|activation-setup)"\)/,
 "Editing local family profiles must not grant owner access");
assert.match(rooms,/heading==="Daten & Datenschutz"\)rooms\.get\("daten"\)/);
assert.match(rooms,/heading==="Datenquellen & Nachweise"\)rooms\.get\("hilfe"\)/);
for(const href of ["./wiki.html","./welcome.html#installation"])
 assert.ok(rooms.includes(href),"Help link missing "+href);
for(const [hash,destination]of [
 ["#einstellungen/spieler","#spieler"],
 ["#einstellungen/mannschaften","#mannschaft"],
 ["#einstellungen/quellen","#einstellungen/hilfe"]
])assert.ok(rooms.includes('"'+hash+'":"'+destination+'"'),
 "Existing bookmark must redirect to its canonical destination: "+hash);
for(const id of ["profile-list","owner-admin-panel","owner-activation-setup",
 "app-language","club-branding-form","invite-share","backup-export",
 "backup-restore","friend-settings-list","team-settings-list"]){
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,
 "Do not create duplicates or remove existing controls: "+id);
}
assert.match(css,/\.settings-room-link\{[^}]*min-height:83px/);
assert.match(css,/\.settings-room-link:focus-visible/);
assert.match(css,/@media\(min-width:640px\)/);
assert.match(rooms,/room\.hidden=id!==key/);
assert.match(rooms,/localStorage\.getItem/);
assert.doesNotMatch(rooms,/localStorage\.setItem|\bfetch\s*\(|\bXMLHttpRequest\b|\.supabase\.co|app_access_invite_accept|private_owner_player_attest/,
 "Switching a room may not contact the server or mutate private grants");
assert.match(storage,/selectOwn/);
assert.match(backup,/backup-restore/);
console.log("v184 IA-3: exactly five settings areas, no duplicate management, legacy URLs, no new backend calls, PWA upgrade.");
