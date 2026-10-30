import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {freshToken,tokenFromFragment,invitationLink,safeEvent,storedInvites,inviteKey} from "../scripts/private-invite-utils.mjs";
import {reconcileIssuedInvite,checkIssuedInviteForSharing} from "../scripts/owner-invites-overview.mjs";
const valid="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const issued={id:"11111111-2222-4333-8444-555555555555",
 secret:"synthetic-no-real-link",expires:"2026-11-20T00:00:00Z",revoked:false};
const revokedRow={id:issued.id,revoked_at:"2026-10-29T19:00:00Z"};
assert.deepEqual(reconcileIssuedInvite(issued,[revokedRow]),{...issued,revoked:true},
 "Only an exact server-confirmed revocation can invalidate the local copy/share link");
assert.equal(reconcileIssuedInvite(issued,[{...revokedRow,id:valid}]),null,
 "Revoking another owner's link must never alter the local link");
assert.equal(reconcileIssuedInvite(issued,[]),null,
 "An invite missing from a bounded overview is NOT proof of revocation");
assert.equal(reconcileIssuedInvite(issued,[{...revokedRow,revoked_at:null}]),null);
assert.equal(reconcileIssuedInvite({...issued,revoked:true},[revokedRow]),null);
assert.equal(reconcileIssuedInvite({...issued,id:"not-an-id"},[revokedRow]),null);

// #187/#227: only server-confirmed, non-revoked invitations may be shared.
const serverActive={id:issued.id,revoked_at:null,redeem_until:"2026-11-10T00:00:00Z"};
const now=Date.parse("2026-10-30T09:00:00Z");
assert.deepEqual(checkIssuedInviteForSharing(issued,[serverActive],now),
 {status:"active",expires:"2026-11-10T00:00:00.000Z"});
assert.deepEqual(checkIssuedInviteForSharing(issued,[{...serverActive,revoked_at:"2026-10-29T00:00:00Z"}],now),
 {status:"revoked"},"Remote revocation takes precedence over local cached expiry");
assert.deepEqual(checkIssuedInviteForSharing(issued,[{...serverActive,redeem_until:"2026-10-01T00:00:00Z"}],now),
 {status:"expired",expires:"2026-10-01T00:00:00.000Z"});
assert.deepEqual(checkIssuedInviteForSharing(issued,[],now),{status:"unverified"},
 "Missing row in a bounded list is not evidence that a cached token is safe");
assert.deepEqual(checkIssuedInviteForSharing(issued,[{...serverActive,id:valid}],now),{status:"unverified"});
assert.deepEqual(checkIssuedInviteForSharing(issued,[{...serverActive,redeem_until:"invalid"}],now),
 {status:"unverified"},"Malformed server deadlines must not authorize sharing");
assert.deepEqual(checkIssuedInviteForSharing(issued,null,now),{status:"unverified"});

assert.deepEqual(checkIssuedInviteForSharing({...issued,revoked:true},[serverActive],now),
 {status:"revoked"},"A previously revoked local bearer link cannot be revived by stale server metadata");
assert.deepEqual(checkIssuedInviteForSharing({...issued,expires:"2026-10-29T00:00:00Z"},[serverActive],now),
 {status:"expired",expires:"2026-10-29T00:00:00.000Z"},
 "Server metadata must not silently extend the locally expired bearer link");
assert.deepEqual(checkIssuedInviteForSharing({...issued,expires:"invalid"},[serverActive],now),
 {status:"unverified"},"A missing or malformed local expiry cannot authorize sharing");
assert.deepEqual(checkIssuedInviteForSharing({...issued,expires:"2026-11-01T00:00:00Z"},[serverActive],now),
 {status:"active",expires:"2026-11-01T00:00:00.000Z"},
 "The earlier of local and server expiry always bounds the shareable link");


const b={id:valid,url:"https://dbv.turnier.de/tournament/"+valid,
 name:"Jugendturnier",playerId:"05-070879",startDate:"2026-12-03",endDate:"2026-12-04"};
const tok=freshToken({getRandomValues:a=>{for(let i=0;i<a.length;i++)a[i]=i}});
assert.equal(tok.length,64);
assert.equal(tok,"000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
assert.equal(tokenFromFragment("#invite="+tok),tok);
assert.equal(tokenFromFragment("#invite="+tok+"%0a"),null);
assert.equal(tokenFromFragment("#profile="+tok),null);
assert.equal(invitationLink(tok,"https://example.com/app/index.html"),"https://example.com/app/private-invite.html#invite="+tok);
assert.deepEqual(safeEvent(b),{title:"Jugendturnier",start_date:"2026-12-03",end_date:"2026-12-04",source_url:b.url});
assert.ok(!JSON.stringify(safeEvent(b)).includes("05-070879"),"No player identity may enter shared payload");
assert.throws(()=>safeEvent({...b,url:"https://evil.example/"}),/DBV/);
assert.throws(()=>safeEvent({...b,startDate:"",endDate:""}),/Beginn/);
assert.throws(()=>safeEvent({...b,endDate:"2026-11-01"}),/Turnierzeitraum|Beginn/);
assert.deepEqual(storedInvites({"a|b":{id:valid,token:tok,expires:"2026-12-10T00:00:00Z"},"bad":{id:valid,token:"bad",expires:"2026-12-10T00:00:00Z"}}),
 {"a|b":{id:valid,token:tok,expires:"2026-12-10T00:00:00Z"}});
assert.equal(inviteKey(b),valid+"|05-070879");
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
