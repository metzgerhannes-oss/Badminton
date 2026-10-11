import assert from "node:assert/strict";
import {eventUrl,disciplineLinks,parseDiscipline} from "../workers/badhub-event-bridge.mjs";
const valid="https://badhub.de/bvbb/turnier.php?id=4962";
assert.deepEqual(eventUrl(valid),{url:valid,id:"4962",association:"bvbb"});
for(const s of ["https://evil.test/bvbb/turnier.php?id=4962","http://badhub.de/bvbb/turnier.php?id=4962",
 "https://badhub.de/bvbb/turnier.php?id=4962&disc=JE",
 "https://badhub.de/bvbb/turnier.php?id=0",
 "https://badhub.de/bvbb/turnier.php?id=4962#x",
 "https://badhub.de/nope/turnier.php?id=4962",
 "https://badhub.de/bvbb/turnier.php?id=4962&id=2"]){
 assert.equal(eventUrl(s),null,"Strict event input validation "+s);
}
const source=eventUrl(valid);
const html='<a href="?id=4962&amp;disc=JE%20U11">JE U11</a> <a href="?id=4962&amp;disc=JD%20U11">JD U11</a>'+
 '<div class="tm-group-header tm-group-header--ko">Finale</div>'+
 '<table class="bericht-table"><tbody>'+
 '<tr class="bericht-row won--home"><td class="td-player td-player--home"><span class="name-full">Alice &amp; Beth</span></td>'+
 '<td class="td-satz"><span class="set-score">15:11</span> <span class="set-score">18:16</span></td>'+
 '<td class="td-player td-player--guest"><span class="name-full">Charlie</span></td></tr>'+
 '<tr class="bericht-row"><td class="td-player td-player--home"><span class="name-full">David</span></td>'+
 '<td class="td-satz"><span class="set-score">11:8</span></td>'+
 '<td class="td-player td-player--guest"><span class="name-full">Emma</span></td></tr></tbody></table>';
assert.deepEqual(disciplineLinks(html,"4962"),["JE U11","JD U11"]);
assert.equal(disciplineLinks(html,"4977").length,0);
const found=parseDiscipline(html,source,"JE U11");
assert.equal(found.length,2);
assert.deepEqual(found[0].sets,["15:11","18:16"]);
assert.equal(found[0].home,"Alice & Beth");
assert.equal(found[0].away,"Charlie");
assert.equal(found[0].winner,"home");
assert.equal(found[0].category,"finished");
assert.equal(found[0].round,"Finale");
assert.equal(found[1].category,"unknown");
assert.equal(found[1].winner,null);
assert.equal(found[1].sets[0],"11:8");
assert.deepEqual(parseDiscipline(html,source,"JE U11"),found,"stable synthetic references");
console.log("Badhub event bridge: strict source URL, discipline links, real set rows, non-invented winners and scores OK.");
