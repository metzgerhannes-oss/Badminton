import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,ui,controller,reader,gate]=await Promise.all([
 "database/app-access-overview-v138.sql",
 "scripts/owner-invites-overview.mjs",
 "invite.js",
 "scripts/private-match-source.mjs",
 "app-access.js"
].map(path=>readFile(path,"utf8")));
assert.match(sql,/auth\.uid\(\) is null or not exists/);
assert.match(sql,/from private_content\.site_owners/);
assert.match(sql,/where i\.issuer=auth\.uid\(\)/);
assert.match(sql,/grant execute on function public\.app_access_invites_overview\(\) to authenticated/);
assert.match(sql,/revoke all on function public\.app_access_invites_overview\(\) from public,anon,authenticated/);
assert.doesNotMatch(sql,/i\.secret_digest/);
assert.doesNotMatch(sql,/m\.user_id/);
assert.match(ui,/app_access_invites_overview/);
assert.match(ui,/app_access_invite_revoke/);
assert.match(ui,/Annahmezahlen erfassen technische Zugänge, keine Personen/);
assert.match(controller,/mountOwnerInviteOverview/);
assert.match(reader,/readMemberMatches/);
assert.match(reader,/readPublicRows\("player_external_match_facts\?"/);
assert.match(gate,/private_player_access_read/);
assert.match(gate,/grant\(\{member:false\}\)/);
console.log("v138: narrow player access and aggregate owner invitation overview contracts verified.");
