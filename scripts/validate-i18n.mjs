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
console.log("i18n: "+packs.length+" locales, "+base.length+" matching keys, both screens wired");
