import assert from "node:assert/strict";
import {readFile, writeFile} from "node:fs/promises";

/* GitHub Pages only: stamp the exact deployed commit into the files actually
   uploaded, and change the SW bytes on every deploy to invalidate PWA cache.
   --verify is read-only and safe for PR CI. */
const releasePath = "app-release.js";
const swPath = "sw.js";
const [script, sw] = await Promise.all([readFile(releasePath, "utf8"), readFile(swPath, "utf8")]);
const declaration = /\{version:"(v[1-9][0-9]*)", build:"source", commit:""\}/;
const found = script.match(declaration);
assert.ok(found, "Canonical source release declaration is missing");
const version = found[1];
assert.ok(sw.includes('const CACHE="schmetterlinge-shell-' + version + '"'),
  "Service worker cache and release version must agree before stamping");
assert.ok(sw.includes('"./app-release.js"'), "App release script must be in the offline shell");
if (process.argv.includes("--verify")) {
  console.log("App release is consistent: " + version);
} else {
  const sha = (process.env.GITHUB_SHA || "").trim().toLowerCase();
  const run = (process.env.GITHUB_RUN_NUMBER || "").trim();
  assert.match(sha, /^[a-f0-9]{40}$/, "Missing valid deployed Git commit SHA");
  assert.match(run, /^[0-9]+$/, "Missing Pages workflow run number");
  const scriptOut = script.replace(declaration,
    '{version:"' + version + '", build:"pages-' + run + '", commit:"' + sha + '"}');
  const swOut = sw.replace('const CACHE="schmetterlinge-shell-' + version + '"',
    'const CACHE="schmetterlinge-shell-' + version + '-' + sha.slice(0,10) + '"');
  const pages = ["index.html", "welcome.html"];
  const originals = await Promise.all(pages.map(p => readFile(p, "utf8")));
  const stampedPages = originals.map((html, i) => {
    const badges = [...html.matchAll(/<span\\b[^>]*\\bdata-app-version\\b[^>]*>[^<]*<\\/span>/g)];
    assert.equal(badges.length, 1, "Expected exactly one release badge in " + pages[i]);
    assert.ok(badges[0][0].includes(">" + version + "</span>"),
      "HTML badge must match the canonical release: " + pages[i]);
    const badge = badges[0][0];
    let updatedBadge = badge.replace(/\\stitle="[^"]*"/, "");
    updatedBadge = updatedBadge.replace(" data-app-version",
      ' data-app-version data-release-build="' + sha + '" title="Version ' + version +
      ' · Build pages-' + run + ' · Commit ' + sha + '"');
    let updated = html.replace(badge, updatedBadge);
    if (pages[i] === "index.html") {
      const info = /<p\\b[^>]*\\bid="app-build-info"[^>]*>[^<]*<\\/p>/;
      assert.match(updated, info, "Settings build info missing");
      updated = updated.replace(info, match => match
        .replace('id="app-build-info"', 'id="app-build-info" data-release-build="' + sha + '"')
        .replace(/>[^<]*<\\/p>$/, '>Version ' + version + ' · Build pages-' + run +
          ' · Commit ' + sha + '</p>'));
    }
    return updated;
  });
  await Promise.all([
    writeFile(releasePath, scriptOut), writeFile(swPath, swOut),
    ...pages.map((p, i) => writeFile(p, stampedPages[i]))
  ]);
  console.log("Stamped " + version + " (build " + run + ", commit " + sha.slice(0,10) + ")");
}
