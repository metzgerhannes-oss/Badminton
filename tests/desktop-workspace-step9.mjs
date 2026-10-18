import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [html,css,sw,desktop,fixture]=await Promise.all([
 "index.html","desktop-workspace-v174.css","sw.js","desktop-shell-v172.css",
 "tests/e2e/supabase-isolated.fixture.mjs"
].map(f=>readFile(f,"utf8")));
assert.match(html,/<link rel="stylesheet" href="\.\/desktop-workspace-v174\.css">/);
assert.match(css,/@media \(min-width:1080px\)/);
assert.match(css,/@media \(min-width:1280px\)/);
for(const id of ["view-start","view-spieler","view-mannschaft","view-verein","view-berichte","view-einstellungen","view-historie"])
 assert.match(css,new RegExp("#"+id+"\\b"),id+" must have desktop layout policy");
assert.match(css,/#view-spieler\.active:has\(#player-discover:not\(\[hidden\]\)\)/);
assert.match(css,/#view-mannschaft\.active:not\(:has\(#team-detail:not\(\[hidden\]\)\)\)/);
assert.match(css,/#view-berichte\.active #report-list/);
assert.match(css,/#view-einstellungen\.active/);
assert.match(css,/\.team-table-scroll/);
assert.match(css,/:focus-visible/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(desktop,/--desktop-rail:220px/);
assert.equal((html.match(/<nav class="bottom-nav"/g)||[]).length,1);
assert.doesNotMatch(css,/(?:fetch\(|setInterval|localStorage|supabase\.co|user-scalable|maximum-scale|touch-action\s*:\s*none)/i);
assert.match(fixture,/context\.route\(SUPABASE/);
for(const key of ["ASSETS","SHELL_ASSETS"]){
 const m=sw.match(new RegExp("const "+key+"=(\\[[^\\n]+\\]);"));
 assert.ok(m,key+" is present");
 assert.ok(JSON.parse(m[1]).includes("./desktop-workspace-v174.css"),key+" caches desktop workspace");
}
console.log("Desktop package 3: existing views, RTL-safe CSS grid, focus, reduced motion, and offline assets.");
