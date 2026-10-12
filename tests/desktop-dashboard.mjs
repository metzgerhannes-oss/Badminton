import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [html,css,sw,app,shell] = await Promise.all([
 "index.html","desktop-dashboard.css","sw.js","app.js","app-shell.css"
].map(p=>readFile(p,"utf8")));

assert.match(html,/href="\.\/desktop-dashboard\.css"/,"Desktop CSS is delivered to the application");
assert.ok(html.indexOf("teams.css")<html.indexOf("desktop-dashboard.css"),"Desktop layer must override navigation widths last");
assert.match(sw,/"\.\/desktop-dashboard\.css"/,"PWA includes offline desktop stylesheet");
assert.match(css,/@media\s*\(min-width:1080px\)/,"Desktop rules only apply to larger screens");
assert.match(css,/#view-start\.active\s*\{/,"Desktop Home must use existing route");
assert.match(css,/grid-template-areas:/,"Original panels must be positioned, never replaced");
assert.match(css,/\.bottom-nav\.has-live-tab a/,"Transient LIVE route shares desktop navigation");
assert.match(css,/#view-start \.dashboard-friends/,"Friend overview has a desktop grid");
assert.match(css,/prefers-reduced-motion:reduce/,"Respect reduced motion");
assert.match(shell,/\.bottom-nav a\[hidden\]\{display:none!important\}/,"Hidden live link stays hidden");
for(const id of ["dashboard-next","match-stats","dashboard-rankings","dashboard-kpis","dashboard-friends","view-mannschaft"]){
 assert.ok(html.includes('id="'+id+'"'),"Existing data-driven dashboard section retained: "+id);
}
assert.ok(app.includes("renderFriendQuick()"));
assert.ok(app.includes("window.renderDashboard?.("));
console.log("Desktop dashboard linked, reusable widgets and existing mobile routing preserved.");
