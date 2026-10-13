import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {summarizeTrophies} from "../scripts/trophy-stats.mjs";
const paths=["database/verified_player_access_and_trophies_v127.sql","scripts/private-trophy-source.mjs",
 "player-verification.js","player-access.js","history.js","dashboard.js","private-player-reader.js",
 "owner-admin.js","index.html","sw.js"];
const [sql,bridge,request,invite,history,home,accept,admin,html,sw]=await Promise.all(
 paths.map(path=>readFile(path,"utf8")));
const predicates=[
 [/reviewer_user_id <> r\.applicant_user_id/, "No self-approval for expanded player rights"],
 [/req\.applicant_user_id=actor/, "Reviewer cannot approve own verification"],
 [/player_management_reviewers v[\s\S]*v\.revoked_at IS NULL/, "Reviewer must be active"],
 [/status='approved'[\s\S]*r\.revoked_at IS NULL/, "Only current independent approval"],
 [/g\.revoked_at IS NULL/, "Revoked issuer grant must deny access"],
 [/scope_version=1 AND granted_sections=ARRAY\['profile','matches'\]/, "Legacy scope retained"],
 [/scope_version=2 AND granted_sections=ARRAY\['profile','trophies','matches'\]/, "New scope explicit"],
 [/i\.scope_version=2 AND i\.granted_sections@>ARRAY\['trophies'\]/, "Old invited sessions cannot see trophies"],
 [/i\.accepted_by=auth\.uid\(\)/, "Recipient session binding"],
 [/i\.revoked_at IS NULL/, "Invitation revocation check"],
 [/v\.result->>'verified'='true'/, "Source corroboration required"],
 [/v\.result->>'playerId'=p_dbv_id/, "Trophy player matches source"],
 [/v\.result->>'date'=e\.payload->>'event_date'/, "Date matching"],
 [/v\.result->'source'->>'url'=e\.payload->>'source_url'/, "Source link matching"],
 [/REVOKE ALL ON private_content\.player_management_requests FROM PUBLIC,anon,authenticated/, "No public request table access"],
 [/REVOKE ALL ON FUNCTION public\.private_player_trophies_read\(uuid\) FROM PUBLIC,anon,authenticated/, "No anonymous trophy read"],
 [/REVOKE ALL ON FUNCTION public\.private_owner_trophies_read\(text\) FROM PUBLIC,anon,authenticated/, "No anonymous owner read"]
];
for(const [pattern,message] of predicates)assert.match(sql,pattern,message);
assert.doesNotMatch(sql,/grant\s+select\s+on\s+(public\.tournament_placements|private_content\.spvgg_archive_evidence)/i);
assert.match(invite,/private_player_scope_capabilities/, "Client must handshake before creating new links");
assert.match(invite,/scopeVersion:2/, "New local invitation marked version 2");
assert.match(invite,/scopeMissing:true/, "No fallback to old scope");
assert.match(bridge,/getPrivateSession\(false\)/,"Trophy viewing must not create an account");
assert.match(bridge,/cache:"no-store"/);
assert.match(bridge,/acceptedPlayerInviteBindings\.v1/);
assert.doesNotMatch(bridge,/localStorage\.setItem|sessionStorage\.setItem|caches\.open/,
 "Never persist private trophy results on device or PWA cache");
assert.match(accept,/\[activeId,data\.player\.dbv_id\]/, "Bind accepted grant to exact DBV identity");
assert.match(request,/getPrivateSession\(true\)/, "Only explicit request creates technical session");
assert.match(request,/searchInvitationPlayers/, "Use existing filtered public player search");
assert.match(home,/trophyUnknown\?"–":num\(medals\[slot\.place\]\)/);
assert.match(history,/state\.state!=="ready"/);
assert.match(home,/requestPrivateTrophies\(selection\)/);
assert.match(history,/requestPrivateTrophies\(lastPlayer\)/);
assert.match(html,/player-verification\.js/);
assert.match(sw,/scripts\/private-trophy-source\.mjs/);
assert.match(sw,/player-verification\.js/);
assert.match(admin,/Selbstauskunft/, "Owner checkbox must not be misrepresented as independent verification");
const synthetic=[
 {id:"a",playerId:"99-000001",place:1,verified:true,date:"2026-10-01"},
 {id:"b",playerId:"99-000001",place:4,verified:true,date:"2026-10-02"},
 {id:"c",playerId:"99-000001",place:5,verified:true,date:"2026-10-03"},
 {id:"d",playerId:"99-000001",place:2,verified:false,date:"2026-10-04"}
];
assert.equal(summarizeTrophies([...synthetic,synthetic[0]]).total,2);
console.log("v127 security contract: independent grants, immutable legacy scopes and private trophy source.");
