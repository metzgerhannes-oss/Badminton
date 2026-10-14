import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 PENDING_KEY,SEEN_KEY,markImportPending,consumeImportPending,markImportIntroSeen,
 shouldShowImportIntro,acceptedInviteIds
} from "../scripts/profile-import-prompt.mjs";
const store=new Map();
const storage={
 getItem:k=>store.get(k)??null,
 setItem:(k,v)=>store.set(k,String(v)),
 removeItem:k=>store.delete(k)
};
const ID="01-000001",ID2="01-000002";
assert.equal(shouldShowImportIntro(storage,ID),true);
markImportPending(storage,ID);
assert.equal(store.get(PENDING_KEY),ID);
assert.equal(consumeImportPending(storage),ID);
assert.equal(consumeImportPending(storage),"","A consumed welcome prompt must not reopen on reload");
markImportIntroSeen(storage,ID);
assert.equal(shouldShowImportIntro(storage,ID),false,"Do not nag on every same-profile switch");
assert.equal(shouldShowImportIntro(storage,ID2),true,"New profile gets its own introduction");
assert.equal(shouldShowImportIntro(storage,ID,{force:true}),true,"My Data area remains reopenable");
assert.equal(JSON.parse(store.get(SEEN_KEY)).length,1);
store.set("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([
 "01234567-89ab-4cde-8f01-23456789abcd","12345678-9abc-4def-8012-3456789abcde"]));
store.set("schmetterlinge.acceptedPlayerInviteBindings.v1",JSON.stringify({
 "01234567-89ab-4cde-8f01-23456789abcd":ID,
 "12345678-9abc-4def-8012-3456789abcde":ID2
}));
assert.equal(acceptedInviteIds(storage,ID).length,1,"An accepted grant must belong to exactly one player");
assert.equal(acceptedInviteIds(storage,"local-123").length,0);
const [app,welcome,html,wl,bridge,sw,home,history]=await Promise.all([
 "app.js","welcome.js","index.html","welcome.html","profile-import.js","sw.js","dashboard.js","history.js"
].map(p=>readFile(p,"utf8")));
assert.match(app,/badminton:profile-selected/);
assert.match(welcome,/markImportPending\(localStorage,profile\.id\)/);
assert.ok(wl.indexOf('id="onboard-data"')<wl.indexOf('id="onboard-install"'),
 "Welcome must explain opt-in import after player choice, before installation");
assert.ok(wl.indexOf('id="progress-profile"')<wl.indexOf('id="progress-data"'));
assert.match(html,/id="profile-import-dialog"/);
assert.match(html,/id="profile-import-run"/);
assert.match(html,/id="profile-import-later"/);
assert.match(bridge,/getPrivateSession\(false\)/,"No account creation on normal profile selection");
assert.doesNotMatch(bridge,/getPrivateSession\(true\)/);
assert.match(bridge,/acceptedInviteIds\(localStorage,selected\.id\)/);
assert.match(bridge,/private_player_access_read/);
assert.match(bridge,/requestPrivateTrophies\(selected\.id,\{force:true\}\)/);
assert.doesNotMatch(bridge,/localStorage\.setItem|sessionStorage\.setItem|indexedDB\.open/,
 "Private imported data must stay in memory, never silently persist");
assert.doesNotMatch(home,/requestPrivateTrophies\(selection\)/,
 "Home must not retrieve personal trophies automatically");
assert.doesNotMatch(history,/requestPrivateTrophies\(lastPlayer\)/);
assert.match(sw,/profile-import\.js/);
assert.match(sw,/scripts\/profile-import-prompt\.mjs/);
console.log("Profile choice → opt-in data prompt → verified bounded fetch; no repeat nagging or unconsented storage.");
