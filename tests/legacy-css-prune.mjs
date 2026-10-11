import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,css,shell,components,cache]=await Promise.all([
 "index.html","styles.css","app-shell.css","ui-components.css","sw.js"
].map(path=>readFile(path,"utf8")));

// These were part of the abandoned prototype screen, not of the four-tab app.
// Protect against accidentally reintroducing its confusing parallel controls.
const retired=[
 ".hero{",".hero-crest{",".hero h1{",".player-pills{",".pill{",
 ".next-card{",".segmented{",".segment{",".match-card{",
 ".match-state{",".match-list{",".match-top{",".match-time{"
];
for(const rule of retired)assert.ok(!css.includes(rule),"Retired selector still present: "+rule);
assert.ok(!css.includes(".match-card:hover"),"Retired match hover must not remain");
assert.doesNotMatch(html,/id="player-pills"|id="next-match"|id="match-list"/);

// All still-used foundation elements and the approved full logo must survive.
for(const rule of [
 "*{box-sizing:border-box}","button{cursor:pointer}",".page{display:none}",
 ".page.active{display:block}",".icon-button{display:grid;",
 ".bottom-nav{position:fixed;","dialog{padding:0",".modal{padding:20px",
 ".toast.visible{display:block}"
])assert.ok(css.includes(rule),"Required foundational styling missing: "+rule);
assert.ok(css.includes(".icon-button:hover{"),"Active close-button hover feedback missing");
assert.ok(css.includes("mask:none!important;-webkit-mask:none!important"));
assert.ok(css.includes("clip-path:none!important"));
assert.ok(shell.includes(".bottom-nav a{width:25%!important"));
assert.ok(components.includes(".ranking-tile.ranking-compact{"));
assert.match(cache,/schmetterlinge-shell-v73/);
assert.equal((html.match(/data-page="/g)||[]).length,4);
console.log("v68: unused prototype CSS retired; active four-tab navigation, dialogs, PWA and approved crest intact.");
