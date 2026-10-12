import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,legacy,components,design,shell,cache,manifest]=await Promise.all([
 "index.html","styles.css","ui-components.css","design-v2.css","app-shell.css","sw.js","manifest.webmanifest"
].map(path=>readFile(path,"utf8")));
const href=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(href,["styles.css","ui-components.css","design-v2.css","language.css","club-branding.css","app-shell.css","teams.css","desktop-dashboard.css"],
 "Application chrome must be the last CSS layer");
const tabs=[...html.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(tabs,["start","turniere","live","spieler","mannschaft","berichte"]);
assert.match(await readFile("teams.css","utf8"),/\.bottom-nav a\{width:20%!important/);
assert.match(await readFile("teams.css","utf8"),/\.bottom-nav\.has-live-tab a\{width:16\.666%!important/);
assert.match(shell,/\.bottom-nav a\[hidden\]\{display:none!important\}/);
assert.match(shell,/\.topbar-settings\{/);
assert.match(shell,/@media\(max-width:410px\)/);
assert.match(shell,/@media\(max-width:350px\)/);
assert.match(design,/\.bottom-nav\{width:100%;max-width:none/);
assert.match(components,/\.home-trophy\{/);
assert.match(components,/\.ranking-dialog\{/);
assert.doesNotMatch(design,/\.bottom-nav a\{width:16\.666/);
assert.doesNotMatch(legacy,/\.bottom-nav a\{width:(?:16\.666|20%|33\.3333)/);
assert.match(legacy,/mask:none!important;-webkit-mask:none!important/);
assert.match(legacy,/clip-path:none!important/);
assert.match(cache,/schmetterlinge-shell-v[1-9][0-9]*/);
assert.match(cache,/"\.\/app-shell.css"/);
assert.equal(JSON.parse(manifest).theme_color,"#d9ecfb");
console.log("v63 app shell: CSS precedence, four navigation tabs, current responsive header, full logo and offline cache verified.");
