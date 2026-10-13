import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {freshToken} from "../scripts/private-invite-utils.mjs";

const [sql,reader,creator,view,html,sw,app]=await Promise.all([
 "database/private_player_capability_v115.sql","private-player-reader.js",
 "player-access.js","private-player.html","index.html","sw.js","app.js"
].map(file=>readFile(file,"utf8")));

const token=freshToken({getRandomValues(buffer){for(let i=0;i<buffer.length;i++)buffer[i]=i;}});
assert.match(token,/^[a-f0-9]{64}$/,"256-bit browser token");
assert.match(sql,/token_digest bytea not null unique/i);
assert.match(sql,/extensions\.digest\(pg_catalog\.decode\(p_token,'hex'\),'sha256'\)/i);
assert.match(sql,/expires_at[^\n]*interval '7 days'/i);
assert.match(sql,/revoked_at is null/i);
assert.match(sql,/player_publication_grants g/i);
assert.match(sql,/g\.user_id=owner_id and g\.player_dbv_id=p_player_dbv_id/i);
assert.match(sql,/g\.user_id=i\.owner_user_id and g\.player_dbv_id=i\.player_dbv_id/i);
assert.match(sql,/g\.revoked_at is null/i);
assert.match(sql,/pg_advisory_xact_lock/i);
assert.match(sql,/limit 30/i);
assert.match(sql,/revoke all on private_content\.player_access_invites from public,anon,authenticated/i);
assert.doesNotMatch(sql,/grant select on public\.(players|player_external_match_facts)/i);
assert.match(sql,/security definer set search_path=''/i);
assert.match(sql,/private_player_invite_create/i);
assert.match(sql,/private_player_invite_read/i);
assert.match(sql,/private_player_invite_revoke/i);
assert.match(reader,/history\.replaceState\(null,"",location\.pathname\+location\.search\)/);
assert.match(reader,/cache:"no-store"/);
assert.match(reader,/rpc\/private_player_invite_read/);
assert.match(reader,/textContent=/);
assert.doesNotMatch(reader,/\.innerHTML|auth\/v1\/signup|localStorage/i);
assert.match(view,/noindex,nofollow,noarchive/);
assert.match(view,/no-referrer/);
assert.match(creator,/getPrivateSession\(true\)/);
assert.match(creator,/getPrivateSession\(false\)/);
assert.match(creator,/private_player_invite_create/);
assert.match(creator,/private_player_invite_revoke/);
assert.match(creator,/freshToken\(\)/);
assert.match(creator,/Eine DBV-ID oder ein lokales Profil genügt nicht/);
assert.match(html,/player-access\.js/);
assert.match(sw,/private-player-reader\.js/);
assert.match(app,/data-share-player/);
assert.match(app,/badminton:player-private-share/);
assert.ok(!sql.includes("set role supabase_admin"));
console.log("Private player capability: verified ownership, scope, revocation, token handling, no browser table reads.");
