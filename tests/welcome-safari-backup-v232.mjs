import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createLocalBackup,inspectLocalBackup} from "../scripts/local-backup.mjs";

const [html,js,css,sw]=await Promise.all([
 "welcome.html","welcome.js","welcome.css","sw.js"
].map(file=>readFile(file,"utf8")));
assert.match(html,/id="install-existing-backup"[^>]*hidden/);
assert.match(html,/id="install-backup-export"/);
assert.match(html,/id="install-backup-feedback"[^>]*role="status" aria-live="polite"/);
assert.match(js,/\$\("install-existing-backup"\)\.hidden=!hasProfiles/);
assert.match(js,/\$\("install-backup-export"\)\.addEventListener\("click",exportExistingSafariProfiles\)/);
assert.match(js,/createLocalBackup\(localStorage\.getItem\(LOCAL_STORE_KEY\)/);
assert.match(js,/localStorage\.getItem\(SPOND_STORE_KEY\)/);
assert.doesNotMatch(js,/fetch\([^)]*archive/);
assert.match(css,/\.welcome-existing-backup/);
assert.match(sw,/"\.\/welcome\.js"/);
const privateFamily={
 players:[{id:"99-100001",name:"Testperson A",birthYear:2016}],
 friends:[],officialLinks:[],activeProfileId:"99-100001"
};
const backup=createLocalBackup(JSON.stringify(privateFamily));
const restored=inspectLocalBackup(backup);
assert.equal(restored.summary.players,1);
assert.equal(restored.data.activeProfileId,"99-100001");
console.log("Safari install-first: explicit offline family backup, no silent storage migration.");
