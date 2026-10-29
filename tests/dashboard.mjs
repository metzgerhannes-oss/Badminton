import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const page=await readFile("index.html","utf8");
const js=await readFile("dashboard.js","utf8");
const homeCss=await readFile("home-v137.css","utf8");
const app=await readFile("app.js","utf8");
const sw=await readFile("sw.js","utf8");
const snapshot=JSON.parse(await readFile("data/ranking.json","utf8"));
assert.ok(page.includes('id="view-start"'));
// IA #13: exactly four stable mobile destinations; the club is desktop-only,
// while live/today and settings remain contextual, not shifting bottom tabs.
const primaryNav=page.match(/<nav class="bottom-nav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
assert.ok(primaryNav,"The canonical mobile navigation must exist");
const primaryDestinations=[...primaryNav.matchAll(/<a\b[^>]*data-page="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(primaryDestinations,["start","spieler","turniere","verein","mannschaft"],
 "The four mobile destinations and desktop club shortcut must remain stable");
assert.ok(primaryNav.includes('data-page="verein" class="desktop-club-nav"'),
 "The club shortcut must remain desktop-only");
assert.ok(!primaryNav.includes('data-page="live"')&&!primaryNav.includes('data-page="berichte"'),
 "Today/live and reports must not create shifting mobile tabs");
assert.ok(page.includes('class="today-context-bar"')&&page.includes('id="live-nav-tab"'),
 "Live remains a contextual shortcut");
assert.ok(page.includes('class="topbar-settings" href="#einstellungen"'),
 "Settings must remain available outside the bottom navigation");
// P1 iPhone SE: all three short Home links retain accessible touch targets.
for(const selector of [
  "#view-start .upcoming-tournaments-header a",
  "#view-start .home-stats-link",
  "#view-start .home-trophy-heading a"
]){
  const start=homeCss.indexOf(selector+"{");
  assert.ok(start>=0,selector+" must have a touch-target rule");
  const rule=homeCss.slice(start,homeCss.indexOf("}",start));
  assert.ok(rule.includes("min-height:44px"),selector+" must retain 44px");
}
// P1 iPhone: the collapsed technical identifier is a real interactive details control.
// Its summary must be tappable without forcing users to zoom at 320px width.
const technicalSummaryStart=homeCss.indexOf("#view-turniere .saved-tournament-technical summary{");
assert.ok(technicalSummaryStart>=0,"Saved tournament technical details must have a summary rule");
const technicalSummaryRule=homeCss.slice(technicalSummaryStart,homeCss.indexOf("}",technicalSummaryStart));
assert.match(technicalSummaryRule,/min-height:44px/,"Technical details disclosure must keep a 44px touch target");
assert.ok(page.includes('id="dashboard-rankings"'));
assert.ok(page.includes('id="dashboard-kpis"'));
assert.ok(page.includes('id="dashboard-next"'));
assert.ok(js.includes('upcomingTournaments(bookmarks,selection,today)'),"Dashboard must select three upcoming tournaments for active player");
assert.ok(js.includes('Nächste Turniere'),"Upcoming panel title");
assert.ok(js.includes('location?"":\'<small class="upcoming-tournament-venue">Austragungsort nicht erfasst</small>\'')||
 js.includes('Austragungsort nicht erfasst'),
 "A missing locally stored venue must remain visibly not recorded");
assert.ok(!js.includes("Austragungsort noch nicht veröffentlicht"),
 "Home must distinguish missing local data from missing official publication");
assert.ok(js.includes('profiles.slice().reverse().find(x=>x.id===selection)'),
 "Friend KPI must prefer the Follow role for an ID also owned locally");
assert.ok(page.indexOf('id="dashboard-next"') < page.indexOf('id="match-stats-values"'),"Upcoming tournaments precede match KPIs");
assert.ok(page.indexOf('id="match-stats-values"') < page.indexOf('id="home-match-filter-panel"'),"Verified KPIs precede optional filters");
assert.ok(page.indexOf('id="dashboard-kpis"') < page.indexOf('home-ranking-section'),"Trophies precede rankings");
assert.ok(!page.includes('Für eingeladene Nutzer: Belegte Badminton-Ergebnisse'),"Technical Home introduction removed");
assert.ok(page.includes('href="./home-v137.css"'),"Compact Home stylesheet linked");
assert.ok(js.includes('upcoming-tournament-row')&&js.includes('upcoming-tournament-date'),"Each row has date and DBV link");
assert.ok(js.includes('const target="#turniere/"+encodeURIComponent(String(t.id))+"/"+encodeURIComponent(String(t.playerId))'),
 "Home tournament row must deep-link directly to the exact stored tournament, not generic #turniere");
assert.ok(app.includes('function focusSavedTournamentFromHash()')&&
 app.includes('card.scrollIntoView({behavior:"auto",block:"start"})'),
 "Deep-linked tournament must be focused and scrolled into view after native iPhone navigation");
assert.ok(app.includes('data-saved-tournament-id=')&&app.includes('data-saved-tournament-player='),
 "Tournament identity is selected by both bookmark ID and attached player");
assert.ok(app.includes("heading=venue")&&app.includes("name+\" · \"+venue"),
 "Saved event shows verified or manually recorded venue in its heading");
assert.ok(app.includes('class="saved-tournament-player"')&&
 app.indexOf('class="saved-tournament-player"')>app.indexOf('class="local-shortcut-actions"'),
 "The player attribution belongs below the tournament actions");
assert.ok(app.includes('row.key===t.id&&row.hasDirectLink===true'),
 "A source-linked direct event URL is available only for an identical official calendar key");

assert.ok(page.includes('src="./dashboard.js"'));
assert.ok(page.includes('href="#start" data-page="start"'));
assert.ok(!page.includes('class="hero"'),"No verbose hero on landing page");
assert.ok(app.includes('window.renderDashboard?.(state.chosen,viewedProfiles,state.viewingFriendId?[]:state.officialLinks'));
assert.ok(app.includes('page:"start"'));
assert.ok(app.includes('activeProfileId'));
assert.ok(app.includes('viewingFriendId'));
assert.ok(page.includes('class="topbar-settings" href="#einstellungen"'));
assert.ok(js.includes('friendNoHistory')&&js.includes('ranking'));

assert.ok(js.includes("e.bwAgeClassChange")&&js.includes("e.previousBwAgeClassRank"),"BW weekly arrows must use two real official snapshots");
assert.ok(js.includes("e.ageClassRank")&&js.includes("DE"),"Germany age-class rank remains secondary");
assert.ok(js.includes("archiveBehind")&&js.includes("ranking-stale-link"),"Stale DBV Excel week should show a warning");
assert.ok(js.includes('Jg. ')&&js.includes('bwAgeClassSize'),"Age class and BW comparison population must be shown");
assert.ok(js.includes('movement-up')&&js.includes('movement-down')&&js.includes('movement-unknown'));
assert.ok(sw.includes("./dashboard.js"));
assert.ok(page.includes('id="ranking-dialog"'));
assert.ok(page.includes('id="first-run-dialog"'));
assert.ok(page.includes('id="first-run-choices"'));
assert.ok(app.includes('freshDevice')&&app.includes('window.renderDashboard'));
assert.ok(js.includes("ranking-bw-title")&&js.includes("escape(e?.ageClass"),"KPI must label the official age group");
assert.ok(js.includes('ranking-bw-row'));
assert.ok(js.includes('ranking-de-row'));
assert.ok(page.includes('id="dashboard-friends"'));
assert.ok(app.includes("renderFriendQuick()"));
assert.ok(js.includes("function renderRankDetails"));
assert.ok(js.includes("ranking-compact"));
assert.ok(snapshot.schemaVersion===2);
assert.ok(["pending","available"].includes(snapshot.status));
if(snapshot.status==="pending")assert.deepEqual(snapshot.players,{},"Never seed fictional rankings");
if(snapshot.status==="available"&&snapshot.players?.["05-070879"]?.disciplines?.HE?.bwRank!=null){
 const ranks=snapshot.players["05-070879"].disciplines;
 for(const key of ["HE","HD","HM"]){
   assert.ok(ranks[key].bwAgeClassRank>=1,"BW rank positive");
   assert.ok(ranks[key].ageClassRank>=ranks[key].bwAgeClassRank,"BW position cannot be below German position");
   assert.equal(ranks[key].birthYear,2016);
   assert.equal(ranks[key].ageClass,"U11");
   assert.ok(ranks[key].ageClassSize>=ranks[key].bwAgeClassSize,"Whole country must include BW cohort");
 }
}
const workflow=await readFile(".github/workflows/ranking.yml","utf8");
assert.ok(workflow.includes("cron: '0 15 * * 4'"),"Schedule Thursday only");
assert.ok(workflow.includes("scripts/update-ranking.py"));
assert.ok(workflow.includes("scripts/test-ranking.py"));
assert.equal(snapshot.privacyMode,"private");
console.log("Dashboard layout and private no-ranking state verified; public ranked player export disabled.");
