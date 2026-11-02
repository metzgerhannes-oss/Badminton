import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DBV_ID,watchRequest,snapshotPath,snapshotUrl,validSource,sourceSets,setText,opponents,matchLabel,
 freshness,validateSnapshot,liveView,radarSituation,playerOutcome,sourceTime,matchdayOverview,nextMatchTiming} from "../scripts/live-radar.mjs";
const id="05-061350";
assert.ok(DBV_ID.test(id));
assert.equal(watchRequest("local-123"),null);
assert.equal(snapshotUrl("not an id"),null);
assert.equal(snapshotPath("not an id"),null);
assert.match(snapshotPath(id),/^player_live_snapshots\?/);
assert.equal(snapshotUrl(id),"https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/"+snapshotPath(id));
assert.deepEqual(JSON.parse(watchRequest(id).body),{dbv_id:id});
assert.equal(watchRequest(id).headers.Prefer,"return=minimal");
assert.equal(watchRequest(id).url,"https://yadexibmjmnjfmfabrug.supabase.co/rest/v1/player_live_watches");
assert.match(snapshotUrl(id),/player_live_snapshots/);
assert.equal(validSource("https://badhub.de/spieler/05-061350/live",id),true);
assert.equal(validSource("https://attacker.test/spieler/05-061350/live",id),false);
const now=Date.parse("2026-10-10T12:00:00Z");
const idle={
 dbv_id:id,source_url:"https://badhub.de/spieler/05-061350/live",provider:"Badhub",
 checked_at:"2026-10-10T11:59:00Z",
 payload:{tournament:null,running:null,next:null,hero:null,upcoming:[],past:[],entries:[]}
};
assert.ok(validateSnapshot(idle,id));
assert.equal(liveView(idle,id,now).status,"idle");
assert.equal(liveView(idle,"05-070879",now).status,"unavailable");
assert.equal(liveView({...idle,checked_at:"2026-10-10T11:55:00Z"},id,now).status,"stale");
assert.equal(freshness(idle,now).ageMs,60000);
assert.equal(freshness({...idle,checked_at:"invalid"},now).fresh,false);
// Provider/device clock skew must not turn a future timestamp into
// permanently fresh LIVE evidence (pure synthetic snapshots; no network).
const nearFuture={...idle,checked_at:new Date(now+30000).toISOString()};
const farFuture={...idle,checked_at:new Date(now+5*60000).toISOString()};
assert.equal(freshness(nearFuture,now).fresh,true,"Small clock skew remains tolerated");
assert.equal(freshness(farFuture,now).fresh,false,"Future-dated provider evidence is not LIVE");
assert.equal(freshness(farFuture,now).ageMs,Infinity);
assert.equal(freshness({...idle,checked_at:new Date(now+30001).toISOString()},now).fresh,false);
assert.equal(liveView(farFuture,id,now).status,"stale");
assert.equal(radarSituation(farFuture,id,now).kind,"pending",
 "Future-dated empty result must not assert current no-tournament status");
assert.equal(radarSituation(idle,id,now).kind,"idle","Fresh empty source means no reported tournament");
const cold={...idle,checked_at:"2026-10-10T11:55:00Z"};
assert.equal(radarSituation(cold,id,now).kind,"idle","A 5-minute-old no-tournament response must not be an alarm");
assert.match(radarSituation(cold,id,now).detail,/Bei der letzten Prüfung/);
assert.equal(radarSituation(null,id,now).kind,"pending");
assert.equal(radarSituation({...idle,checked_at:"2026-10-10T11:00:00Z"},id,now).kind,"pending",
 "Yesterday or a very old no-tournament report cannot be called current");

const playing={...idle,payload:{
 tournament:{name:"Jugend-Turnier",key:"t1"},
 running:{class:"ME U17",opponent:"Spielerin A",is_team1:false,sets:[[21,17],[8,5]],court:"Feld 05"},
 next:null,hero:null,
 upcoming:[{class_label:"GD U17",planned_ts:1791621600000}],
 past:[],entries:[]
}};
assert.equal(liveView(playing,id,now).status,"playing");
assert.equal(radarSituation(playing,id,now).kind,"current");
const oldMatch={...playing,checked_at:"2026-10-10T11:55:00Z"};
assert.equal(radarSituation(oldMatch,id,now).kind,"updating","Old match MUST NOT masquerade as live");
assert.equal(radarSituation(oldMatch,id,now).showScore,false);
const futureMatch={...playing,checked_at:new Date(now+5*60000).toISOString()};
assert.equal(liveView(futureMatch,id,now).status,"stale");
assert.equal(radarSituation(futureMatch,id,now).kind,"updating");
assert.equal(radarSituation(futureMatch,id,now).showScore,false,
 "Future-dated active match must never display unverified LIVE scores");
assert.match(radarSituation(oldMatch,id,now).title,/Spielstand wird geprüft/);
assert.equal(radarSituation({...playing,source_url:"https://evil.test/live"},id,now).kind,"pending");

assert.equal(liveView({...playing,payload:{...playing.payload,running:null,next:{queue_position:0}}},id,now).status,"next");
assert.equal(liveView({...playing,payload:{...playing.payload,running:null,next:{queue_position:null}}},id,now).status,"tournament","Unknown queue position is not next");
assert.deepEqual(sourceSets(playing.payload.running),[[17,21],[5,8]],"Flip per player perspective");
assert.equal(setText(playing.payload.running),"17:21 · 5:8");
assert.equal(opponents({lineup:{opponents:[{name:"Mia A"},{name:"Mia B"}]}}),"Mia A / Mia B");
assert.equal(matchLabel(playing.payload.running),"ME U17");
assert.deepEqual(sourceSets({sets_json:"[[21,18],[19,21]]",is_team1:1}),[[21,18],[19,21]]);
assert.deepEqual(sourceSets({sets_json:"broken"}),[]);
assert.deepEqual(sourceSets({sets:[[-10,40],[999,1],[12,11]]}),[[12,11]]);
assert.equal(playerOutcome({team1_won:true,is_team1:true}),"win");
assert.equal(playerOutcome({team1_won:true,is_team1:1}),"win");
assert.equal(playerOutcome({team1_won:true,is_team1:0}),"loss");
assert.equal(playerOutcome({team1_won:true,is_team1:false}),"loss");
assert.equal(playerOutcome({team1_won:null,is_team1:true}),null);
assert.equal(sourceTime("invalid"),"");

const projected=nextMatchTiming({predicted_start_ts:now+15*60000,planned_ts:now+35*60000},now);
assert.equal(projected.kind,"forecast","Live provider projection outranks original start schedule");
assert.equal(projected.overdue,false);
assert.match(projected.time,/Uhr$/);
assert.equal(nextMatchTiming({planned_ts:now+35*60000},now).kind,"planned");
assert.equal(nextMatchTiming({predicted_start_ts:now-3*60000},now).overdue,true,
 "Elapsed provider projection must be explicitly flagged");
assert.equal(nextMatchTiming({predicted_start_ts:"not a timestamp",planned_ts:now+60000},now).kind,"planned");
assert.equal(nextMatchTiming({predicted_start_ts:"invalid",planned_ts:"invalid"},now).kind,"unknown");
assert.equal(nextMatchTiming({predicted_start_ts:now+60*60000},now-24*60*60000).kind,"forecast");
assert.match(nextMatchTiming({predicted_start_ts:now+24*60*60000},now).time,/\d{2}\.\d{2}\./,
 "Next-day start includes calendar date");
assert.equal(nextMatchTiming(null,now).time,"");
const scheduled={...playing,payload:{...playing.payload,running:null,
 next:{queue_position:1},upcoming:[
 {match_id:"next-match",class:"ME U17",opponent:"Beispiel A",planned_ts:now+20*60000},
 {match_id:"later-match",class:"GD U17",opponent:"Beispiel B",predicted_start_ts:now+90*60000}
]}};
const upcomingDay=matchdayOverview(scheduled,id,now);
assert.equal(upcomingDay.queue,1);
assert.equal(upcomingDay.upcoming.length,2);
assert.equal(upcomingDay.upcoming[0].match_id,"next-match");
assert.equal(matchdayOverview({...scheduled,checked_at:new Date(now-180000).toISOString()},id,now),null,
 "Expired provider schedule must not be displayed as current");

assert.ok(sourceTime(1791621600000).includes("Uhr"));
assert.equal(liveView({...idle,payload:{...idle.payload,upcoming:{}}},id,now).status,"unavailable");

const [html,js,sql,css,sw]=await Promise.all(["index.html","live-radar.js",
 "database/live-radar-on-demand.sql","design-v2.css","sw.js"].map(f=>readFile(f,"utf8")));
assert.match(html,/id="live-radar-content"/);
assert.match(html,/id="live-radar-refresh"/);
assert.match(html,/Originalquellen &amp; weitere Ergebnisse/);
assert.match(js,/badminton:profile-change/);
assert.match(js,/document.hidden/);
assert.match(js,/lastWatchAt/);
assert.match(js,/nextMatchPanel\(day\)/,"The next fixture leads the turn-day panel");
assert.match(js,/Date\.now\(\)-lastFetchedAt<300000/,"No repeat read before five minutes");
assert.match(js,/setInterval\([^\n]*300000\)/,"Turn-day auto refresh every five minutes");
assert.match(js,/Date\.now\(\)-lastWatchAt>300000/,"No extra watch request before five minutes");
assert.match(js,/message\("–"/,"Missing data uses a dash");
assert.match(js,/timing\.time\|\|"–"/,"Missing start uses a dash");
assert.match(js,/nextMatchTiming\(next\)/);
assert.match(js,/Zeiten können sich am Turniertag verschieben/);
assert.match(js,/sourceShortcut/);
assert.doesNotMatch(js,/fetch\(["']https:\/\/badhub\.de/i,
 "No direct provider polling in browser");
assert.match(js,/situation\.kind==="idle"|situation\.kind!=="current"/);
assert.match(js,/Bei Badhub prüfen/);
assert.doesNotMatch(js,/Live-Abgleich veraltet/,"Technical cache age must not be the headline");
assert.match(css,/\.live-radar-content\[data-state="idle"\]/);
assert.match(js,/sourceTime/);
assert.match(js,/readPublicRows\(snapshotPath\(id\),\{signal,count:false\}\)/,"Live radar uses shared GET client");
assert.doesNotMatch(js,/fetch\(snapshotUrl\(id\)/);
assert.match(sql,/enable row level security/g);
assert.match(sql,/grant insert\(dbv_id\)/);
assert.match(sql,/pg_advisory_xact_lock/);
assert.match(sql,/limit batch_size/);
assert.match(sql,/last_requested_at>now\(\)-interval '12 minutes'/);
assert.match(sql,/private\.refresh_live_radar\(6\)/);
assert.ok(!sql.includes("insert into public.matches"),"Never infer confirmed matches from matchday snapshots");
assert.match(css,/\.live-radar-panel/);
assert.match(sw,/live-radar\.js/);
assert.match(sw,/scripts\/live-radar\.mjs/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
console.log("Live radar: matchday idle/active/stale, perspective-safe scores, idempotent watches, RLS controls and iPhone UI passed.");
