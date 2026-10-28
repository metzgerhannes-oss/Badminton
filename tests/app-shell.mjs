import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const [html,legacy,components,design,shell,cache,manifest,app]=await Promise.all([
 "index.html","styles.css","ui-components.css","design-v2.css","app-shell.css","sw.js","manifest.webmanifest","app.js"
].map(path=>readFile(path,"utf8")));
const href=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(href,["styles.css","ui-components.css","design-v2.css","language.css","club-branding.css","app-access.css","app-shell.css","teams.css","club-roster.css","private-sharing.css","settings-rooms.css","onboarding-wizard.css","spiele.css","home-v137.css","desktop-dashboard.css","club-overview.css","follow-ux.css","ux-polish.css","desktop-shell-v172.css","desktop-tournament-v173.css","desktop-workspace-v176.css","pwa-update.css","today-in-action.css","accessibility-v182.css","canonical-follows-v183.css","contrast-v189.css"],
 "Approved Home cascade must remain intact, with non-Home contrast layer last");
assert.match(await readFile("spiele.css","utf8"),/\.arcade-shell\{/,"Arcade styles must remain scoped to the secondary screen");
const tabs=[...html.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(tabs,["start","spieler","turniere","verein","mannschaft"],"Four fixed mobile tabs and the existing desktop club destination");
const navigation=html.match(/<nav class="bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1]||"";
assert.doesNotMatch(navigation,/id="live-nav-tab"|data-page="berichte"/,"Live and reports are context routes, not permanent tabs");
assert.match(html,/id="live-nav-tab" class="today-context-link"[^>]*hidden/);
assert.match(html,/id="heading-spieler"[\s\S]*?href="#berichte"/);
assert.match(html,/id="heading-mannschaft"[\s\S]*?href="#berichte"/);
assert.match(await readFile("teams.css","utf8"),/\.bottom-nav a\{width:25%!important/);
assert.doesNotMatch(await readFile("teams.css","utf8"),/\.bottom-nav\.has-live-tab/);
assert.match(shell,/\.bottom-nav a\[hidden\]\{display:none!important\}/);
assert.match(shell,/\.topbar-settings\{/);
assert.match(shell,/@media\(max-width:410px\)/);
assert.match(shell,/@media\(max-width:350px\)/);
assert.match(design,/\.bottom-nav\{width:100%;max-width:none/);
assert.match(components,/\.home-trophy\{/);
assert.match(components,/\.ranking-dialog\{/);
assert.doesNotMatch(design,/\.bottom-nav a\{width:16\.666/);
assert.doesNotMatch(legacy,/\.bottom-nav a\{width:(?:16\.666|20%|33\.3333)/);
assert.match(legacy,/mask:none!important;-webkit-mask:none!important/);
assert.match(legacy,/clip-path:none!important/);
assert.match(cache,/schmetterlinge-shell-v[1-9][0-9]*/);
assert.match(cache,/"\.\/app-shell.css"/);
assert.equal(JSON.parse(manifest).theme_color,"#d9ecfb");
console.log("v63 app shell: CSS precedence, four navigation tabs, current responsive header, full logo and offline cache verified.");

assert.match(html,/id="tournament-shortcuts"[^>]*role="group"/,"Direct turnier quick paths exist");
assert.match(html,/id="dbv-calendar-advanced" class="dbv-calendar-advanced"/,"Advanced facets can be collapsed");
assert.ok(html.indexOf('id="my-tournaments-title"')<html.indexOf('id="dbv-calendar-heading"'),"Personal dates precede tournament directory");
assert.ok(html.indexOf('id="dbv-calendar-heading"')<html.indexOf('class="live-dbv"'),"Calendar search precedes live detail");

assert.doesNotMatch(html,/id="friend-order-done"/,"Player order is now changed directly at the row");
assert.doesNotMatch(html,/id="friend-manage-details"/,"There must be no duplicate player management screen");
assert.match(html,/id="followed-player-search"/,"Player search and follow share one entry point");
assert.match(app,/data-friend-grip/,"Player ordering handles are accessible directly in the list");
assert.match(html,/id="team-order-reset"[^>]*type="button"/,"Team order reset remains available on the list");
assert.doesNotMatch(html,/id="team-order-done"|id="team-manage-details"/,"No duplicated team management route");
assert.match(await readFile("teams.js","utf8"),/data-team-move/,"Team sorting actions are in the followed list");
