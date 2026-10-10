import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {computeMatchStats,availableYears} from "../scripts/match-stats.mjs";
const match=(id,discipline,side,winning_side,date,props={})=>({
 match_id:id,discipline,player_side:side,winning_side,
 match_date:date,match_status:"finished",countable:true,
 source_url:"https://dbv.turnier.de/tournament/verified",
 opponent_names:"Person Beispiel",tournament_name:"Nachgewiesenes Turnier",
 game_score:"21:18, 21:17",...props
});
const data=[
 match("a","Einzel",1,1,"2026-10-05"),
 match("b","Einzel",2,1,"2026-10-06"),
 match("c","Doppel",2,2,"2026-04-06"),
 match("d","Mixed",2,1,"2025-08-09"),
 match("e","Mixed",1,1,"2025-08-10",{match_status:"walkover",countable:false}),
 match("f","Einzel",1,null,"2026-07-10",{countable:false}),
 match("g","Einzel",1,1,"2026-07-10",{countable:false}),
 match("h","Mixed",1,1,"2026-07-10",{source_url:"",countable:false}),
 match("x","Doppel",1,1,"2026-06-01"),
 match("x","Doppel",1,2,"2026-06-01")
];
const all=computeMatchStats(data);
assert.equal(all.total,4);
assert.equal(all.wins,2);
assert.equal(all.losses,2);
assert.equal(all.rate,50);
assert.equal(all.excluded,5,"Each ambiguous match counted once as excluded");
assert.equal(all.total,all.wins+all.losses);
assert.equal(all.details.length,4);
assert.equal(computeMatchStats(data,{discipline:"Einzel"}).total,2);
assert.equal(computeMatchStats(data,{discipline:"Einzel"}).wins,1);
assert.equal(computeMatchStats(data,{discipline:"Doppel"}).wins,1);
assert.equal(computeMatchStats(data,{discipline:"Mixed"}).losses,1);
assert.equal(computeMatchStats(data,{year:"2025"}).total,1);
assert.equal(computeMatchStats(data,{year:"2026"}).total,3);
assert.deepEqual(availableYears(data),["2026","2025"]);
assert.equal(computeMatchStats([]).rate,null);
assert.equal(computeMatchStats([]).total,0);
assert.equal(computeMatchStats([match("u","Doppel",2,1,"2026-04-07")]).losses,1,
 "A doubles teammate on the losing side gets one loss, not a team-wide duplicate");
assert.equal(computeMatchStats([match("v","Mixed",2,2,"2026-04-07")]).wins,1,
 "A mixed teammate receives the official winning-side result");
const html=await readFile("index.html","utf8");
const main=await readFile("stats.js","utf8");
const sql=await readFile("database/player-match-observations.sql","utf8");
assert.match(html,/id="match-stats"/);
assert.match(html,/id="match-stats-discipline"/);
assert.match(html,/id="match-stats-year"/);
assert.match(main,/player_match_observations/);
assert.match(main,/Noch keine einzeln belegten Spiele verfügbar/);
assert.match(main,/external\.length>0/);
assert.match(sql,/security_invoker\s*=\s*true/);
assert.match(sql,/m\.status\s*=\s*'finished'/);
assert.match(sql,/source_match_id/);
assert.match(sql,/revoke all on public\.player_match_observations from public/);
console.log("Source-backed match stats: 4 countable, 5 excluded, zero-data safe, W/L and filters validated.");
