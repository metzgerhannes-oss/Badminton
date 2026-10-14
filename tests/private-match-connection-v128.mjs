import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,bridge,home,history,sw]=await Promise.all([
 "database/auto_archived_player_evidence_v128.sql",
 "scripts/private-match-source.mjs","stats.js","external-matches.js","sw.js"
].map(f=>readFile(f,"utf8")));
assert.match(sql,/has_independent_player_grant\(i\.owner_user_id,i\.player_dbv_id\)/);
assert.match(sql,/has_independent_player_grant\(auth\.uid\(\),p\.dbv_id\)/);
assert.match(sql,/i\.accepted_by=auth\.uid\(\)/);
assert.match(sql,/i\.scope_version=2/);
assert.match(sql,/i\.revoked_at is null/);
assert.match(sql,/i\.granted_sections @> ARRAY\['profile','trophies','matches'\]/);
assert.match(sql,/grant execute on function public\.private_player_owner_archive_read/);
assert.match(sql,/revoke all on function public\.private_player_owner_archive_read/);
assert.doesNotMatch(sql,/grant select on/i);
assert.match(bridge,/getPrivateSession\(false\)/);
assert.match(bridge,/acceptedPlayerInviteBindings\.v1/);
assert.match(bridge,/cache:"no-store"/);
assert.doesNotMatch(bridge,/localStorage\.setItem|sessionStorage\.setItem|caches\.open/);
assert.match(bridge,/private_player_owner_archive_read/);
assert.match(bridge,/private_player_archive_read/);
assert.match(bridge,/badminton:profile-change/);
assert.match(bridge,/badminton:private-player-revoked/);
assert.match(home,/matchArchiveSnapshot/);
assert.match(history,/matchArchiveSnapshot/);
assert.match(sw,/scripts\/private-match-source\.mjs/);
console.log("Private archive sync authorization, cache and integration checks passed.");
