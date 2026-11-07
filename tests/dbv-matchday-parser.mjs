import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseDbvPlayerMatchday} from "../supabase/functions/dbv-matchday-sync/dbv-player-parser.mjs";
// Synthetic HTML only: no cookies, original HTML or real names in Git.
const uuid="836C93F3-7635-420B-B314-DEDB60884AB2",dbv="05-067866";
const link=(id,name)=>'<a href="/sport/player.aspx?id='+uuid.toLowerCase()+
 '&amp;player='+id+'" data-player-id="'+id+'" class="nav-link">'+
 '<span class="nav-link__value">'+name+'</span></a>';
const side=(players,won)=>'<div class="match__row'+(won?' has-won':' ')+'"><div class="match__row-title">'+
 players.map(([id,name])=>'<div class="match__row-title-value">'+link(id,name)+'</div>').join("")+'</div></div>';
function card({draw,title,round,sides,finished=false,when="",court="",score=[]}){
 return ['<li class="match-group__item"><div class="match"><div class="match__header">',
 '<span title="'+round+'" class="nav-link"><span class="nav-link__value">'+round+'</span></span>',
 '<a href="/sport/draw.aspx?id='+uuid.toLowerCase()+'&amp;draw='+draw+
 '" class="nav-link"><span class="nav-link__value">'+title+'</span></a></div>',
 '<div class="match__body"><div class="match__row-wrapper">',
 side(sides[0],finished),side(sides[1],false),
 '</div></div><div class="match__result">',
 ...score.map(([a,b])=>'<ul class="points"><li class="points__cell points__cell--won"> '+a+
 '</li><li class="points__cell"> '+b+'</li></ul>'),
 '</div><div class="match__btn"></div><div class="match__footer">',
 '<span><svg class="icon-clock nav-link__prefix"></svg><span class="nav-link__value">'+when+'</span></span>',
 '<span><svg class="icon-marker nav-link__prefix"></svg><span class="nav-link__value">'+court+'</span></span>',
 '</div></div></li>'].join("");
}
const completed=card({draw:9,title:"MX U15",round:"Round of 16",
 sides:[[[555,"Partner"] , [500,"Testspielerin"]],[[367,"Gegner A"],[368,"Gegnerin B"]]],
 finished:true,when:"Sa 07.11.2026 09:30",court:"Sporthalle - 09",score:[[21,19],[21,10]]});
const scheduled=card({draw:8,title:"ME U15",round:"Round of 16",
 sides:[[],[[500,"Testspielerin"]]],when:"Sa 07.11.2026 15:00",court:"Sporthalle"});
const bracket=card({draw:8,title:"ME U15",round:"Round of 32",
 sides:[[],[[500,"Testspielerin"]]]});
const unrelated=card({draw:11,title:"MD U15",round:"Round of 16",
 sides:[[[201,"Fremd A"]],[[202,"Fremd B"]]],when:"So 08.11.2026 10:00"});
const html='<html><head><title>Player - Test event</title></head><body><h1>Testspielerin ('+
 dbv+')</h1>'+completed+scheduled+bracket+unrelated+" ".repeat(4400)+'</body></html>';
const scope={tournamentId:uuid,dbvId:dbv,playerNo:500};
const rows=parseDbvPlayerMatchday(html,scope);
assert.equal(rows.length,2);
assert.equal(rows[0].source_match_id,"pv:500:9:round-of-16:1");
assert.equal(rows[0].status,"finished");
assert.equal(rows[0].winning_side,1);
assert.equal(rows[0].discipline,"XD");
assert.equal(rows[0].court,"09");
assert.equal(rows[0].scheduled_at,"2026-11-07T08:30:00.000Z");
assert.deepEqual(rows[0].games,[{number:1,side1:21,side2:19},{number:2,side1:21,side2:10}]);
assert.equal(rows[1].status,"scheduled");
assert.equal(rows[1].discipline,"WS");
assert.equal(rows[1].scheduled_at,"2026-11-07T14:00:00.000Z");
assert.equal(rows[1].winning_side,null);
assert.equal(rows[1].court,null);
assert.deepEqual(rows[1].games,[]);
assert.throws(()=>parseDbvPlayerMatchday(html,{...scope,dbvId:"05-000001"}),/identity/);
assert.throws(()=>parseDbvPlayerMatchday(html,{...scope,playerNo:999}),/unverified/);
assert.throws(()=>parseDbvPlayerMatchday(html,{...scope,tournamentId:"bad"}),/invalid/);
assert.throws(()=>parseDbvPlayerMatchday("cookie wall",scope),/length/);
const source=await readFile("supabase/functions/dbv-matchday-sync/index.ts","utf8");
const sql=await readFile("database/v250-dbvmatchday-atomic-store.sql","utf8");
const targets=await readFile("database/v250-dbvmatchday-targets-and-scheduler.sql","utf8");
const cleanup=await readFile("database/v250-dbvmatchday-cron.sql","utf8");
const client=await readFile("today-in-action.js","utf8");
assert.match(source,/CookiePurposes:"1"/);
assert.match(source,/rpc\/app_access_status/);
assert.doesNotMatch(source,/rpc\/dbv_matchday_cron_authorized|mode==="cron"/);
assert.match(source,/body\?\.mode!=="member"/);
assert.match(source,/app_invitation_required/);
assert.match(source,/parseDbvPlayerMatchday\(html/);
assert.match(source,/rpc\/dbv_matchday_store/);
assert.doesNotMatch(client,/fetch\(["']https:\/\/dbv\.turnier\.de/);
assert.match(client,/requestOfficialMatchday\(announced,signal\)/);
assert.match(sql,/dbv_identity_ambiguous/);
assert.match(sql,/REVOKE ALL ON FUNCTION public\.dbv_matchday_store/);
assert.doesNotMatch(targets,/cron\.schedule|dispatch_dbv_matchday/);
assert.match(cleanup,/cron\.unschedule/);
assert.match(cleanup,/DROP FUNCTION IF EXISTS private\.dispatch_dbv_matchday_v250/);
assert.match(client,/setInterval\(\(\)=>\{if\(location\.hash==="#turniere"&&!document\.hidden/);
assert.match(client,/Date\.now\(\)-\(officialWatchTimes\.get\(key\)\|\|0\)>=300000/);
console.log("DBV v250: own future/completed matches, Berlin time, field, no phantom games, security gates OK.");
