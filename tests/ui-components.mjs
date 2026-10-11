import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,components,design,legacy,cache]=await Promise.all([
 "index.html","ui-components.css","design-v2.css","styles.css","sw.js"
].map(path=>readFile(path,"utf8")));
const order=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)"/g)].map(x=>x[1]);
assert.deepEqual(order,["styles.css","ui-components.css","design-v2.css","app-shell.css"]);
assert.match(components,/\.focused-profile\{margin:5px 0 23px/);
assert.match(components,/\.dashboard-ranking-grid\{display:grid/);
assert.match(components,/\.home-trophy\{/);
assert.match(components,/\.friend-quick\{/);
assert.match(components,/\.settings-card,\.profile-card,\.friend-card/);
assert.match(components,/\.modal input,\.modal select/);
assert.match(components,/dialog::backdrop/);
assert.match(components,/\.ranking-dialog-stats>div/);
assert.doesNotMatch(design,/\.home-trophy\{padding:18px/);
assert.doesNotMatch(design,/\.focused-profile\{margin:5px 0 23px/);
assert.doesNotMatch(design,/\.ranking-dialog-stats>div\{background:#edf8ff/);
assert.doesNotMatch(components,/\.kpi-tile,\.kpi-wide\{color:var\(--ink\)\}/,
 "Duplicate declaration removed; card group already supplies the same property");
assert.match(components,/\.kpi-tile,\.kpi-wide,\.dashboard-empty-tile/);
assert.match(legacy,/\.ranking-dialog\{width:calc/);
assert.match(design,/\.library-club-group/);
assert.match(cache,/"\.\/ui-components.css"/);
assert.match(cache,/schmetterlinge-shell-v71/);
console.log("v65 component cascade, extracted home and player cards, dialogs, preserved legacy bases and PWA cache verified.");
