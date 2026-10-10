import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DBV_ID,watchRequest,snapshotUrl,validSource,sourceSets,setText,opponents,matchLabel,
 freshness,validateSnapshot,liveView,radarSituation,playerOutcome,sourceTime} from "../scripts/live-radar.mjs";
const id="05-061350";
assert.ok(DBV_ID.test(id));
assert.equal(watchRequest("local-123"),null);
assert.equal(snapshotUrl("not an id"),null);
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
assert.match(js,/Wartestand/);
assert.match(js,/situation\.kind==="idle"|situation\.kind!=="current"/);
assert.match(js,/Bei Badhub prüfen/);
assert.doesNotMatch(js,/Live-Abgleich veraltet/,"Technical cache age must not be the headline");
assert.match(css,/\.live-radar-content\[data-state="idle"\]/);
assert.match(js,/sourceTime/);
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
assert.match(sw,/schmetterlinge-shell-v38/);
console.log("Live radar: matchday idle/active/stale, perspective-safe scores, idempotent watches, RLS controls and iPhone UI passed.");
