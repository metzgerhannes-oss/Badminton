import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {badhubLiveUrl,badhubCareerUrl,LIVE_PROVIDER} from "../scripts/live-links.mjs";

assert.equal(LIVE_PROVIDER,"Badhub");
assert.equal(badhubLiveUrl("05-061350"),"https://badhub.de/spieler/05-061350/live");
assert.equal(badhubLiveUrl("05-070879"),"https://badhub.de/spieler/05-070879/live");
assert.equal(badhubCareerUrl("05-061350"),"https://badhub.de/spieler/05-061350?saison=all&src=gesamt");
for(const bad of ["","05-06135","05-061350/", "foo", "javascript:alert(1)", "../foo", undefined, "08-111111#x"]){
 assert.equal(badhubLiveUrl(bad),null);
 assert.equal(badhubCareerUrl(bad),null);
}
const [html,js,css,sw]=await Promise.all(["index.html","live-links.js","design-v2.css","sw.js"].map(x=>readFile(x,"utf8")));
assert.match(html,/id="external-live-player"/);
assert.match(html,/id="external-live-open"/);
assert.match(html,/id="external-live-career"/);
assert.match(html,/Originalquellen &amp; weitere Ergebnisse/);
assert.match(js,/badminton:profile-change/);
assert.match(js,/badhubLiveUrl\(id\)/);
assert.match(css,/\.external-live-player/);
assert.match(sw,/live-links\.js/);
assert.match(sw,/scripts\/live-links\.mjs/);
assert.match(sw,/schmetterlinge-shell-v36/);
console.log("Externes Live: Sarah and Philipp player-specific URLs validated; no unverified in-app match data.");
