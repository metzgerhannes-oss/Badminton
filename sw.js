/* v160: Compact Home and iPhone safe areas. Install-first onboarding avoids separate iOS Safari/PWA profile stores. Always provide a Response,
   even when LTE fails and the cache is empty. No user data is stored or cleared. */
"use strict";
const CACHE="schmetterlinge-shell-v236";
const ASSETS=["./spiele-pong.js","./games/pong.mjs","./spiele.js","./spiele.css","./games/snake.mjs","./games/2048.mjs","./spiele-2048.js","./contrast-v189.css","./canonical-follows-v183.css","./accessibility-v182.css","./today-in-action.js","./today-in-action.css","./scripts/today-evidence.mjs","./scripts/today-presentation.mjs","./desktop-workspace-v176.css","./pwa-update.js","./pwa-update.css","./install-invite.html","./app-access.js","./app-access.css","./","./index.html","./styles.css","./ui-components.css","./design-v2.css","./app-shell.css","./home-v137.css","./desktop-dashboard.css","./club-overview.css","./follow-ux.css","./ux-polish.css","./desktop-shell-v172.css","./desktop-tournament-v173.css","./club-overview.js","./scripts/club-overview-model.mjs","./wiki.html","./wiki.js","./wiki.css","./teams.css","./club-roster.css","./private-sharing.css","./settings-rooms.css","./club-branding.css","./language.css","./stats.js","./career-history.js","./external-matches.js","./scripts/badhub-history-parser.mjs","./history-demand.js","./follow-import.js","./scripts/history-demand.mjs","./scripts/external-history.mjs","./data/player-history/index.json","./scripts/match-stats.mjs","./scripts/external-match-stats.mjs","./scripts/match-source-integrity.mjs","./scripts/badminton-score-rules.mjs","./scripts/nonplayed-rounds.mjs","./scripts/dbv-match-reference.mjs","./scripts/match-age-context.mjs","./scripts/match-availability.mjs","./state-storage.js","./router.js","./tournament-bookmarks.js","./spond-calendar.js","./onboarding-wizard.js","./onboarding-wizard.css","./scripts/onboarding-wizard-state.mjs","./app.js","./desktop-context-v173.js","./settings-rooms.js","./matchday-view.js","./club-branding.js","./app-release.js","./i18n.js","./locales/manifest.json","./locales/de.json","./locales/en.json","./locales/fr.json","./locales/uk.json","./locales/ru.json","./locales/zh-Hans.json","./locales/tr.json","./locales/ar.json","./locales/it.json","./locales/es.json","./locales/pl.json","./backup.js","./scripts/local-backup.mjs","./ui-feedback.js","./invite.js","./scripts/owner-invites-overview.mjs","./welcome.html","./welcome.css","./welcome.js","./consented-player-data.js","./scripts/consented-player-data.mjs","./scripts/invitation.mjs","./scripts/welcome-flow.mjs","./scripts/invitation-search.mjs","./scripts/targeted-player-search.mjs","./scripts/friend-search.mjs","./live.js","./live-links.js","./live-radar.js","./live-hub.js","./tournament-live.js","./badhub-event.js","./scripts/badhub-event.mjs","./followed-live.js","./scripts/followed-live.mjs","./scripts/tournament-live.mjs","./scripts/live-radar.mjs","./scripts/live-links.mjs","./reports.js","./library.js","./scripts/library-utils.mjs","./scripts/supabase-read.mjs","./data/player-library/index.json","./dashboard.js","./dbv-calendar.js","./scripts/dbv-calendar-utils.mjs","./shared-tournaments.js","./private-invites.js","./private-invite.html","./private-invite-reader.js","./private-player.html","./private-player-reader.js","./player-access.js","./player-verification.js","./owner-activate.html","./owner-activate.js","./owner-admin.js","./scripts/private-invite-utils.mjs","./teams.js","./scripts/spvgg-roster.mjs","./data/spvgg-active-roster.json","./scripts/team-directory-utils.mjs","./scripts/shared-tournaments.mjs","./history.js","./scripts/result-evidence-nav.mjs","./scripts/trophy-stats.mjs","./scripts/private-trophy-source.mjs","./scripts/private-match-source.mjs","./scripts/upcoming-tournaments.mjs","./data/history.json","./assets/spvgg-schmetterlinge.svg","./assets/schmetterlinge-apple-touch-icon-180.png","./assets/schmetterlinge-pwa-192.png","./assets/schmetterlinge-pwa-512.png","./manifest.webmanifest","./assets/spvgg-schmetterlinge-splash.svg","./assets/shuttlecock-splash.svg"];
/* Keep the existing worker if essential shell files cannot be precached. Other
   assets are best-effort so one failed network fetch cannot block an update. */
const SHELL_ASSETS=["./spiele-pong.js","./games/pong.mjs","./spiele.js","./spiele.css","./games/snake.mjs","./games/2048.mjs","./spiele-2048.js","./contrast-v189.css","./today-in-action.js","./today-in-action.css","./canonical-follows-v183.css","./accessibility-v182.css","./desktop-workspace-v176.css","./pwa-update.js","./pwa-update.css","./install-invite.html","./styles.css","./ui-components.css","./design-v2.css","./language.css","./club-branding.css","./app-shell.css","./teams.css","./club-roster.css","./private-sharing.css","./settings-rooms.css","./home-v137.css","./desktop-dashboard.css","./club-overview.css","./follow-ux.css","./ux-polish.css","./desktop-shell-v172.css","./desktop-tournament-v173.css","./ui-feedback.js","./backup.js","./state-storage.js","./router.js","./tournament-bookmarks.js","./spond-calendar.js","./i18n.js","./club-branding.js","./app-release.js","./matchday-view.js","./onboarding-wizard.js","./onboarding-wizard.css","./scripts/onboarding-wizard-state.mjs","./app.js","./desktop-context-v173.js","./settings-rooms.js","./invite.js","./app-access.js","./library.js","./club-overview.js","./stats.js","./history-demand.js","./follow-import.js","./career-history.js","./external-matches.js","./live.js","./live-links.js","./live-radar.js","./live-hub.js","./tournament-live.js","./badhub-event.js","./followed-live.js","./reports.js","./history.js","./dashboard.js","./dbv-calendar.js","./shared-tournaments.js","./private-invites.js","./player-access.js","./consented-player-data.js","./player-verification.js","./owner-admin.js","./teams.js","./assets/spvgg-schmetterlinge.svg","./assets/schmetterlinge-apple-touch-icon-180.png","./assets/schmetterlinge-pwa-192.png","./assets/schmetterlinge-pwa-512.png","./manifest.webmanifest","./assets/spvgg-schmetterlinge-splash.svg","./assets/shuttlecock-splash.svg"];
const ESSENTIAL=["./spiele-pong.js","./games/pong.mjs","./spiele.js","./spiele.css","./games/snake.mjs","./games/2048.mjs","./spiele-2048.js","./contrast-v189.css","./canonical-follows-v183.css","./accessibility-v182.css","./desktop-workspace-v176.css","./pwa-update.js","./pwa-update.css","./install-invite.html","./app-access.js","./app-access.css","./consented-player-data.js","./scripts/consented-player-data.mjs","./scripts/private-match-source.mjs","./scripts/private-trophy-source.mjs","./scripts/result-evidence-nav.mjs","./","./index.html","./onboarding-wizard.js","./onboarding-wizard.css","./scripts/onboarding-wizard-state.mjs","./app.js","./desktop-context-v173.js","./router.js","./state-storage.js","./app-release.js","./scripts/owner-invites-overview.mjs","./welcome.html","./welcome.css","./welcome.js","./scripts/invitation.mjs","./scripts/welcome-flow.mjs","./scripts/invitation-search.mjs","./scripts/targeted-player-search.mjs","./scripts/friend-search.mjs","./scripts/supabase-read.mjs","./i18n.js","./private-player.html","./private-player-reader.js","./scripts/invited-player-local.mjs","./private-invites.js","./scripts/private-invite-utils.mjs","./assets/spvgg-schmetterlinge-splash.svg","./assets/shuttlecock-splash.svg"];
const OFFLINE_HTML='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Schmetterlinge – Offline</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:38rem;margin:3rem auto;padding:1rem"><h1>Schmetterlinge ist momentan nicht erreichbar</h1><p>Bitte prüfe die Internetverbindung und lade die Seite erneut. Deine lokal gespeicherten Profile und Einstellungen werden dadurch nicht gelöscht.</p><p><a href="./">Erneut versuchen</a></p></body></html>';

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ESSENTIAL);
    // Preload only the visible app shell; secondary views and large indexes load on first use.
    // Small batches avoid a simultaneous 100+ file burst on mobile connections.
    const optional=SHELL_ASSETS.filter(path=>!ESSENTIAL.includes(path));
    for(let offset=0;offset<optional.length;offset+=6){
      await Promise.allSettled(optional.slice(offset,offset+6).map(path=>cache.add(path)));
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    // CacheStorage is shared by paths on the same origin: never delete other apps.
    await Promise.all(keys.filter(name=>name.startsWith("schmetterlinge-shell-")&&name!==CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
async function offlineResponse(request){
  try{
    const hit=await caches.match(request,{ignoreSearch:true});
    if(hit)return hit;
    if(request.mode==="navigate"){
      const root=self.registration.scope;
      const requested=new URL(request.url);
      const base=new URL(root);
      const isAppShell=requested.pathname===base.pathname||
        requested.pathname===new URL("index.html",base).pathname;
      // Never substitute the homepage for welcome.html or private invitation routes.
      if(isAppShell){
        const index=await caches.match(new URL("index.html",base));
        if(index)return index;
        const home=await caches.match(root);
        if(home)return home;
      }
    }
  }catch{
    // Safari private browsing / CacheStorage failures must not break respondWith.
  }
  if(request.mode==="navigate"){
    return new Response(OFFLINE_HTML,{status:503,statusText:"Offline",
      headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
  }
  return new Response("Offline: Ressource nicht verfuegbar.",{status:503,statusText:"Offline",
    headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
}
self.addEventListener("fetch",event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.includes("/data/"))return;
  // GitHub Pages/iOS may retain older HTML in the HTTP cache. Always
  // revalidate navigations and the release marker against the network.
  const freshNavigation=request.mode==="navigate"||url.pathname.endsWith("/app-release.js");
  const network=fetch(request,freshNavigation?{cache:"no-store"}:undefined);
  // Keep the worker alive for writes, but never hold up the online response.
  // Never persist invitation URLs containing query tokens or unlisted resources.
  // Keep read-only public JSON indexes network-only, consistent with /data/ exclusion above.
  const scopePath=new URL(self.registration.scope).pathname;
  const path=url.pathname.startsWith(scopePath)?"./"+url.pathname.slice(scopePath.length):null;
  const cacheable=!url.search&&path&&(ASSETS.includes(path)||ESSENTIAL.includes(path));
  const persist=cacheable?network.then(response=>{
    if(!response.ok)return;
    const copy=response.clone();
    return caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
  }).catch(()=>{}):Promise.resolve();
  event.waitUntil(persist);
  event.respondWith(network.catch(()=>offlineResponse(request)));
});
