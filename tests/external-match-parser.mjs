import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parsePublicHistory,tournamentStart,leagueStart} from "../scripts/badhub-history-parser.mjs";
const head="<title>Sarah Storz – Spielerprofil – Badhub</title>";
const games='<div class="sp-result-col"><div class="sp-set-score"><span class="sp-s">21</span><span class="sp-colon">:</span><span class="sp-s">18</span></div><div class="sp-set-score"><span class="sp-s">21</span><span class="sp-colon">:</span><span class="sp-s">13</span></div></div>';
const card='<div class="sp-match-item sp-match-item--t-won"><div class="sp-match-body">'+
 '<div class="sp-side sp-side--winner"><span class="sp-player-name sp-player-name--self"><span class="sp-name-full">Sarah Storz</span></span></div>'+
 games+'<div class="sp-side sp-side--away"><span class="sp-player-name"><span class="sp-name-full">Test Gegnerin</span></span></div></div></div>';
const tour=head+'<div class="card sp-tournament-card"><div class="sp-tournament-header"><strong class="sp-tournament-name">'+
 '<a href="/bwbv/turnier.php?id=4986">Jugend-Turnier</a></strong><span class="sp-tournament-meta">3.–4. Oct 2026</span></div>'+
 '<div class="sp-meeting"><span class="sp-t-event-badge">ME U17</span><div class="sp-t-phase-header">Finale</div>'+card+'</div></div>';
const player={dbv_id:"05-061350",name:"Sarah Storz"};
assert.equal(tournamentStart('<span class="sp-tournament-meta">3.–4. Oct 2026</span>'),"2026-10-03");
assert.equal(leagueStart('<span class="sp-date-dm">09.10.</span><span class="sp-date-y">2026</span>'),"2026-10-09");
const result=parsePublicHistory(tour,player,"tournament");
assert.equal(result.cards_seen,1);
assert.equal(result.items.length,1);
const m=result.items[0];
assert.equal(m.competition_id,"4986");
assert.equal(m.discipline,"Einzel");
assert.equal(m.event,"ME U17");
assert.equal(m.round_label,"Finale");
assert.equal(m.match_date,"2026-10-03");
assert.equal(m.player_side,1);
assert.equal(m.winning_side,1);
assert.deepEqual(m.opponent_names,["Test Gegnerin"]);
assert.deepEqual(m.games,[[21,18],[21,13]]);
assert.match(m.source_url,/badhub.de\/bwbv\/turnier.php\?id=4986/);
assert.equal(m.source_kind,"third-party-match-card");
assert.throws(()=>parsePublicHistory(tour,{dbv_id:"05-070879",name:"Philipp Metzger"},"tournament"),/mismatch/);
assert.throws(()=>parsePublicHistory(tour,player,"liga"));
const wrongWinner=tour.replace('sp-side sp-side--winner','sp-side').replace('sp-side sp-side--away','sp-side sp-side--away sp-side--winner');
assert.equal(parsePublicHistory(wrongWinner,player,"tournament").items.length,0,
 "CSS winner cannot contradict completed game score");
const wrongProfile=tour.replace(/Sarah Storz/g,"Anna Muster");
assert.throws(()=>parsePublicHistory(wrongProfile,player,"tournament"));
const league=head+'<div class="sp-meeting"><div class="sp-group-header">'+
 '<span class="sp-date-dm">09.10.</span><span class="sp-date-y">2026</span>'+
 '<span class="sp-group-opponent sp-gopp-line">Mössingen II – Gegner 6:2</span>'+
 '<a href="/bwbv/begegnung.php?id=290071">Spielbericht</a></div>'+
 '<div class="sp-meeting-discs"><div class="sp-match-item sp-match-item--link">'+
 '<span class="sp-match-disc sp-match-disc--win">DE</span>'+card.slice(card.indexOf('<div class="sp-match-body">'))+'</div></div></div>';
const l=parsePublicHistory(league,player,"league");
assert.equal(l.items.length,1);
assert.equal(l.items[0].category,"league");
assert.equal(l.items[0].match_date,"2026-10-09");
assert.equal(l.items[0].event,"DE");
assert.equal(l.items[0].competition_id,"290071");
const sql=await readFile("database/external-match-import.sql","utf8");
const cron=await readFile("database/external-match-cron.sql","utf8");
const fn=await readFile("supabase/functions/history-match-import/index.ts","utf8");
const html=await readFile("index.html","utf8");
const js=await readFile("external-matches.js","utf8");
const bridge=await readFile("history-demand.js","utf8");
const welcome=await readFile("welcome.js","utf8");
const sw=await readFile("sw.js","utf8");
assert.match(sql,/public\.player_external_match_facts/);
assert.match(sql,/enable row level security/g);
assert.match(sql,/grant select on public\.player_external_match_facts to anon,authenticated/);
assert.match(sql,/grant execute on function public\.claim_external_match_import\(text\) to service_role/);
assert.match(sql,/private\.external_match_attempts/);
assert.match(sql,/>=36 then/);
assert.match(cron,/badminton-history-match-batches/);
assert.match(cron,/private\.continue_external_match_import/);
assert.match(fn,/parsePublicHistory/);
assert.match(fn,/claim_external_match_import/);
assert.match(fn,/on_conflict=dbv_id,source_key/);
assert.match(fn,/src=.+saison=all/);
assert.doesNotMatch(fn,/insert into public.matches|update public.matches/,
 "Third-party matches must remain separate from DBV official facts");
assert.match(html,/id="external-match-history"/);
assert.match(html,/id="external-match-year"/);
assert.match(js,/player_external_match_facts/);
assert.match(js,/match_date/);
assert.match(js,/Quellbeleg/);
assert.match(bridge,/history-match-import/);
assert.match(welcome,/history-match-import/);
assert.match(sw,/schmetterlinge-shell-v43/);
console.log("Sourced external match import: parser identifies winner/sides/scores, refuses mismatched profile, idempotent DB and queue contracts verified.");
