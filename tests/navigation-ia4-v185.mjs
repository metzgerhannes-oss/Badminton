import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [app,router,html,css,sw,release,settings,fixture]=await Promise.all([
 "app.js","router.js","index.html","app-shell.css","sw.js","app-release.js",
 "settings-rooms.js","tests/e2e/supabase-isolated.fixture.mjs"
].map(file=>readFile(file,"utf8")));
assert.match(app,/function navigatePrimary\(page,\{returnToOwn=true\}=\{\}\)/);
assert.match(app,/function navigateHome\(\)\{return navigatePrimary\("start"\)\}/);
assert.match(app,/if\(page==="start"\)\{\s*if\(returnToOwn\)/);
assert.match(app,/navigatePrimary\(page,\{returnToOwn:false\}\)/,
 "Explicitly selecting a followed player must not silently restore own Home");
assert.match(app,/document\.addEventListener\("click",event=>\{/);
assert.match(app,/event\.defaultPrevented/);
assert.match(app,/link\.closest\("\.bottom-nav"\)/,
 "No duplicate bottom navigation dispatch");
assert.match(app,/event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\|\|event\.altKey/);
assert.match(app,/navigatePrimary\(dest\)/);
assert.match(app,/navigatePrimary\("spieler"\)/,
 "Home add friend must navigate directly to canonical player discovery");
assert.match(app,/\["start","turniere","live","spieler","verein","mannschaft","berichte","historie","spiele"\]/);
assert.match(html,/href="#spiele"/,"Spielecke must remain reachable from Home/Turniertag");
assert.doesNotMatch(html,/<a[^>]*data-page="spiele"/,"Spielecke must not become a sixth main navigation tab");
assert.match(router,/page==="historie"\|\|\(page==="live"&&liveHidden\)\?"turniere"/);
assert.match(html,/class="home-stats-link" href="#historie"/);
assert.match(html,/class="live-tournaments-return" href="#turniere"|class="history-inline-link live-tournaments-return" href="#turniere"/);
assert.match(html,/id="home-live-peek"/);
assert.match(html,/id="live-nav-tab"[^>]*hidden/);
assert.match(app,/todayNav\.matchToday&&todayNav\.day===localDay\(\)/,
 "Today remains source-gated and never red without verified scheduled match");
assert.match(css,/\.bottom-nav\.has-live-tab \.live-nav-tab/);
assert.match(html,/id="profile-list"/);
assert.match(settings,/id:"einladungen",title:"Zugänge & Freigaben"/);
assert.doesNotMatch(app,/localStorage\.clear\(|sessionStorage\.clear\(/);
assert.match(fixture,/context\.route\(SUPABASE/);
assert.match(fixture,/Browser QA: non-mocked Supabase request blocked/);
const current=release.match(/version:"(v[0-9]+)"/)?.[1];
assert.ok(Number(current?.slice(1))>=185,"IA-4 regression required on v185+");
assert.ok(sw.includes('const CACHE="schmetterlinge-shell-'+current+'"'));
console.log("IA-4 v185: canonical immediate Home/context routes, followed viewer safety, conditional Heute, storage and browser network isolation.");
