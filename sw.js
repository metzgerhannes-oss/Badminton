/* v130: Install-first onboarding avoids separate iOS Safari/PWA profile stores. Always provide a Response,
   even when LTE fails and the cache is empty. No user data is stored or cleared. */
"use strict";
const CACHE="schmetterlinge-shell-v130";
const ASSETS=["./","./index.html","./styles.css","./ui-components.css","./design-v2.css","./app-shell.css","./teams.css","./private-sharing.css","./settings-rooms.css","./club-branding.css","./language.css","./stats.js","./career-history.js","./external-matches.js","./scripts/badhub-history-parser.mjs","./history-demand.js","./scripts/history-demand.mjs","./scripts/external-history.mjs","./data/player-history/index.json","./scripts/match-stats.mjs","./scripts/external-match-stats.mjs","./scripts/badminton-score-rules.mjs","./scripts/nonplayed-rounds.mjs","./scripts/dbv-match-reference.mjs","./scripts/match-age-context.mjs","./scripts/match-availability.mjs","./state-storage.js","./router.js","./tournament-bookmarks.js","./spond-calendar.js","./app.js","./settings-rooms.js","./matchday-view.js","./club-branding.js","./app-release.js","./i18n.js","./locales/manifest.json","./locales/de.json","./locales/en.json","./locales/fr.json","./locales/uk.json","./locales/ru.json","./locales/zh-Hans.json","./locales/tr.json","./locales/ar.json","./locales/it.json","./locales/es.json","./locales/pl.json","./backup.js","./scripts/local-backup.mjs","./ui-feedback.js","./invite.js","./welcome.html","./welcome.css","./welcome.js","./consented-player-data.js","./scripts/consented-player-data.mjs","./scripts/invitation.mjs","./scripts/welcome-flow.mjs","./scripts/invitation-search.mjs","./scripts/friend-search.mjs","./live.js","./live-links.js","./live-radar.js","./live-hub.js","./tournament-live.js","./badhub-event.js","./scripts/badhub-event.mjs","./followed-live.js","./scripts/followed-live.mjs","./scripts/tournament-live.mjs","./scripts/live-radar.mjs","./scripts/live-links.mjs","./reports.js","./library.js","./scripts/library-utils.mjs","./scripts/supabase-read.mjs","./data/player-library/index.json","./dashboard.js","./dbv-calendar.js","./scripts/dbv-calendar-utils.mjs","./shared-tournaments.js","./private-invites.js","./private-invite.html","./private-invite-reader.js","./private-player.html","./private-player-reader.js","./player-access.js","./player-verification.js","./owner-activate.html","./owner-activate.js","./owner-admin.js","./scripts/private-invite-utils.mjs","./teams.js","./scripts/team-directory-utils.mjs","./scripts/shared-tournaments.mjs","./history.js","./scripts/trophy-stats.mjs","./scripts/private-trophy-source.mjs","./scripts/private-match-source.mjs","./scripts/upcoming-tournaments.mjs","./data/history.json","./assets/spvgg-schmetterlinge.svg","./manifest.webmanifest"];
/* Keep the existing worker if essential shell files cannot be precached. Other
   assets are best-effort so one failed network fetch cannot block an update. */
const ESSENTIAL=["./consented-player-data.js","./scripts/consented-player-data.mjs","./scripts/private-match-source.mjs","./scripts/private-trophy-source.mjs","./","./index.html","./app.js","./router.js","./state-storage.js","./app-release.js","./welcome.html","./welcome.css","./welcome.js","./scripts/invitation.mjs","./scripts/welcome-flow.mjs","./scripts/invitation-search.mjs","./scripts/friend-search.mjs","./scripts/supabase-read.mjs","./i18n.js","./private-player.html","./private-player-reader.js","./scripts/invited-player-local.mjs","./private-invites.js","./scripts/private-invite-utils.mjs","./scripts/invited-player-local.mjs"];
const OFFLINE_HTML='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Schmetterlinge – Offline</title><body style="font:16px/1.5 system-ui,sans-serif;max-width:38rem;margin:3rem auto;padding:1rem"><h1>Schmetterlinge ist momentan nicht erreichbar</h1><p>Bitte prüfe die Internetverbindung und lade die Seite erneut. Deine lokal gespeicherten Profile und Einstellungen werden dadurch nicht gelöscht.</p><p><a href="./">Erneut versuchen</a></p></body></html>';

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(ESSENTIAL);
    await Promise.allSettled(ASSETS.filter(path=>!ESSENTIAL.includes(path)).map(path=>cache.add(path)));
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
  const network=fetch(request);
  // Keep the worker alive for writes, but never hold up the online response.
  const persist=network.then(response=>{
    if(!response.ok)return;
    const copy=response.clone();
    return caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
  }).catch(()=>{});
  event.waitUntil(persist);
  event.respondWith(network.catch(()=>offlineResponse(request)));
});
