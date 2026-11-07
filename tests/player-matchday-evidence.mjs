import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {officialPlayerGames,badhubPlayerGames,gameFormat,ownTournamentGameGroups} from "../scripts/player-matchday-evidence.mjs";

const dbv="836C93F3-7635-420B-B314-DEDB60884AB2";
const player="05-067866",other="05-000001";
const tid="6baff258-0fb5-4a2a-9a0d-78f5eea47012";
const match="bcf6d3be-1fde-4e61-a12d-392200ff216a";
const now=Date.parse("2026-11-07T09:00:00+01:00");
const official={
 id:match,tournament_id:tid,status:"playing",
 scheduled_at:"2026-11-07T10:20:00+01:00",court:"2",
 source_url:"https://dbv.turnier.de/tournament/"+dbv,
 last_synced_at:new Date(now-10000).toISOString(),
 events:{title:"ME U15",discipline:"ME"},
 match_participants:[
  {side:1,player_position:1,players:{dbv_id:player,name:"Testspielerin A"}},
  {side:2,player_position:1,players:{dbv_id:other,name:"Testspielerin B"}}
 ],match_games:[{game_number:1,side1_points:21,side2_points:15}]
};
const result=officialPlayerGames([official],tid,player,dbv,now);
assert.equal(result.length,1);
assert.equal(result[0].category,"live");
assert.equal(result[0].live,true);
assert.equal(result[0].court,"2");
assert.deepEqual(result[0].sets,["21:15"]);
assert.match(result[0].side2,/Testspielerin B/);
assert.equal(result[0].sourceUrl,"https://dbv.turnier.de/tournament/"+dbv);
assert.equal(result[0].format,"Einzel");
assert.equal(result[0].opponent,"Testspielerin B");
assert.equal(gameFormat("MD U15"),"Doppel");
assert.equal(gameFormat("MXD U17"),"Mixed");
assert.equal(gameFormat("Jungen U15"),"");
const completed={
 ...official,id:"bcf6d3be-1fde-4e61-a12d-392200ff216b",
 status:"finished",court:"5",scheduled_at:"2026-11-07T07:30:00+01:00",
 events:{title:"MX U15"},
 match_participants:[
  {side:1,player_position:1,players:{dbv_id:other,name:"Synthetischer Gegner"}},
  {side:2,player_position:1,players:{dbv_id:player,name:"Testspielerin A"}}
 ],
 match_games:[
  {game_number:1,side1_points:19,side2_points:21,finished:true},
  {game_number:2,side1_points:22,side2_points:24,finished:true}
 ]
};

const officialWin=officialPlayerGames([{...completed,winning_side:2}],tid,player,dbv,now)[0];
const officialLoss=officialPlayerGames([{...completed,winning_side:1}],tid,player,dbv,now)[0];
const officialUnknown=officialPlayerGames([completed],tid,player,dbv,now)[0];
assert.equal(officialWin.outcome,"Sieg");
assert.equal(officialLoss.outcome,"Niederlage");
assert.equal(officialUnknown.outcome,"","Unknown official winner must remain neutral");
assert.equal(officialPlayerGames([{...official,winning_side:1}],tid,player,dbv,now)[0].outcome,"",
 "Never mark an unfinished match as won");
const {playerMatchesPath}=await import("../scripts/tournament-live.mjs");
assert.match(playerMatchesPath(tid,[player]),/winning_side/);
const opponentMatch={
 ...completed,id:"bcf6d3be-1fde-4e61-a12d-392200ff216c",
 match_participants:[
  {side:1,player_position:1,players:{dbv_id:other,name:"Nur fremde Partie"}},
  {side:2,player_position:1,players:{dbv_id:"05-000002",name:"Fremde Gegnerin"}}
 ]
};
const personalMatches=officialPlayerGames([completed,opponentMatch,official],tid,player,dbv,now);
const grouped=ownTournamentGameGroups(personalMatches);
assert.equal(personalMatches.length,2,"Only the exact player's own official matches");
assert.equal(grouped.finished.length,1,"Completed matches are separately visible");
assert.equal(grouped.upcoming.length,1);
assert.equal(grouped.other.length,0);
assert.equal(grouped.finished[0].opponent,"Synthetischer Gegner");
assert.equal(grouped.finished[0].format,"Mixed");
assert.equal(grouped.finished[0].court,"5");
assert.deepEqual(grouped.finished[0].sets,["21:19","24:22"],
 "A finished match is scored from the followed player's side");
assert.equal(ownTournamentGameGroups(officialPlayerGames([
 {...completed,status:"walkover"}
],tid,player,dbv,now)).finished.length,0,
 "Walkover must not be shown as a played game");
assert.equal(officialPlayerGames([{...completed,match_participants:[
 {side:1,player_position:1,players:{dbv_id:player,name:"Testspielerin A"}},
 {side:2,player_position:1,players:{dbv_id:player,name:"Testspielerin A"}}
]}],tid,player,dbv,now).length,0,
 "Ambiguous double-sided player identities are rejected");

assert.equal(officialPlayerGames([{...official,match_participants:[
 {side:1,participant_name:"Testspielerin A",players:null},
 {side:2,participant_name:"Testspielerin B",players:null}
]}],tid,player,dbv,now).length,0,
 "Names cannot prove DBV identity");
assert.equal(officialPlayerGames([{...official,tournament_id:"6baff258-0fb5-4a2a-9a0d-78f5eea47013"}],tid,player,dbv,now).length,0);
assert.equal(officialPlayerGames([{...official,source_url:"https://dbv.turnier.de/tournament/00000000-0000-0000-0000-000000000000"}],tid,player,dbv,now).length,0);
assert.equal(officialPlayerGames([official],tid,"05-999999",dbv,now).length,0);
assert.equal(officialPlayerGames([{...official,source_url:"https://evil.example/tournament/"+dbv}],tid,player,dbv,now).length,0,
 "A forged match source must never be branded as an official DBV match");
assert.equal(officialPlayerGames([{...official,source_url:"https://dbv.turnier.de/tournament/"+dbv+"/match/123"}],tid,player,dbv,now).length,1,
 "A genuine official per-match path remains admissible");
assert.equal(officialPlayerGames([official,official],tid,player,dbv,now).length,1);
assert.equal(officialPlayerGames([{...official,last_synced_at:new Date(now-300000).toISOString()}],tid,player,dbv,now)[0].live,false,
 "No stale match may retain live status");
assert.deepEqual(officialPlayerGames([official],tid,player,"unknown",now),[]);

const snapshot={
 dbv_id:player,provider:"Badhub",
 source_url:"https://badhub.de/spieler/"+player+"/live",
 checked_at:new Date(now-30000).toISOString(),
 payload:{
  tournament:{name:"Testturnier"},
  entries:[],next:{queue_position:1},
  running:{id:"m1",class:"ME U15",court:"1",
   lineup:{opponents:[{name:"Gegnerin Eins"}]},
   sets:[[21,17]],is_team1:true},
  upcoming:[{id:"m2",class:"MX U15",court:"3",
   planned_ts:now+3600000,lineup:{opponents:[{name:"Gegner Zwei"}]}}],
  past:[{id:"m3",class:"MD U15",team1_won:true,is_team1:true,
   lineup:{opponents:[{name:"Gegner Drei"}]},sets:[[21,16],[21,18]]}]
 }
};
let playerDay=badhubPlayerGames(snapshot,player,now);
assert.equal(playerDay.tournament,"Testturnier");
assert.equal(playerDay.games.length,3);
assert.equal(playerDay.games[0].status,"Spielt gerade");
assert.equal(playerDay.games[0].opponent,"Gegnerin Eins");
assert.equal(playerDay.games[0].score,"21:17");
assert.equal(playerDay.games[1].status,"Noch 1 Spiel davor");
assert.match(playerDay.games[1].when,/Geplant/);
assert.equal(playerDay.games[1].score,"");
assert.equal(playerDay.games[2].outcome,"Sieg");
assert.equal(playerDay.games[2].score,"21:16 · 21:18");
assert.equal(playerDay.games[1].format,"Mixed");
assert.equal(playerDay.games[2].format,"Doppel");
assert.equal(ownTournamentGameGroups(playerDay.games).finished.length,1);
playerDay=badhubPlayerGames(snapshot,player,now+121000);
assert.equal(playerDay.dated,true);
assert.ok(playerDay.games.length>=1);
assert.ok(playerDay.games.every(g=>g.status!=="Spielt gerade"&&!g.score),
 "No live claim or stale score after 120 seconds");
assert.deepEqual(badhubPlayerGames(snapshot,player,now+300001).games,[]);
assert.deepEqual(badhubPlayerGames({...snapshot,source_url:"https://bad.site/redirect"},player,now).games,[]);
assert.deepEqual(badhubPlayerGames(snapshot,other,now).games,[]);
assert.deepEqual(badhubPlayerGames({...snapshot,dbv_id:other},player,now).games,[],
 "Cross-player snapshots cannot reuse a matching source URL");
assert.deepEqual(badhubPlayerGames({...snapshot,payload:{...snapshot.payload,tournament:null}},player,now).games,[]);

const client=await readFile("today-in-action.js","utf8");
const presentation=await readFile("scripts/today-presentation.mjs","utf8");
const css=await readFile("today-in-action.css","utf8");
assert.match(presentation,/playerId,kind:"announced"/);
assert.match(client,/officialPlayerGames\(/);
assert.match(client,/badhubPlayerGames\(/);
assert.match(client,/playerMatchesPath\(selected\.id,item\.ids\)/);
assert.match(client,/watchAnnounced\(announced,signal\)/);
assert.match(client,/setInterval\(\(\)=>\{if\(location\.hash==="#turniere"/);
assert.match(client,/Teilnahme.*?angekündigt|Noch keine belegten Einzelspiele/s);
assert.match(css,/\.today-games-panel/);
assert.match(css,/today-game-group-heading/);
assert.match(client,/Bereits gespielt/);
assert.match(client,/dataset\.outcome/);
assert.match(css,/data-outcome="win"/);
assert.match(css,/data-outcome="loss"/);
assert.match(client,/Spielform:/);
assert.match(client,/Gegner:/);
assert.match(client,/lastOfficialFailures/);
console.log("v249: own-player tournament games, server-side identity filter, past games, score orientation, expiry: OK.");
