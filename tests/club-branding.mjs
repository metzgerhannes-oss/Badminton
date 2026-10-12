import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const files = await Promise.all([
  "index.html", "welcome.html", "club-branding.js", "club-branding.css",
  "language.css", "i18n.js", "sw.js"
].map(path => readFile(path, "utf8")));
const [index, welcome, script, css, languageCss, i18n, serviceWorker] = files;

for (const id of ["club-branding-form", "club-name", "club-logo", "club-accent",
  "club-logo-remove", "club-branding-cancel", "club-branding-reset",
  "club-preview", "club-brand-subtitle", "club-branding-status"]) {
  assert.match(index, new RegExp('id="' + id + '"'), "Branding form missing " + id);
}
assert.match(index, /<script defer src="\.\/club-branding\.js"><\/script>/);
assert.match(index, /<link rel="stylesheet" href="\.\/club-branding\.css">/);
assert.match(welcome, /id="welcome-language" data-language-select/);
assert.ok(welcome.indexOf('id="welcome-language"') < welcome.indexOf('id="welcome-title"'),
  "Language selection must precede onboarding");
assert.match(welcome, /id="welcome-language-status"/);
assert.match(languageCss, /min-height:46px/);
assert.match(i18n, /schmetterlinge\.uiLanguage/);
assert.match(serviceWorker, /schmetterlinge-shell-v91/);
assert.match(serviceWorker, /club-branding\.js/);
assert.match(serviceWorker, /club-branding\.css/);
for (const code of ["en", "fr", "uk", "ru", "zh-Hans", "tr", "ar", "it", "es", "pl"]) {
  const pack = JSON.parse(await readFile("locales/" + code + ".json", "utf8"));
  assert.equal(pack.meta.locale, code);
  for (const key of ["Wessen Badminton möchtest du verfolgen?",
    "Erscheinungsbild & Verein", "Vereinsname", "Vereinsdesign speichern"]) {
    assert.ok(typeof pack.messages[key] === "string" && pack.messages[key].length > 0,
      "Missing locale string: " + code + " " + key);
  }
}
assert.match(css, /\.club-themed \.bottom-nav a\[aria-current="page"\]/);
assert.doesNotMatch(css, /(?:win|loss|victor|defeat|warning|error)-/i,
  "Branding CSS must not modify scores or warning semantics");

class Element {
  constructor() {
    this.value = "";
    this.src = "";
    this.alt = "";
    this.textContent = "";
    this.disabled = false;
    this.files = [];
    this.listeners = new Map();
    this.children = [];
    this.styleValues = new Map();
    this.style = {setProperty: (key, value) => this.styleValues.set(key, value)};
    this.classes = new Set();
    this.classList = {
      toggle: (name, state) => { if (state) this.classes.add(name); else this.classes.delete(name); },
      contains: name => this.classes.has(name)
    };
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  emit(name) { return this.listeners.get(name)?.({target: this, preventDefault() {}}); }
  appendChild(child) { this.children.push(child); }
}
const ids = Object.fromEntries([...index.matchAll(/id="([^"]+)"/g)].map(x => [x[1], new Element()]));
const logo = new Element();
const meta = new Element();
meta.attributes = {};
meta.setAttribute = (key, value) => {meta.attributes[key] = value;};
const root = new Element();
const storage = new Map();
storage.set("shuttleboard-v1", JSON.stringify({players:[{id:"05-000001",name:"Test",club:"Example Club"}]}));
const localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key)
};
const createImageBytes = () => {
  const arr = new Uint8ClampedArray(256 * 256 * 4);
  for (let i = 0; i < arr.length; i += 4) { arr[i] = 220; arr[i + 1] = 20; arr[i + 2] = 25; arr[i + 3] = 255; }
  return arr;
};
const imagePixels = createImageBytes();
const document = {
  readyState: "complete",
  documentElement: root,
  getElementById: id => ids[id] || null,
  querySelector: selector => selector === ".topbar .brand-logo" ? logo
    : selector === 'meta[name="theme-color"]' ? meta : null,
  createElement: name => name === "canvas" ? ({
    width: 0, height: 0,
    getContext: () => ({
      fillRect() {}, drawImage() {},
      getImageData: () => ({data: imagePixels})
    }),
    toDataURL: () => "data:image/webp;base64,YWJj"
  }) : new Element()
};
class MockImage {
  naturalWidth = 320;
  naturalHeight = 180;
  set src(value) {queueMicrotask(() => this.onload?.());}
}
const window = {addEventListener() {}};
const URL = {createObjectURL: () => "blob:test", revokeObjectURL() {}};
vm.runInNewContext(script, {document, window, URL, Image: MockImage,
  localStorage, queueMicrotask, Uint8ClampedArray, console}, {filename: "club-branding.js"});

const key = "schmetterlinge.clubBranding.v1";
assert.equal(logo.src, "./assets/spvgg-schmetterlinge.svg");
assert.equal(ids["club-name-suggestions"].children[0]?.value, "Example Club");
ids["club-name"].value = "Test Club";
ids["club-name"].emit("input");
ids["club-accent"].value = "#adffde";
ids["club-accent"].emit("input");
assert.equal(ids["club-preview-name"].textContent, "Test Club");
assert.equal(ids["club-preview"].styleValues.get("--club-accent"), "#adffde");
assert.equal(storage.has(key), false, "Preview must not persist before save");
ids["club-branding-form"].emit("submit");
assert.equal(JSON.parse(storage.get(key)).name, "Test Club");
assert.equal(logo.alt, "Schmetterlingslogo der SpVgg Mössingen");
assert.equal(ids["club-brand-subtitle"].textContent, "Test Club");
assert.equal(root.classList.contains("club-themed"), true);
assert.equal(root.styleValues.get("--club-contrast"), "#111827");
assert.equal(storage.has("shuttleboard-v1"), true, "Private player data must be preserved");

ids["club-name"].value = "Unsaved";
ids["club-name"].emit("input");
ids["club-branding-cancel"].emit("click");
assert.equal(ids["club-name"].value, "Test Club", "Cancel restores saved design");

ids["club-logo"].files = [{type:"image/png",size:200}];
ids["club-logo"].emit("change");
await new Promise(resolve => setTimeout(resolve, 0));
assert.match(ids["club-preview-logo"].src, /^data:image\/webp;base64,/);
assert.equal(ids["club-accent"].value, "#dc1419", "Color extracted from logo");
ids["club-branding-form"].emit("submit");
assert.match(JSON.parse(storage.get(key)).logo, /^data:image\/webp;base64,/);
assert.equal(logo.alt, "Logo von Test Club");

ids["club-logo-remove"].emit("click");
assert.equal(ids["club-preview-logo"].src, "./assets/spvgg-schmetterlinge.svg");
ids["club-branding-cancel"].emit("click");
assert.match(ids["club-preview-logo"].src, /^data:image\/webp;base64,/,
  "Uncommitted logo removal must be reversible");

ids["club-branding-reset"].emit("click");
assert.equal(storage.has(key), false);
assert.equal(root.classList.contains("club-themed"), false);
assert.equal(ids["club-brand-subtitle"].textContent, "SPVGG MÖSSINGEN · BADMINTON JUGEND");
assert.equal(logo.src, "./assets/spvgg-schmetterlinge.svg");
assert.ok(ids["club-preview-name"].textContent.includes("Standarddesign"));
console.log("Club branding, logo preview, save/cancel/reset, language entry, all 10 locale packs and offline shell verified.");
