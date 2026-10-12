import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [html, js, manifest, keys] = await Promise.all([
  readFile("welcome.html","utf8"),
  readFile("welcome.js","utf8"),
  readFile("locales/manifest.json","utf8").then(JSON.parse),
  readFile("tests/welcome-locale-keys.json","utf8").then(JSON.parse)
]);
const required = new Set(keys);
assert.equal(required.size,keys.length,"Each canonical German key must be unique");
const keepGerman = new Set([
 "Schmetterlinge","Willkommen · Schmetterlinge Badminton","Deutsch",
 "English","Français","Türkçe","Italiano","Español","Polski",
 "iPhone / iPad","Android","v94"
]);
const textNodes = [...new Set(html.split(/<[^>]*>/g)
 .map(x=>x.replaceAll("&amp;","&").trim())
 .filter(x=>x&&/[A-Za-zÄÖÜäöüß]/.test(x)&&!x.startsWith("<")))]
 .filter(x=>!keepGerman.has(x));
for (const phrase of textNodes) {
  const files = await Promise.all(manifest.locales.filter(l=>l.code!=="de")
   .map(l=>readFile("locales/"+l.code+".json","utf8").then(JSON.parse)));
  assert.ok(files.every(f=>Object.hasOwn(f.messages,phrase)),
   "Visible German welcome text has no translation in every locale: "+phrase);
}
assert.match(js,/format\("\{count\} passende Spieler"/);
assert.match(js,/format\("✓ DBV-Profil \{id\} übernommen"/);
assert.match(js,/t\("Verein unbekannt"\)/);
for (const {code} of manifest.locales.filter(l=>l.code!=="de")) {
 const pack=JSON.parse(await readFile("locales/"+code+".json","utf8"));
 const other=Object.keys(pack.messages);
 assert.equal(pack.meta.locale,code);
 const absent=keys.filter(k=>typeof pack.messages[k]!=="string"||!pack.messages[k].trim());
 assert.deepEqual(absent,[],code+": every onboarding key needs nonempty text");
 for(const key of keys){
  const expected=[...key.matchAll(/\{([a-z]+)\}/g)].map(m=>m[1]).sort();
  const actual=[...pack.messages[key].matchAll(/\{([a-z]+)\}/g)].map(m=>m[1]).sort();
  assert.deepEqual(actual,expected,code+": interpolation placeholder mismatch in "+key);
 }
 assert.ok(other.length>=165,code+": language pack lost existing app labels");
}
console.log("v94 onboarding i18n: "+keys.length+" required keys and visible welcome text covered in 10 non-German locales.");
