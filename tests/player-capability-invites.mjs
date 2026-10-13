import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {freshToken} from "../scripts/private-invite-utils.mjs";

const [sql,acceptSql,reader,creator,view,html,sw,app]=await Promise.all([
 "database/private_player_capability_v115.sql","database/private_player_accept_once_v116.sql","private-player-reader.js",
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
assert.match(reader,/rpc\("private_player_invite_accept"/);
assert.match(reader,/rpc\("private_player_access_read"/);
assert.match(reader,/getPrivateSession\(true\)/);
assert.match(reader,/getPrivateSession\(false\)/);
assert.match(reader,/player-invite-accept/);
assert.match(reader,/schmetterlinge\.acceptedPlayerInvite\.v3/);
assert.match(reader,/document\.addEventListener\("visibilitychange"/);
assert.doesNotMatch(reader,/rpc\("private_player_invite_read"/);
assert.match(reader,/textContent=/);
assert.doesNotMatch(reader,/\.innerHTML|auth\/v1\/signup/i);
assert.match(view,/noindex,nofollow,noarchive/);
assert.match(view,/no-referrer/);
assert.match(view,/id="player-invite-accept"/);
assert.match(view,/id="player-invite-accepted"/);
assert.match(acceptSql,/accepted_by uuid references auth\.users\(id\) on delete cascade/i);
assert.match(acceptSql,/or accepted_at is not null\)\)>=20/i,"Persistent owner quota must include accepted shares");
assert.match(acceptSql,/and i\.accepted_by is null/);
assert.match(acceptSql,/and i\.expires_at>now\(\)/);
assert.match(acceptSql,/and i\.revoked_at is null/);
assert.match(acceptSql,/i\.accepted_by=auth\.uid\(\)/);
const readBlock=acceptSql.split("create or replace function private_content.player_access_session_read")[1]
  ?.split("create or replace function public.private_player_invite_accept")[0]||"";
assert.ok(readBlock.length>100,"Session-authorized read function exists");
assert.doesNotMatch(readBlock,/i\.expires_at\s*[<>]=?\s*now\(\)/,
 "Accepted access must survive the original invitation expiration");
assert.match(readBlock,/i\.revoked_at is null/);
assert.match(readBlock,/g\.revoked_at is null/);
assert.match(acceptSql,/select null::jsonb/,"Legacy bearer-only read must be disabled");
assert.match(acceptSql,/revoke all on function public\.private_player_invite_read\(text\)/i);
assert.doesNotMatch(acceptSql,/grant select on public\.(players|player_external_match_facts)/i);
assert.match(creator,/selectedInviteId/);
assert.match(creator,/records\(\)\.filter\(r=>r\.id!==rec\.id\)/);
assert.match(creator,/Link sieben Tage zur Annahme/);

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
console.log("Private player capability: 7-day one-time redemption, persistent scoped session until revoke, no browser table reads.");
