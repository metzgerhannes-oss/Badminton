import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {BRIDGE,SOURCE_KEY,parseBadhubLink,queryEvent,validateEventResult,renderSummary} from "../scripts/badhub-event.mjs";
const source="https://badhub.de/bvbb/turnier.php?id=4962";
assert.equal(parseBadhubLink(source),source);
assert.equal(parseBadhubLink(source+"&player=08-017967"),source);
assert.equal(parseBadhubLink(source+"&disc=JE"),source);
for(const malicious of ["http://badhub.de/bvbb/turnier.php?id=4962",
 "https://evil.test/bvbb/turnier.php?id=4962",source+"#evil",
 "https://badhub.de/bvbb/turnier.php?id=0",
 "https://badhub.de/evil/turnier.php?id=4962",
 "https://badhub.de/bvbb/turnier.php?id=4962&evil=1",
 "javascript:alert(1)"]){
 assert.equal(parseBadhubLink(malicious),null,"Malformed source never fetched "+malicious);
}
assert.match(BRIDGE,/^https:\/\/schmetterlinge-event-feed\.metzger-hannes\.workers\.dev\/v1\/event$/);
assert.equal(queryEvent("https://evil.test"),null);
const result=queryEvent(source,"offenes Doppel U9");
assert.equal(new URL(result).searchParams.get("url"),source);
assert.equal(new URL(result).searchParams.get("disc"),"offenes Doppel U9");
const payload={provider:"Badhub",kind:"published-event-results",source_url:source,
 checked_at:"2026-10-11T12:00:00Z",event:{id:"4962",association:"bvbb",name:"BBB 1. CD-RLT U9 2026"},
 disciplines:["offenes Doppel U9","JE U11"],selected_discipline:"offenes Doppel U9",
 matches:[{id:"bvbb:4962:offenes Doppel U9:1",discipline:"offenes Doppel U9",round:"Achtelfinale",
  home:"Fahed Islam / Oskar Yi",away:"Leon Schneider-Zhao / Levi Weise",
  sets:["15:11","18:16"],winner:"home",category:"finished"}]};
const data=validateEventResult(payload,source,"offenes Doppel U9");
assert.equal(data.matches.length,1);
assert.deepEqual(data.matches[0].sets,["15:11","18:16"]);
assert.match(renderSummary(data),/1 veröffentlichte/);
assert.equal(validateEventResult({...payload,source_url:"https://evil.test"},source,"offenes Doppel U9"),null);
assert.equal(validateEventResult({...payload,selected_discipline:null},source,"offenes Doppel U9"),null);
assert.deepEqual(validateEventResult({...payload,matches:[{...payload.matches[0],sets:["-2:100"]}]},source,"offenes Doppel U9").matches,[]);
assert.equal(SOURCE_KEY,"schmetterlinge-badhub-events-v1");
const [html,client,css,sw,workflow]=await Promise.all([
 "index.html","badhub-event.js","app-shell.css","sw.js",".github/workflows/tests.yml"
].map(p=>readFile(p,"utf8")));
for(const id of ["badhub-event-form","badhub-event-url","badhub-event-discipline","badhub-event-results",
 "badhub-event-refresh","badhub-event-count","badhub-event-source"])
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,"one event control "+id);
assert.match(html,/src="\.\/badhub-event\.js"/);
assert.match(sw,/\.\/badhub-event\.js/);
assert.match(sw,/\.\/scripts\/badhub-event\.mjs/);
assert.match(client,/queryEvent\(eventUrl,discipline\)/);
assert.match(client,/validateEventResult\(raw,eventUrl,discipline\)/);
assert.doesNotMatch(client,/fetch\(["'`]https:\/\/badhub\.de|service_role|innerHTML/);
assert.match(client,/!document\.hidden/);
assert.match(css,/badhub-match-sides/);
assert.match(workflow,/node tests\/badhub-event-ui\.mjs/);
assert.ok(html.indexOf('id="tournament-live-select"')<html.indexOf('id="badhub-event-panel"'),
 "Official DBV tournament picker precedes optional Badhub section");
assert.match(html,/<details class="badhub-event-panel" id="badhub-event-panel">/);
assert.match(html,/<details class="badhub-event-manual" id="badhub-event-manual">/);
assert.match(client,/Boolean\(\$\("badhub-event-panel"\)\?\.open\)/,
 "The optional Badhub feed is not fetched while collapsed");
assert.ok(client.includes('return /^[0-9a-f-]{36}$/i.test(value)?value:null;'),
 "Badhub source mapping cannot silently apply to an unknown global event");
console.log("Event feed UI and model security: validated URLs, IDs, data, cache and source separation OK.");
