import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [doc,html,settings,app,teams,router]=await Promise.all([
 "docs/NAVIGATION_IA1_V183.md","index.html","settings-rooms.js","app.js","teams.js","router.js"
].map(p=>readFile(p,"utf8")));
const mandatory=["## 1. Inventur","## 2. Navigationsmatrix","## 3. Ziel-Menübaum","## 4. Verbindliche Reihenfolge","## 5. Definition of Done",
 "Profile & Familie","App & Darstellung","Zugänge & Freigaben","Daten & Datenschutz","Hilfe & Informationen",
 "#307","#306","#305","#291","320/390/1280/1440/1920","Keine zusätzlichen Netzwerkabfragen"];
for(const term of mandatory)assert.ok(doc.includes(term),"Missing IA1 decision: "+term);
const routes=[...html.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]);
assert.deepEqual(routes,["start","spieler","turniere","verein","mannschaft"]);
assert.match(html,/id="live-nav-tab"[^>]*hidden/);
assert.match(app,/function navigatePrimary\(page,\{returnToOwn=true\}=\{\}\)/);
assert.match(app,/SchmetterlingeStorage\.showOwn\(state\)/);
assert.match(settings,/id:"profile"/);
assert.doesNotMatch(settings,/id:"spieler"/);
assert.doesNotMatch(settings,/id:"mannschaften"/);
assert.match(settings,/id:"einladungen"/);
assert.doesNotMatch(html,/id="friend-settings-list"/);
assert.match(html,/id="followed-player-search"/);
assert.doesNotMatch(html,/id="team-settings-list"/);
assert.match(html,/id="team-order-reset"/);
assert.doesNotMatch(html,/id="friend-manage-details"/);
assert.doesNotMatch(html,/id="team-manage-details"/);
assert.match(app,/data-friend-grip/);
assert.match(teams,/data-team-move/);
assert.match(router,/page==="historie"/);
assert.match(doc,/vorherige|vorheriger|Ist/);
console.log("IA-1 inventory preserved; IA-2 canonical follow paths and legacy link redirects checked.");
