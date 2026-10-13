import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {validateExternalCareer,chooseHistory,seasonYears,lifetimeRate,externalProfileLink} from "../scripts/external-history.mjs";
const index=JSON.parse(await readFile("data/player-history/index.json","utf8"));
assert.equal(index.schemaVersion,1);
assert.equal(index.privacyMode,"private");
assert.deepEqual(index.profiles,[],"Static named careers must no longer be public");
const ID="99-123456";
const data={schemaVersion:1,dbvId:ID,sourceStatus:"third-party-aggregated",
 source:{name:"Badhub",url:"https://badhub.de/spieler/"+ID+"?saison=all&src=gesamt"},
 totals:{matches:10,wins:6,losses:4,tournament:{matches:8,wins:5},league:{matches:2,wins:1}},
 years:[{year:2026,tournaments:2,placements:3,gold:1,silver:1,bronze:0},
        {year:2025,tournaments:1,placements:2,gold:0,silver:0,bronze:1}],
 highlights:[{event:"Testturnier A",startDate:"2026-04-10",discipline:"Einzel",place:1},
             {event:"Testturnier B",startDate:"2025-04-10",discipline:"Doppel",place:3}]};
assert.equal(validateExternalCareer(data,ID),true);
assert.equal(validateExternalCareer(data,"99-111111"),false,"Source must match the requested ID");
assert.equal(validateExternalCareer({...data,totals:{...data.totals,wins:999}},ID),false);
assert.equal(lifetimeRate(data),60);
assert.deepEqual(seasonYears(data),[2026,2025]);
assert.deepEqual(chooseHistory(data).years.map(x=>x.year),[2026,2025]);
assert.equal(chooseHistory(data,{year:"2025"}).years.length,1);
assert.equal(chooseHistory(data,{year:"2025",discipline:"Doppel"}).highlights.length,1);
assert.equal(chooseHistory(data,{year:"2025",discipline:"Einzel"}).highlights.length,0);
assert.equal(externalProfileLink(ID),"https://badhub.de/spieler/"+ID+"?saison=all&src=gesamt");
assert.equal(externalProfileLink("local-test"),null);
const [html,js,stats,history,css,sw]=await Promise.all([
 readFile("index.html","utf8"),readFile("career-history.js","utf8"),
 readFile("stats.js","utf8"),readFile("history.js","utf8"),
 readFile("design-v2.css","utf8"),readFile("sw.js","utf8")
]);
assert.match(html,/id="career-history"/);
assert.match(html,/id="career-year"/);
assert.match(html,/id="career-discipline"/);
assert.match(html,/id="external-match-summary"/);
assert.match(js,/badminton:profile-change/);
assert.match(js,/validateExternalCareer/);
assert.match(js,/readPublicRows\(overviewPath\(id\),\{count:false\}\)/);
assert.match(js,/const CACHE_MS=60_000/,"Older cached aggregates must eventually refresh");
assert.match(js,/const yearsLabel=available.length===1/,"Displayed years must be based on each source");
assert.doesNotMatch(js,/öffentliche Jahresaggregate 2019–2026/,"No hardcoded source years for every player");
assert.match(js,/extern.*|Externe/i);
assert.match(js,/Nicht mit den offiziellen Match-KPIs addieren/);
assert.match(js,/separaten Trophäenschrank/);
assert.match(await readFile("scripts/match-availability.mjs","utf8"),/Noch keine einzeln belegten Spiele verfügbar/);
assert.match(history,/Geschütztes Teilarchiv/,"Private trophies stay separate from external career aggregates");
assert.match(history,/trophySnapshot\(lastPlayer\)/,"Historical awards are now obtained only from the authorized source");
assert.match(css,/\.career-year-card/);
assert.match(sw,/career-history\.js/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
console.log("External career rules verified on synthetic data; named static career removed.");
