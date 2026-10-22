import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [app,router,html,css,sw,release,settings]=await Promise.all([
 "app.js","router.js","index.html","navigation-ia4-v185.css","sw.js",
 "app-release.js","settings-rooms.js"
].map(path=>readFile(path,"utf8")));
assert.match(app,/const allowed=\[[^\]]*"einstellungen"/);
assert.match(app,/const allowed=\[[^\]]*"historie"/);
assert.match(app,/if\(page==="live"&&el\("live-nav-tab"\)\?\.hidden\)page="turniere"/);
assert.match(app,/navigatePrimary\(link\.getAttribute\("href"\)\.slice\(1\)\)/);
assert.match(app,/isFriend\?"Gefolgter Spieler":"Eigenes Profil"/);
assert.ok(!app.includes("Heute angesetzte oder laufende Spiele"),
 "Do not present confirmed live play when only an appointment is known");
assert.match(router,/live:"Heute im Einsatz"/);
assert.match(router,/a\.dataset\.page===activeTab/);
assert.match(router,/settingsLink\.setAttribute\("aria-current","page"\)/);
assert.match(html,/<nav class="bottom-nav" aria-label="Hauptnavigation">/);
for(const page of ["start","turniere","spieler","mannschaft","berichte"])
 assert.ok(html.includes('data-page="'+page+'"'),"Missing canonical route: "+page);
assert.match(html,/id="live-nav-tab"[^>]*hidden/);
assert.match(html,/href="\.\/navigation-ia4-v185\.css"/);
assert.match(css,/a\[aria-current="page"\]/);
assert.match(css,/a\[hidden\] \{display:none !important\}/);
assert.match(css,/min-height: 56px/);
assert.match(release,/version:"v185"/);
assert.match(sw,/schmetterlinge-shell-v185/);
assert.match(sw,/\.\/navigation-ia4-v185\.css/);
assert.ok(settings.includes('"#einstellungen/spieler":"#spieler"'),
 "IA-3 deep-link compatibility must remain");
assert.doesNotMatch(app,/localStorage\.clear\(|app_access_invite_accept|service_role/);
console.log("IA-4 v185: profile label, contextual Today, unified destinations, focus and offline asset verified.");
