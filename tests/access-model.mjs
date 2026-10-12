import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const [welcome,app,html,community,grant,plan,backend]=await Promise.all([
 "welcome.js","app.js","index.html","shared-tournaments.js",
 "database/verified-player-publication-v90.sql",
 "docs/ZUGRIFFSMODELL_V105.md",
 "scripts/supabase-read.mjs"
].map(file=>readFile(file,"utf8")));

// Reading sport data and locally saving profiles must not create Auth users.
for(const src of [welcome,app,backend]) {
 assert.doesNotMatch(src,/auth\/v1\/(signup|token|authorize)|signInAnonymously|getSession\(true\)/i,
  "Public browsing or first-use must never create an account");
}
assert.match(welcome,/Profile creation and invitation remain entirely local/);
assert.match(html,/Für Follower öffentlich melden/);
assert.match(html,/Ohne Häkchen bleibt der Termin privat auf deinem Gerät/);
assert.match(html,/name="publicShare"/);
assert.match(community,/async function publish\(bookmark\)\{[\s\S]*?const session=await getSession\(false\)/);
const publicPublishing=community.slice(community.indexOf("async function publish("),community.indexOf("async function revoke("));
assert.doesNotMatch(publicPublishing,/getSession\(true\)|authRoot\+"signup"/);
assert.match(publicPublishing,/Ein neu erzeugtes|newly created anonymous UID|newly created anonymous/i);
assert.match(community,/const grantUrl=publicationGrantPath/);
assert.match(community,/hasPublicationGrant\(grants,bookmark.playerId\)/);
assert.match(community,/nicht automatisch zu einer öffentlichen Meldung/);
assert.doesNotMatch(community,/Bitte die Gerätekennung .* dem Betreiber/);
assert.match(grant,/AS RESTRICTIVE[\s\S]*FOR INSERT TO authenticated/);
assert.match(grant,/g\.revoked_at IS NULL/);
assert.match(grant,/AFTER INSERT OR UPDATE OR DELETE ON public\.player_publication_grants/);
assert.match(plan,/#139/);
assert.match(plan,/#140/);
assert.match(plan,/stellt \*\*noch keinen\*\* privaten Einladungslink/);
console.log("Guest-first access: public/local use stays login-free, public write still needs independently verified grant.");
