import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,css,sw,js,manifest]=await Promise.all([
 readFile("index.html","utf8"),readFile("design-v2.css","utf8"),
 readFile("sw.js","utf8"),readFile("dashboard.js","utf8"),
 readFile("manifest.webmanifest","utf8").then(JSON.parse)
]);
assert.match(html,/rel="stylesheet" href="\.\/design-v2\.css"/);
assert.match(sw,/design-v2\.css/);
assert.match(sw,/stats\.js/);
assert.match(sw,/scripts\/match-stats\.mjs/);
assert.match(sw,/schmetterlinge-shell-v32/);
for(const id of ["start","historie","turniere","berichte","spieler","einstellungen"]){
 assert.match(html,new RegExp('data-page="'+id+'"'));
}
assert.equal((html.match(/class="nav-icon"/g)||[]).length,6);
assert.match(css,/--ink:\s*#0b2a52/);
assert.match(css,/\.dashboard-ranking-grid\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
assert.match(css,/\.match-stats-values\s*\{[^}]*repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css,/env\(safe-area-inset-bottom\)/);
assert.match(css,/max-width:350px/);
assert.match(css,/dialog::backdrop/);
assert.match(js,/home-trophy/);
assert.match(js,/friendNoHistory/);
assert.match(js,/summarizeTrophies\(results\)/);
assert.equal(manifest.theme_color,"#d9ecfb");
assert.equal(manifest.background_color,"#d4ebfc");
assert.match(html,/id="view-berichte"/);
assert.match(html,/id="view-spieler"/);
console.log("Light design navigation, iPhone safe-area, responsive KPIs and PWA assets verified.");
