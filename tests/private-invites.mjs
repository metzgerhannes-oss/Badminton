import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {freshToken,tokenFromFragment,invitationLink,safeEvent,storedInvites,inviteKey} from "../scripts/private-invite-utils.mjs";
const valid="11111111-2222-4333-8444-555555555556";
const b={id:valid,url:"https://dbv.turnier.de/tournament/"+valid,
 name:"Jugendturnier",playerId:"99-100104",startDate:"2026-12-03",endDate:"2026-12-04"};
// Public fixtures must never contain actual tournament UUIDs or player identities.
assert.equal(valid,"11111111-2222-4333-8444-555555555556");
assert.match(b.playerId,/^99-/);
const tok=freshToken({getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=i}});
assert.equal(tok.length,64);
assert.equal(tok,"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
assert.equal(tokenFromFragment("#invite="+tok),tok);
assert.equal(tokenFromFragment("#invite="+tok+"%0a"),null);
assert.equal(tokenFromFragment("#profile="+tok),null);
assert.equal(invitationLink(tok,"https://example.com/app/index.html"),"https://example.com/app/private-invite.html#invite="+tok);
assert.deepEqual(safeEvent(b),{title:"Jugendturnier",start_date:"2026-12-03",end_date:"2026-12-04",source_url:b.url});
assert.ok(!JSON.stringify(safeEvent(b)).includes("99-100104"),"No player identity may enter shared payload");
assert.throws(()=>safeEvent({...b,url:"https://evil.example/"}),/DBV/);
assert.throws(()=>safeEvent({...b,startDate:"",endDate:""}),/Beginn/);
assert.throws(()=>safeEvent({...b,endDate:"2026-11-01"}),/Turnierzeitraum|Beginn/);
assert.deepEqual(storedInvites({"a|b":{id:valid,token:tok,expires:"2026-12-10T00:00:00Z"},"bad":{id:valid,token:"bad",expires:"2026-12-10T00:00:00Z"}}),
 {"a|b":{id:valid,token:tok,expires:"2026-12-10T00:00:00Z"}});
assert.equal(inviteKey(b),valid+"|99-100104");
const [html,reader,creator,app,sw,root,doc]=await Promise.all([
"private-invite.html","private-invite-reader.js","private-invites.js","app.js","sw.js",
"index.html","docs/ZUGRIFFSMODELL_V105.md"
].map(path=>readFile(path,"utf8")));
assert.match(html,/name="referrer" content="no-referrer"/);
assert.match(html,/name="robots" content="noindex/);
assert.match(reader,/history\.replaceState/);
assert.match(reader,/rpc\/private_tournament_invite_read/);
assert.doesNotMatch(reader,/auth\/v1\/signup/);
assert.doesNotMatch(reader,/player_dbv_id|owner_user_id|user_id/);
assert.match(creator,/rpc\/private_tournament_invite_create/);
assert.match(creator,/rpc\/private_tournament_invite_revoke/);
assert.match(creator,/function getPrivateSession/);
assert.match(creator,/getPrivateSession\(true\)/);
assert.match(creator,/getPrivateSession\(false\)/);
assert.match(creator,/freshToken\(\)/);
assert.match(creator,/INVITE_STORE/);
assert.match(app,/data-private-invite-id/);
assert.match(app,/badminton:private-invite/);
assert.match(sw,/private-invite-reader\.js/);
assert.match(root,/private-invites\.js/);
assert.match(doc,/v109 ergänzt die \*\*ausdrücklich ausgelöste private Einzelturnier-Einladung/);
console.log("Private invites: browser token entropy, privacy, read-only recipient and opt-in controls checked.");
