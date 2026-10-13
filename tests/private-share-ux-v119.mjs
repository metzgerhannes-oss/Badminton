import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [sql,owner,share,html,css,sw]=await Promise.all([
 "database/fix_private_player_invite_create_v119.sql",
 "owner-admin.js","player-access.js","index.html",
 "private-sharing.css","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(sql,/from private_content\.player_access_invites inv/i);
assert.match(sql,/inv\.expires_at>now\(\) or inv\.accepted_at is not null/i);
assert.doesNotMatch(sql,/\(expires_at>now\(\) or accepted_at is not null\)/i);
assert.match(sql,/g\.user_id=owner_id and g\.player_dbv_id=p_player_dbv_id/i);
assert.match(sql,/g\.revoked_at is null/i);
assert.match(sql,/pg_advisory_xact_lock/i);
assert.match(sql,/active invitation quota reached/i);
assert.match(sql,/token_digest/i);
assert.doesNotMatch(sql,/grant select on/i);
assert.match(html,/id="owner-admin-search"/);
assert.match(html,/id="owner-admin-candidates"/);
assert.match(html,/class="owner-admin-manual"/);
assert.match(owner,/localProfiles\(\)/);
assert.match(owner,/\.toLocaleLowerCase\("de"\)\.includes\(q\)/);
assert.match(owner,/verifiedIds\.has\(item\.id\)/);
assert.match(owner,/badminton:player-private-share/);
assert.match(owner,/manual\.open=true/);
assert.match(share,/private_owner_status/);
assert.match(share,/status\.granted_players\.includes\(dbvId\)/);
assert.match(share,/error\?\.code==="42501"/);
assert.match(share,/error\?\.code==="22023"/);
assert.match(share,/Technischer Fehler beim Erstellen/);
assert.match(share,/Spielerprofil, belegte Trophäen/);
assert.match(share,/private_player_invite_create_v2/);
assert.match(css,/#private-player-dialog\.private-player-share-dialog/);
assert.match(css,/overflow-y:auto/);
assert.match(html,/private-sharing\.css/);
assert.match(sw,/private-sharing\.css/);
console.log("v119: scoped DBV owner check, local name search and error transparency.");
