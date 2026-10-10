import {test,expect} from "@playwright/test";

const PLAYER="05-070879";
const FRIEND="05-061350";
const ROOT="http://127.0.0.1:4173";
const sourceRecord={
  dbv_id:PLAYER,source_key:"mobile-e2e:match-1",source_name:"Badhub",
  source_kind:"third-party-match-card",category:"tournament",
  competition:"Öffentlich belegtes Jugendturnier",competition_id:"551",
  event:"ME U11",discipline:"Einzel",round_label:"Finale",
  match_date:"2026-10-08",match_year:2026,player_side:1,winning_side:1,
  opponent_names:["Beispiel Gegner"],partner_names:[],
  games:[[21,18],[21,13]],
  source_url:"https://badhub.de/bwbv/turnier.php?id=551"
};
function ownStore(){
 return JSON.stringify({
  players:[
   {id:PLAYER,name:"Philipp Metzger",birthYear:2016,club:"SpVgg Mössingen"},
   {id:"05-071969",name:"Charlotte Metzger",birthYear:2014,club:"SpVgg Mössingen"}
  ],
  friends:[{id:FRIEND,name:"Sarah Storz",club:"SpVgg Mössingen"}],
  officialLinks:[],activeProfileId:PLAYER,chosen:PLAYER,historyProfilesInitialized:true
 });
}
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS",
 "Content-Type":"application/json"
};
test.beforeEach(async ({page})=>{
 await page.addInitScript(data=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",data);
 },ownStore());
 await page.route("**/*",async route=>{
  const request=route.request();
  const url=new URL(request.url());
  if(url.origin===ROOT)return route.continue();
  if(request.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(url.hostname.endsWith(".supabase.co")){
   let data=[];
   if(url.pathname.endsWith("/player_external_match_facts") &&
      url.searchParams.get("dbv_id")==="eq."+PLAYER)data=[sourceRecord];
   if(url.pathname.endsWith("/player_external_match_imports") &&
      url.searchParams.get("dbv_id")==="eq."+PLAYER){
    data=[{dbv_id:PLAYER,status:"complete",cursor_offset:1,verified_count:1,rejected_count:0}];
   }
   if(url.pathname.endsWith("/player_live_snapshots")){
    const id=(url.searchParams.get("dbv_id")||"").replace(/^eq\./,"");
    data=[{
     dbv_id:id,provider:"Badhub",
     source_url:"https://badhub.de/spieler/"+id+"/live",
     checked_at:new Date().toISOString(),
     payload:{tournament:null,running:null,next:null,hero:null,upcoming:[],past:[],entries:[]}
    }];
   }
   if(url.pathname.includes("/functions/v1/"))
    return route.fulfill({status:200,headers,body:'{"queued":false,"reason":"already_present"}'});
   return route.fulfill({status:200,headers,body:JSON.stringify(data)});
  }
  // The app must remain usable without a real third-party server during QA.
  return route.fulfill({status:200,headers,body:"[]"});
 });
});

test("Home shows individual sourced matches and fits the small viewport",async ({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#first-run-dialog")).not.toBeVisible();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Philipp");
 const mainTabs=page.locator(".bottom-nav a");
 await expect(mainTabs).toHaveCount(4);
 await expect(page.locator("#match-stats-source")).toContainText("Badhub");
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.losses strong")).toHaveText("0");
 await expect(page.locator("#match-stats-values .match-stat.rate strong")).toContainText("100");
 const viewport=await page.evaluate(()=>({
  excess:document.documentElement.scrollWidth-window.innerWidth,
  nav:[...document.querySelectorAll(".bottom-nav a")].map(x=>{
   const r=x.getBoundingClientRect();
   return {w:r.width,h:r.height,label:x.innerText.trim()};
  })
 }));
 expect(viewport.excess).toBeLessThanOrEqual(2);
 for(const tab of viewport.nav){
  expect(tab.w,tab.label+" width").toBeGreaterThanOrEqual(44);
  expect(tab.h,tab.label+" height").toBeGreaterThanOrEqual(44);
  expect(tab.label.length).toBeGreaterThan(1);
 }
});

test("Partial source outage never impersonates a verified empty history, and retry works",async ({page})=>{
 let externalUnavailable=true;
 await page.route("**/player_external_match_imports?*",route=>{
  if(externalUnavailable)return route.fulfill({status:503,headers,body:'{"error":"temporary"}'});
  return route.fallback();
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#match-stats-note")).toContainText("nur teilweise abrufbar");
 await expect(page.locator("#match-stats-source")).toContainText("unvollständig");
 await expect(page.locator("#match-stats-retry")).toBeVisible();
 await expect(page.locator("#match-stats-source-link")).toHaveAttribute("href",
  "https://badhub.de/spieler/"+PLAYER+"?saison=all&src=gesamt");
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("–");
 externalUnavailable=false;
 await page.locator("#match-stats-retry").click();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await expect(page.locator("#match-stats-retry")).toBeHidden();
});

test("Import progress counts stored rows, not the server processing cursor",async ({page})=>{
 await page.route("**/player_external_match_imports?*",route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get("dbv_id")==="eq."+PLAYER)return route.fulfill({
   status:200,headers,body:JSON.stringify([{
    dbv_id:PLAYER,status:"partial",cursor_offset:4,verified_count:5,
    rejected_count:1,last_finished_at:"2026-10-10T12:00:00Z"
   }])
  });
  return route.fallback();
 });
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#external-match-progress")).toContainText("1 von 5");
 await expect(page.locator("#external-match-progress")).toContainText("4 Quellkarten verarbeitet");
 await expect(page.locator("#external-match-progress")).not.toContainText("4 von 5");
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
 await expect(page.locator("#external-match-progress")).toContainText("Letzter dokumentierter Importversuch");
});

test("Historical source validation matches the Home statistics",async ({page})=>{
 await page.route("**/player_external_match_facts?*",route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get("dbv_id")==="eq."+PLAYER)return route.fulfill({
   status:200,headers,body:JSON.stringify([
    sourceRecord,{...sourceRecord,source_key:"bad-winner",winning_side:2}
   ])
  });
  return route.fallback();
 });
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
 await expect(page.locator("#external-match-progress")).toContainText("1 unklare oder doppelte Quellkarten");
 await expect(page.locator("#external-match-list .external-match-item")).toHaveCount(1);
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
});

test("Historical source failure has real retry and does not claim zero matches",async ({page})=>{
 let fail=true;
 await page.route("**/player_external_match_facts?*",route=>
  fail?route.fulfill({status:503,headers,body:'{"error":"temporary"}'}):route.fallback());
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#external-match-progress")).toContainText("gerade nicht erreichbar");
 await expect(page.locator("#external-match-count")).toContainText("nicht geprüft");
 await expect(page.locator("#external-match-retry")).toBeVisible();
 fail=false;
 await page.locator("#external-match-retry").click();
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
 await expect(page.locator("#external-match-retry")).toBeHidden();
});

test("Friend viewing never changes which own profile Home returns to",async ({page})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-spieler")).toBeVisible();
 await page.locator('[data-view-friend="'+FRIEND+'"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
 // The user intentionally remains on Home while viewing a friend.
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator(".focused-profile")).toContainText("Philipp Metzger");
 await expect(page.locator(".focused-profile")).not.toContainText("Sarah Storz");
 await expect(page.locator(".bottom-nav a[aria-current='page']")).toHaveCount(1);
 await expect(page.locator("#view-start")).toBeVisible();
});

test("Turniertag is task-first; source-free status is calm and history is reachable",async ({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator("#live-player-select")).toBeVisible();
 await expect(page.locator("#live-radar-content")).toContainText("Derzeit kein Turniertag gemeldet");
 await expect(page.locator("#live-radar-content")).not.toContainText("Live-Abgleich veraltet");
 await page.locator("#live-player-select").selectOption(FRIEND);
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
 await expect(page.locator("#view-turniere")).toBeVisible();
 await page.locator('#view-turniere a[href="#historie"]:visible').first().click();
 await expect(page.locator("#view-historie")).toBeVisible();
 await expect(page.locator('.bottom-nav a[data-page="turniere"]')).toHaveAttribute("aria-current","page");
 await expect(page).toHaveTitle(/Turnierhistorie/);
});

test("Search is empty before criteria and modal remains dismissible",async ({page})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#library-results")).toContainText("Spieler suchen");
 await expect(page.locator("#library-count")).toContainText(/Suche starten|Spieler suchen/);
 await page.locator("#add-player").click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await expect(page.locator("#cancel-dialog")).toBeVisible();
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#player-dialog")).not.toBeVisible();
});

test("Offline hint is informative and clears on reconnection",async ({page,context})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#connection-status")).toBeHidden();
 await context.setOffline(true);
 await expect(page.locator("#connection-status")).toBeVisible();
 await expect(page.locator("#connection-status")).toContainText("Keine Verbindung");
 await context.setOffline(false);
 await expect(page.locator("#connection-status")).toBeHidden();
});


test("Backup in Einstellungen creates a local JSON and restores only after confirmation",async ({page})=>{
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#backup-title")).toBeVisible();
 const downloadPromise=page.waitForEvent("download");
 await page.locator("#backup-export").click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/^schmetterlinge-sicherung-\d{4}-\d\d-\d\d\.json$/);
 await expect(page.locator("#backup-feedback")).toContainText("Sicherung erstellt");

 const imported={
  kind:"schmetterlinge-local-backup",schemaVersion:1,
  createdAt:"2026-10-10T15:00:00.000Z",
  data:{
   players:[{id:PLAYER,name:"Philipp Backup",birthYear:2016,club:"SpVgg Mössingen"}],
   friends:[{id:"05-070006",name:"Vinzent Ott",club:"SpVgg Mössingen"}],
   officialLinks:[],activeProfileId:PLAYER,chosen:PLAYER,historyProfilesInitialized:true
  }
 };
 await page.locator("#backup-file").setInputFiles({
  name:"schmetterlinge-sicherung-test.json",mimeType:"application/json",
  buffer:Buffer.from(JSON.stringify(imported))
 });
 await expect(page.locator("#backup-feedback")).toContainText("Eigene Profile: 1");
 await expect(page.locator("#backup-restore")).toBeEnabled();
 page.once("dialog",async confirmation=>{
  expect(confirmation.message()).toContain("werden ersetzt");
  await confirmation.accept();
 });
 await page.locator("#backup-restore").click();
 await expect(page.locator(".focused-profile")).toContainText("Philipp Backup");
 const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(actual.players).toHaveLength(1);
 expect(actual.friends).toEqual([expect.objectContaining({id:"05-070006",name:"Vinzent Ott"})]);
 expect(actual.activeProfileId).toBe(PLAYER);
});

test("Invalid backup is rejected without changing local family state",async ({page})=>{
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 const before=await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"));
 const bad={
  kind:"schmetterlinge-local-backup",schemaVersion:1,
  createdAt:"2026-10-10T15:00:00.000Z",
  data:{players:[{id:PLAYER,name:"Injected",url:"javascript:alert(1)"}],
   friends:[],officialLinks:[],activeProfileId:PLAYER}
 };
 await page.locator("#backup-file").setInputFiles({
  name:"invalid.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(bad))
 });
 await expect(page.locator("#backup-feedback")).toContainText("https");
 await expect(page.locator("#backup-restore")).toBeDisabled();
 expect(await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"))).toBe(before);
});
