import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
 normalizeFollows,normalizeTeamText,filterTeamRows,officialTeamUrl,tablePoints,confirmedResult
} from "../scripts/team-directory-utils.mjs";

assert.deepEqual(normalizeFollows(["nuliga:10777:1","nuliga:10777:1","evil","nuliga:10892:4"]),["nuliga:10777:1","nuliga:10892:4"]);
assert.deepEqual(normalizeFollows({teams:["nuliga:10777:1"]}),[]);
assert.equal(normalizeFollows(Array.from({length:60},(_,i)=>"nuliga:10777:"+(i+1))).length,50);
assert.equal(normalizeTeamText("Mössingen"),"mossingen");
assert.equal(normalizeTeamText("Straße"),"strasse");
const rows=[
 {club_name:"SpVgg. Mössingen",team_label:"II",league_name:"Württemberg-Liga",season:"2026/27"},
 {club_name:"TSG Heilbronn",team_label:"IV",league_name:"Bezirksliga Neckar-Odenwald",season:"2026/27"},
 {club_name:"SpVgg. Mössingen",team_label:"II",league_name:"Verbandsliga",season:"2025/26"}
];
assert.equal(filterTeamRows(rows,"Mossingen","2026/27").length,1);
assert.equal(filterTeamRows(rows,"Heilbronn Bezirksliga","2026/27").length,1);
assert.equal(filterTeamRows(rows,"","2026/27").length,2);
assert.equal(tablePoints({points_for:1,points_against:1}),"1:1");
assert.equal(tablePoints({points_for:null,points_against:0}),"–");
assert.equal(confirmedResult({status:"scheduled",home_score:6,away_score:2}),"");
assert.equal(confirmedResult({status:"finished",home_score:6,away_score:2}),"6:2");
assert.equal(confirmedResult({status:"finished",home_score:null,away_score:null}),"");
assert.equal(officialTeamUrl("https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777").includes("club=10777"),true);
assert.equal(officialTeamUrl("https://evil.example/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/clubTeams?club=10777"),"");
assert.equal(officialTeamUrl("javascript:alert(1)"),"");
assert.ok(officialTeamUrl("https://bwbv-badminton.liga.nu/cgi-bin/WebObjects/nuLigaBADDE.woa/wa/groupMeetingReport?meeting=378760&championship=BWBV+26%2F27&group=40136"));
const [html,css,script,sw,router,sql]=await Promise.all([
 "index.html","teams.css","teams.js","sw.js","router.js","database/team-league-public-directory-v95.sql"
].map(p=>readFile(p,"utf8")));
assert.match(html,/id="view-mannschaft"/);
assert.match(html,/href="#mannschaft" data-page="mannschaft"/);
assert.match(html,/id="team-search"/);
assert.match(html,/id="team-season"/);
assert.match(html,/id="team-detail-table"/);
assert.match(html,/id="team-detail-games"/);
assert.match(script,/const fields="league_teams\?select=/);
assert.match(script,/readPublicRows\(fields\+"&limit=500&offset=0"/);
assert.match(script,/readPublicRows\("league_fixtures\?/);
assert.match(script,/readPublicRows\("league_table_rows\?/);
assert.match(script,/localStorage\.setItem\(TEAM_FOLLOWS_KEY/);
assert.match(css,/\.bottom-nav\.has-live-tab a\{width:16\.666%!important/);
assert.match(router,/mannschaft:"Mannschaft"/);
assert.match(sw,/"\.\/teams\.js"/);
assert.match(sw,/"\.\/teams\.css"/);
assert.match(sql,/alter table public\.league_teams enable row level security/);
assert.match(sql,/grant select on public\.league_teams/);
assert.doesNotMatch(sql,/grant (?:insert|update|delete|all) on public\.league_teams to anon/i);
console.log("Mannschaft directory, following, validated nuLiga links and separate score sources verified.");
