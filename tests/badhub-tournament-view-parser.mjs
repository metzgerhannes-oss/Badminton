import assert from "node:assert/strict";
import {parseTournamentPlayerView} from "../scripts/badhub-tournament-view-parser.mjs";
import {computeExternalStats} from "../scripts/external-match-stats.mjs";

// Synthetic fixture: never embed minors' source pages or personal results in CI.
const player={id:"05-000001",dbv_id:"05-000001",name:"Demo Spieler"};
const other1={id:"05-000002",name:"Gegner Eins"};
const other2={id:"05-000003",name:"Gegner Zwei"};
const partner={id:"05-000004",name:"Demo Partner"};
const otherPartner={id:"05-000005",name:"Gegner Partner"};
const anchor=x=>'<a href="?id=4185&amp;player='+x.id+'"><span class="name-full">'+x.name+'</span></a>';
const card=(home,guest,games,winningSide)=>'<tr class="bericht-row won--'+(winningSide===1?"home":"guest")+'">'+
 '<td class="td-player td-player--home">'+home.map(anchor).join(" ")+'</td>'+
 '<td class="td-satz">'+games.map(([a,b])=>'<span class="set-score">'+a+':'+b+'</span>').join(" ")+'</td>'+
 '<td class="td-player td-player--guest">'+guest.map(anchor).join(" ")+'</td></tr>';
const pagePrefix='<title>Demoturnier – Badhub</title>'+
 '<div class="staffel-hero__top"><a href="?id=4185" class="staffel-hero__back">← Demo Jugendturnier 2026</a>'+
 '<h1 class="staffel-hero__name">Demo Spieler</h1></div>'+
 '<span class="vc-stat__val">11. Jul 2026</span>';
const section=(event,round,rows)=>
 '<div class="tm-phase-label">'+event+'</div><div class="tm-group-header tm-group-header--ko">'+round+'</div>'+rows;
const html=pagePrefix+
 section("JE U13","Viertelfinale",card([other1],[player],[[15,4],[15,9]],1))+
 section("JE U13","Halbfinale",card([other2],[player],[[15,7],[15,4]],1))+
 section("JE U13","Finale",card([player],[other1],[[15,9],[15,11]],1))+
 section("MxD U13","Viertelfinale",card([other1,otherPartner],[player,partner],[[9,15],[15,11],[15,4]],1))+
 section("MxD U13","Halbfinale",card([other2,otherPartner],[player,partner],[[15,11],[15,6]],1));
const parsed=parseTournamentPlayerView(html,player,{tournamentId:4185});
assert.equal(parsed.cards_seen,5);
assert.equal(parsed.items.length,5);
assert.equal(parsed.coverage,"tournament_only_not_career");
assert.deepEqual(parsed.rejection_reasons,{});
assert.equal(parsed.items[0].source_url,"https://badhub.de/bwbv/turnier.php?id=4185");
assert.equal(parsed.items[0].match_date,"2026-07-11");
assert.equal(parsed.items[0].competition,"Demo Jugendturnier 2026");
assert.equal(parsed.items[0].event,"JE U13");
assert.equal(parsed.items[0].player_side,2);
assert.equal(parsed.items[0].winning_side,1);
assert.deepEqual(parsed.items[0].games,[[15,4],[15,9]]);
assert.equal(parsed.items[2].player_side,1);
assert.equal(parsed.items[2].winning_side,1);
assert.equal(parsed.items[3].discipline,"Mixed");
assert.deepEqual(parsed.items[3].partner_names,["Demo Partner"]);
assert.deepEqual(parsed.items[3].opponent_names,["Gegner Eins","Gegner Partner"]);
assert.ok(parsed.items.every(m=>m.source_key.startsWith("tournament:4185:")));
assert.equal(new Set(parsed.items.map(m=>m.source_key)).size,5);
const totals=computeExternalStats(parsed.items);
assert.equal(totals.total,5);
assert.equal(totals.wins,1);
assert.equal(totals.losses,4);
assert.equal(totals.excluded,0);
assert.throws(()=>parseTournamentPlayerView(html,{dbv_id:"05-000009",name:"Falsch"}, {tournamentId:4185}),/identity/);
assert.throws(()=>parseTournamentPlayerView(html,player,{tournamentId:9999}),/id or heading/);
const wrongWin=html.replace('won--home','won--guest');
assert.equal(parseTournamentPlayerView(wrongWin,player,{tournamentId:4185}).items.length,4,
 "A published winner inconsistent with sets must be rejected");
const doubleCard=html+section("JE U13","Finale",card([player],[other1],[[15,9],[15,11]],1));
assert.equal(parseTournamentPlayerView(doubleCard,player,{tournamentId:4185}).items.length,4,
 "Multiple cards with identical source identity must not be counted");
const bye=html.replace(/<span class="set-score">15:9<\/span>\s*<span class="set-score">15:11<\/span>/,
 "BYE");
assert.equal(parseTournamentPlayerView(bye,player,{tournamentId:4185}).items.length,4);
assert.throws(()=>parseTournamentPlayerView(html.slice(0,100),player,{tournamentId:4185}));
console.log("Tournament player view: 5 synthetic sourced matches, outcome proof, dedupe and privacy gates OK.");
