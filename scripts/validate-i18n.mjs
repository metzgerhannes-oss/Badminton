import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = new URL("../locales/", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL("manifest.json", root),"utf8"));
const expected = manifest.locales.map(x=>x.code);
assert.equal(expected.length,11);
assert.equal(new Set(expected).size,expected.length,"Locale IDs must be unique");
const packs = expected.map(locale => {
  const pack=JSON.parse(fs.readFileSync(new URL(locale+".json",root),"utf8"));
  assert.equal(pack.meta.locale,locale,"Pack ID must match its filename");
  assert.equal(pack.meta.direction,locale==="ar"?"rtl":"ltr");
  assert.equal(pack.meta.version,manifest.version);
  assert.ok(pack.messages && typeof pack.messages==="object");
  for(const [key,value] of Object.entries(pack.messages)){
    assert.ok(key.trim(),"Empty source key");
    assert.equal(typeof value,"string");
    assert.ok(value.trim(),locale+": missing translation for "+key);
    assert.ok(!/<\/?[a-z][^>]*>/i.test(value),locale+": translations must be plain text");
  }
  return {locale,pack};
});
const base=Object.keys(packs[0].pack.messages).sort();
for(const {locale,pack} of packs) assert.deepEqual(Object.keys(pack.messages).sort(),base,locale+": key mismatch");
const rootDir=path.resolve(new URL("../",import.meta.url).pathname);
for(const page of ["index.html","welcome.html"]){
 const html=fs.readFileSync(path.join(rootDir,page),"utf8");
 assert.match(html,/data-language-select/);
 assert.match(html,/<script defer src="\.\/i18n\.js"><\/script>/);
}

const mandatory=["i18n-extended-sources.json","i18n-label-sources.json","i18n-final-static-sources.json"]
  .flatMap(file=>JSON.parse(fs.readFileSync(path.join(rootDir,"scripts",file),"utf8")));
assert.equal(base.length,320,"Expected full static UI, help text and common runtime status inventory");
for(const source of mandatory) assert.ok(base.includes(source),"Missing source phrase: "+source);

const allowedUntranslated = new Set([
 "Schmetterlinge · Badminton Jugend","Willkommen · Schmetterlinge Badminton",
 "Schmetterlinge","SPVGG MÖSSINGEN · BADMINTON JUGEND","BADMINTON JUGEND","Badhub",
 "U11","U13","U15","U17","U19","U22",
 "Deutsch","English","Français","Türkçe","Italiano","Español","Polski",
 "05-123456","Format 05-123456",
 "https://dbv.turnier.de/player-profile/…","https://dbv.turnier.de/tournament/…",
 "iPhone / iPad","Android","Safari","Google Chrome"
]);
for(const page of ["index.html","welcome.html"]){
 const html=fs.readFileSync(path.join(rootDir,page),"utf8");
 const content=[...html.matchAll(/>([^<>]+)</g)].map(x=>x[1].replaceAll("&amp;","&").trim());
 const labels=[...html.matchAll(/(?:placeholder|aria-label|title)="([^"]+)"/g)].map(x=>x[1]);
 const missing=[...new Set([...content,...labels])]
  .filter(x=>x.length>2&&/[a-zäöüß]/i.test(x))
  .filter(x=>!base.includes(x)&&!allowedUntranslated.has(x));
 assert.deepEqual(missing,[],page+": untranslated static UI text");
}

console.log("i18n: "+packs.length+" locales, "+base.length+" matching keys, both screens wired");
