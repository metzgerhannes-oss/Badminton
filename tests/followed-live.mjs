import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {followedRoster,followedSnapshotPath,followedCard,followedCards,FOLLOW_LIMIT,shouldReplaceFollowedRequest} from "../scripts/followed-live.mjs";
const id="99-000001",friend="99-000002";
const roster=followedRoster({
 own:[{id,name:"Testperson A"},{id,name:"Doppelt"},{id:"bad",name:"Falsch"}],
 friends:[{id:friend,name:"Testperson B"},{id:"99-000003",name:"Testperson C"}],selected:friend
});
assert.equal(FOLLOW_LIMIT,6);
assert.equal(shouldReplaceFollowedRequest(false,"99-000001","99-000001"),true,
 "A new idle refresh is permitted");
assert.equal(shouldReplaceFollowedRequest(true,"99-000001","99-000001"),false,
 "Repeated events for the same roster must not restart a pending fetch");
assert.equal(shouldReplaceFollowedRequest(true,"99-000001","99-000002"),true,
 "A changed player selection must supersede a pending response");
assert.equal(shouldReplaceFollowedRequest(true,"99-000001,99-000002","99-000002,99-000001"),true,
 "Changing roster priority must supersede an older response");

assert.deepEqual(roster.players.map(x=>x.id),[friend,id,"99-000003"]);
assert.equal(roster.remaining,0);
assert.equal(followedRoster({friends:Array.from({length:9},(_,i)=>({
 id:"99-"+String(i).padStart(6,"0"),name:"Person "+i
 }))}).players.length,6);
assert.equal(followedRoster({friends:Array.from({length:9},(_,i)=>({
 id:"99-"+String(i).padStart(6,"0"),name:"Person "+i
 }))}).remaining,3);
assert.equal(followedSnapshotPath([]),null);
assert.equal(followedSnapshotPath([{id:"invalid"}]),null);
assert.match(followedSnapshotPath(roster.players),/^player_live_snapshots\?/);
assert.match(decodeURIComponent(followedSnapshotPath(roster.players)),/dbv_id=in\.\(99-000002,99-000001,99-000003\)/);
const now=Date.parse("2026-10-11T12:00:00Z");
const row={
 dbv_id:id,provider:"Badhub",source_url:"https://badhub.de/spieler/"+id+"/live",
 checked_at:new Date(now-30000).toISOString(),
 payload:{tournament:{name:"Jugendturnier",url:"https://unknown.test"},
 running:{class:"JE U11",opponent:"Gegner",sets:[[15,10],[5,7]],is_team1:true,court:"Feld 1"},
 next:{queue_position:0},upcoming:[],past:[],entries:[]}
};
const mine={id,name:"Testperson A",role:"own"};
const card=followedCard(mine,row,now);
assert.equal(card.kind,"current");
assert.equal(card.title,"Spielt gerade");
assert.equal(card.score,"15:10 · 5:7");
assert.match(card.detail,/Gegner/);
assert.equal(card.tournament,"Jugendturnier");
assert.equal(card.sourceUrl,"https://badhub.de/spieler/"+id+"/live");
const stale=followedCard(mine,{...row,checked_at:new Date(now-180000).toISOString()},now);
assert.notEqual(stale.kind,"current");
assert.equal(stale.score,"");
assert.equal(stale.result,"");
const future=followedCard(mine,{...row,checked_at:new Date(now+300000).toISOString()},now);
assert.notEqual(future.kind,"current",
 "Future-dated provider snapshots must not appear as a live followed-player card");
assert.equal(future.score,"");
assert.equal(future.result,"");
const spoof=followedCard(mine,{...row,source_url:"https://evil.test"},now);
assert.notEqual(spoof.kind,"current");
assert.equal(spoof.score,"");
const idle=followedCard(mine,{...row,payload:{tournament:null,running:null,next:null,upcoming:[],past:[],entries:[]}},now);
assert.equal(idle.kind,"idle");
assert.match(idle.title,/kein Turniertag/i);
assert.equal(followedCards([mine],[])[0].kind,"pending");
assert.equal(followedCards([mine],[{...row,dbv_id:friend}],now)[0].kind,"pending",
 "Another player's score never appears in the wrong player's card");
const [html,ui,css,sw,worker,radar]=await Promise.all([
 "index.html","followed-live.js","app-shell.css","sw.js",
 ".github/workflows/tests.yml","live-radar.js"
].map(p=>readFile(p,"utf8")));
assert.match(html,/src="\.\/followed-live\.js"/);
assert.equal((html.match(/id="followed-live-cards"/g)||[]).length,1);
assert.match(ui,/readPublicRows\(followedSnapshotPath\(players\)/);
assert.match(ui,/watchRequest\(p\.id\)/);
assert.match(ui,/Promise\.allSettled/);
assert.doesNotMatch(ui,/badhub\.de\/api|spieler_live\.php|service_role/);
assert.match(ui,/document\.hidden/);
assert.match(ui,/shouldReplaceFollowedRequest\(busy,rosterKey\(lastRoster\),ids\)/);
assert.match(ui,/const request=\+\+seq;[\s\S]*controller\?\.abort\(\)/,
 "A new roster invalidates and aborts the old request before fetching");
assert.match(ui,/lastRowsRosterIds=ids;checked=Date\.now\(\)/);
assert.match(ui,/ids!==rosterKey\(lastRoster\)\|\|ids!==lastRowsRosterIds/,
 "A changed roster never renders the previous roster cache while refreshing");
assert.match(ui,/ids===lastRowsRosterIds\?lastRows:\[\]/,
 "Fallback cache must belong to the last successfully fetched roster");
assert.doesNotMatch(ui,/ids===lastRoster\.map/,
 "The active roster is not proof that a previous cache belongs to it");
assert.match(ui,/window\.badmintonMatchdayMode==="all"/);
assert.match(css,/followed-live-grid/);
assert.match(sw,/followed-live\.js/);
assert.match(sw,/scripts\/followed-live\.mjs/);
assert.match(worker,/node tests\/followed-live\.mjs/);
assert.match(radar,/window\.badmintonMatchdayMode!=="all"/);
console.log("v88 followed LIVE: grouped public IDs, bounded on-demand reads, fresh-only scores, XSS-safe cards.");
