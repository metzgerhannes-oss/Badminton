import assert from "node:assert/strict";
import {trophyAccessState,trophyAccessMessage} from "../scripts/trophy-access-state.mjs";
assert.equal(trophyAccessState(null),"loading");
assert.equal(trophyAccessState(null,true),"unavailable");
assert.equal(trophyAccessState({schemaVersion:1,privacyMode:"private",results:[]}),"protected");
assert.equal(trophyAccessState({results:[]}),"ready");
assert.equal(trophyAccessState({results:[{id:"synthetic"}]}),"ready");
assert.equal(trophyAccessState({status:"bad"}),"unavailable");
assert.match(trophyAccessMessage("protected"),/nicht 0/);
assert.match(trophyAccessMessage("unavailable"),/keine Anzahl/);
assert.equal(trophyAccessMessage("ready"),"");
import {readFile} from "node:fs/promises";
const [home,chronicle,archive]=await Promise.all([
 readFile("dashboard.js","utf8"),readFile("history.js","utf8"),
 readFile("data/history.json","utf8")
]);
assert.equal(trophyAccessState(JSON.parse(archive)),"protected");
assert.match(home,/trophyUnknown\?"–":num\(medals\[slot\.place\]\)/);
assert.match(home,/trophyUnknown\?"–":num\(years\.size\)/);
assert.match(home,/trophyAccessMessage\(trophyState\)/);
assert.match(chronicle,/if\(accessState!=="ready"\)/);
assert.match(chronicle,/section\.hidden=true/);
assert.match(chronicle,/accessState=trophyAccessState\(data\)/);
console.log("Private trophy placeholder is never treated as a verified zero.");
