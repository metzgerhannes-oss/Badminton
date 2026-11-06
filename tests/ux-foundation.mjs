import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const file=path=>readFile(path,"utf8");
const [html,app,router,style,stats,feedback,sw]=await Promise.all([
 "index.html","app.js","router.js","design-v2.css","stats.js","ui-feedback.js","sw.js"
].map(file));
const home=html.slice(html.indexOf('id="view-start"'),html.indexOf('id="view-historie"'));
assert.ok(home.indexOf('id="dashboard-next"')<home.indexOf('id="match-stats"'),"Next tournament must appear first");
assert.ok(home.indexOf('id="match-stats"')<home.indexOf('id="dashboard-rankings"'),"Stats precede dense rankings");
assert.ok(home.indexOf('id="dashboard-rankings"')<home.indexOf('id="dashboard-friends"'),"Rankings precede secondary social");
assert.equal((html.match(/id="dashboard-next"/g)||[]).length,1);
assert.equal((html.match(/id="dashboard-rankings"/g)||[]).length,1);
assert.equal((html.match(/id="match-stats-retry"/g)||[]).length,1);
assert.equal((html.match(/id="match-stats-provenance"/g)||[]).length,1);
assert.equal((html.match(/id="match-stats-provenance-copy"/g)||[]).length,1);
assert.match(html,/<details id="match-stats-provenance"/);
assert.match(html,/id="match-stats-source-link"/);
assert.match(stats,/lookup\.href=awaitingMatchSource\?/);
assert.match(stats,/https:\/\/badhub\.de\/spieler\//);
assert.match(stats,/https:\/\/turniere\.badminton\.de\/ranking/);
assert.doesNotMatch(html,/<details id="match-stats-provenance"[^>]*open/);
assert.match(stats,/sourceDetails\.textContent/);
assert.match(stats,/retry\.hidden=!availability\.retry/);
assert.match(stats,/fetchProfile\(selected,true\)/);
assert.match(stats,/badminton:network-restored/);
assert.match(stats,/officialCount\.total===0&&external\.length>0/);
assert.match(stats,/Ergebnisse aus verschiedenen Quellen werden nicht addiert/);
assert.match(stats,/Bisher belegte Spiele/);
assert.doesNotMatch(stats,/note\.textContent="Einzeln belegte Badhub-Spiele · kein offizieller DBV-Matchimport\./);

const nav=[...html.matchAll(/data-page="([^"]+)"/g)].map(x=>x[1]);
assert.deepEqual(nav,["start","spieler","turniere","verein","mannschaft"]);
assert.match(html,/href="#einstellungen" aria-label="Einstellungen öffnen"/);
assert.match(app,/function navigateHome\(\)/);
assert.match(app,/function navigateHome\(\)\{return navigatePrimary\("start"\)\}/);
assert.match(app,/if\(page==="start"\)[\s\S]*?SchmetterlingeStorage\.showOwn\(state\)/,
 "Home must restore locally selected own profile before navigation");
assert.match(app,/function focusCurrentView\(\)/);
assert.match(router,/heading\.focus\(\{preventScroll:true\}\)/);
assert.match(router,/requestAnimationFrame\(\(\)=>window\.scrollTo\(\{top:position,behavior:"auto"\}\)\)/,
 "Router must restore a remembered history position and scroll new routes to top");
assert.match(router,/page==="historie"\|\|page==="live"\?"turniere":page/);
assert.match(router,/document\.title=routeTitles\[page\]\+" · Schmetterlinge"/);
assert.match(html,/<a class="skip-link" href="#hauptinhalt">Zum Inhalt springen<\/a>/);
assert.match(html,/<main id="hauptinhalt" tabindex="-1">/);
assert.match(feedback,/event\.preventDefault\(\)/);
assert.match(feedback,/getElementById\("hauptinhalt"\)\?\.focus/);
assert.match(html,/id="connection-status"[^>]+hidden/);
assert.match(feedback,/navigator\.onLine!==false/);
assert.match(feedback,/addEventListener\("offline",update\)/);
assert.match(feedback,/badminton:network-restored/);
assert.match(style,/\.connection-status\[hidden\]\{display:none!important\}/);
assert.match(style,/\.match-stats-retry\[hidden\]\{display:none!important\}/);
assert.match(style,/\.library-player-action button,\.library-player-action \.library-view/);
assert.match(style,/min-height:44px/);
assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(style,/:focus-visible/);
assert.match(sw,/schmetterlinge-shell-v[1-9][0-9]*/);
assert.match(sw,/ui-feedback\.js/);
assert.match(sw,/router\.js/);
assert.match(sw,/tournament-bookmarks\.js/);
assert.match(html,/<script defer src="\.\/tournament-bookmarks\.js"><\/script>[\s\S]*<script defer src="\.\/app\.js"><\/script>/);
assert.match(app,/SchmetterlingeRouter\.renderPage\(state\)/);
assert.match(html,/<script defer src="\.\/router\.js"><\/script>[\s\S]*<script defer src="\.\/app\.js"><\/script>/);
assert.match(html,/<script defer src="\.\/state-storage\.js"><\/script>[\s\S]*<script defer src="\.\/app\.js"><\/script>/);
// UX 2.0 compact design layer stays within the original palette and known pages.
const polish=await file("ux-polish.css");
for(const name of ["--ux2-card-radius","--ux2-card-surface","--ux2-secondary","--ux2-action"])
 assert.ok(polish.includes(name),"Shared CD token missing: "+name);
for(const selector of ["#view-spieler .followed-player-row",
 "#view-mannschaft .team-card","#view-turniere .dbv-calendar-panel"])
 assert.ok(polish.includes(selector),"Compact mobile component missing: "+selector);
const linearChannel=x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;
const luminance=hex=>{
 const channels=[1,3,5].map(i=>linearChannel(parseInt(hex.slice(i,i+2),16)/255));
 return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
};
const contrastRatio=(fg,bg)=>{
 const [hi,lo]=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);
 return (hi+0.05)/(lo+0.05);
};
for(const color of ["#113c5e","#375b75","#075a91"])
 assert.ok(contrastRatio(color,"#ffffff")>=4.5,"Core mobile text must pass AA contrast: "+color);
for(const color of ["#163e5e","#365a75"])
 assert.ok(contrastRatio(color,"#f9fcff")>=4.5,"Desktop pale-card text must pass AA contrast: "+color);
assert.match(polish,/font-size:16px;line-height:1\.35;/,"Search inputs must avoid iOS focus zoom");
assert.match(polish,/#view-mannschaft \.team-follow-button\{min-width:44px;min-height:44px\}/,
 "Follow control must retain 44px target");
assert.doesNotMatch(polish,/animation-name:|animation:\s*[^n]|touch-action\s*:\s*none|user-scalable|maximum-scale/,
 "Visual cleanup must not override user motion or zoom preferences");

console.log("UX foundation: task-first Home, truthful source disclosure, retry/offline, keyboard routing, mobile touch targets and v38 PWA verified.");
