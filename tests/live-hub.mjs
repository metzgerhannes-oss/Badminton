import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {liveView,setText,playerOutcome} from "../scripts/live-radar.mjs";
const [html,app,hub,radar,dbv,css,sw]=await Promise.all([
 "index.html","app.js","live-hub.js","live-radar.js","live.js","design-v2.css","sw.js"
].map(f=>readFile(f,"utf8")));
const idCount=id=>(html.match(new RegExp('id="'+id+'"',"g"))||[]).length;
for(const id of ["home-live-peek","view-turniere","live-player-select","live-radar-content",
 "live-radar-refresh","dbv-live-results","dbv-live-refresh","dbv-live-advanced",
 "live-hub-sources","external-live-open","external-live-career","official-tournament-list",
 "add-tournament"]){
 assert.equal(idCount(id),1,"Each distinct UI element exists exactly once: "+id);
}
assert.match(html,/<script type="module" src="\.\/live-hub\.js"><\/script>/);
assert.ok(html.indexOf('id="home-live-peek"')<html.indexOf('id="dashboard-rankings"'),
 "Current match is visible ahead of rank cards on Home");
const start=html.indexOf('id="view-turniere"'),finish=html.indexOf('id="view-berichte"');
const tournament=html.slice(start,finish);
assert.ok(tournament.indexOf('id="live-player-select"')<tournament.indexOf('id="live-radar-content"'),
 "Player selection precedes live score");
assert.ok(tournament.indexOf('id="live-radar-content"')<tournament.indexOf('id="official-tournament-list"'),
 "Live view precedes bookmarks");
assert.ok(tournament.indexOf('id="dbv-live-advanced"')<tournament.indexOf('id="dbv-live-results"'),
 "Unused DBV query behind details");
assert.equal((tournament.match(/id="live-radar-refresh"/g)||[]).length,1);
assert.equal((html.match(/data-page="/g)||[]).length,4,"Four primary destinations");
assert.match(html,/data-page="start".*?<small>Home<\/small>/s);
assert.match(app,/function navigateHome\(\)/);
assert.match(app,/state\.viewingFriendId=null;\s*state\.chosen=state\.activeProfileId;/);
assert.match(app,/window\.badmintonSelectViewer/);
assert.match(app,/stayOnPage:true|stayOnPage=false/);
assert.match(app,/window\.badmintonLiveViewerOptions/);
assert.match(app,/window\.badmintonLibraryView=id/);
assert.match(hub,/window\.badmintonSelectViewer\?\.\(id,\{stayOnPage:true\}\)/);
assert.match(hub,/optgroup/);
assert.match(hub,/Meine Profile/);
assert.match(hub,/Freunde, denen ich folge/);
assert.match(hub,/home-live-peek/);
assert.match(hub,/readHome\(id\)/);
assert.match(hub,/liveView\(snapshot,id\)/);
assert.match(hub,/status==="playing"/);
assert.match(hub,/status==="next"/);
assert.match(hub,/snapshotUrl\(id\)/);
assert.doesNotMatch(hub,/watchRequest\(/,"Home must never poll the third-party source");
assert.match(hub,/homeCtrl\?\.abort/,"Stale Home responses are cancelled");
assert.match(radar,/location\.hash==="#turniere"/);
assert.match(radar,/document\.hidden/);
assert.match(dbv,/Boolean\(advanced\?\.open\)/,"No duplicate DBV polling unless opened");
assert.match(dbv,/addEventListener\("toggle"/);
assert.match(css,/\.home-live-peek\[hidden\]\{display:none!important\}/);
assert.match(css,/\.live-hub-toolbar select/);
assert.match(css,/\.live-hub-sources/);
assert.match(css,/\.live-hub-bookmarks/);
assert.match(sw,/live-hub\.js/);
assert.match(sw,/schmetterlinge-shell-v39/);
const t="2026-10-10T12:00:00Z",id="05-061350";
const base={source_url:"https://badhub.de/spieler/"+id+"/live",provider:"Badhub",checked_at:t,
 payload:{tournament:{name:"Jugendturnier"},running:null,next:null,upcoming:[],past:[],entries:[]}};
assert.equal(liveView(base,id,Date.parse(t)).status,"tournament");
assert.equal(liveView({...base,payload:{...base.payload,next:{queue_position:0}}},id,Date.parse(t)).status,"next");
assert.equal(liveView({...base,payload:{...base.payload,next:{queue_position:null}}},id,Date.parse(t)).status,"tournament");
assert.equal(liveView({...base,payload:{...base.payload,running:{sets:[[18,21]],is_team1:0}}},id,Date.parse(t)).status,"playing");
assert.equal(setText({sets:[[18,21]],is_team1:0}),"21:18");
assert.equal(playerOutcome({team1_won:true,is_team1:0}),"loss");
assert.equal(liveView({...base,checked_at:"2026-10-10T11:54:00Z"},id,Date.parse(t)).status,"stale");
console.log("Live hub: consolidated single task, in-place own/friend switch, Home-first freshness, lazy advanced feed, 6-tab nav and data-quality checks passed.");
