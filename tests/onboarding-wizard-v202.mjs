import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WIZARD_KEY,STEP_COUNT,parseStep,nextStep,isFirstProfile} from "../scripts/onboarding-wizard-state.mjs";
assert.equal(WIZARD_KEY,"schmetterlinge.setupWizard.v1");
assert.equal(STEP_COUNT,4);
for(let i=0;i<4;i++)assert.equal(parseStep(String(i)),i);
for(const invalid of [null,undefined,"","4","-1","01","NaN","[object Object]"])assert.equal(parseStep(invalid),null);
assert.equal(nextStep(0),1);assert.equal(nextStep(2),3);assert.equal(nextStep(3),null);
assert.equal(isFirstProfile(null,{players:[{id:"99-999999"}]},"99-999999"),true);
assert.equal(isFirstProfile({players:[]},{players:[{id:"99-999999"}]},"99-999999"),true);
assert.equal(isFirstProfile({players:[{id:"98-999999"}]},{players:[{id:"98-999999"},{id:"99-999999"}]},"99-999999"),false);
assert.equal(isFirstProfile({players:[]},{players:[]},"99-999999"),false);
const js=readFileSync("onboarding-wizard.js","utf8");
assert.match(js,/badminton:app-access-granted/);
assert.match(js,/onboarding-restart/);
assert.match(js,/team-add-open/);
assert.match(js,/dbv-calendar-q/);
assert.doesNotMatch(js,/removeItem\("shuttleboard-v1"\)|localStorage\.clear\(/);
const wizardKeys=["Dein Profil","Dein erstes Spielerprofil ist bereit.","Weitere Spieler","Füge bei Bedarf weitere eigene Spielerprofile hinzu.","Spielerprofil hinzufügen","Suche eine Mannschaft, der du folgen möchtest.","Mannschaft suchen","Merke interessante Turniere mit + für dein Profil vor.","Turniere auswählen","Einrichtung","Überspringen","Später fortfahren","Einrichtung fortsetzen","Einrichtung erneut ansehen","Fertig","{step} von 4"];
for(const code of ["de","en","fr","uk","ru","zh-Hans","tr","ar","it","es","pl"]){
 const pack=JSON.parse(readFileSync("locales/"+code+".json","utf8"));
 for(const key of wizardKeys){
  assert.ok(typeof pack.messages[key]==="string"&&pack.messages[key].trim(),code+": missing wizard key "+key);
 }
 assert.ok(pack.messages["{step} von 4"].includes("{step}"),code+": missing progress placeholder");
 assert.equal(pack.meta.direction,code==="ar"?"rtl":"ltr");
}
assert.match(js,/schmetterlinge:language-change/);
assert.match(js,/SchmetterlingeI18n/);
const sw=readFileSync("sw.js","utf8");
const shell=sw.match(/const SHELL_ASSETS=\[([\s\S]*?)\];/);
assert.ok(shell,"PWA shell asset list missing");
for(const code of ["de","en","fr","uk","ru","zh-Hans","tr","ar","it","es","pl"])assert.ok(shell[1].includes('"./locales/'+code+'.json"'),code+": language pack not pre-cached for offline use");
console.log("F07 v204 wizard locales, RTL and offline packs: OK");
