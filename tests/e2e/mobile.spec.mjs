import {test,expect} from "./supabase-isolated.fixture.mjs";

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
  if(!localStorage.getItem("schmetterlinge.communitySession.v1"))
   localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
    access_token:"mock-invited-member-jwt",refresh_token:"mock-invited-refresh",
    expires_at:Date.now()+3600000,user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
   }));
 },ownStore());
 await page.route("**/*",async route=>{
  const request=route.request();
  const url=new URL(request.url());
  if(url.origin===ROOT)return route.continue();
  if(request.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(url.hostname.endsWith(".supabase.co")){
   if(url.pathname.endsWith("/rpc/app_access_status"))
    return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
   if(url.pathname.endsWith("/rpc/app_access_history_demand"))
    return route.fulfill({status:200,headers,body:'{"accepted":true,"reused":false}'});
   if(url.pathname.endsWith("/rpc/app_access_player_coverage"))
    return route.fulfill({status:200,headers,body:JSON.stringify({
     dbv_id:JSON.parse(request.postData()||"{}").p_player_dbv_id,
     match_cards:1,placements:0,top_four:0,import_status:"partial"
    })});
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
   if(url.pathname.endsWith("/rpc/request_player_history_demand"))
    return route.fulfill({status:200,headers,body:'{"accepted":true,"reused":false}'});
   if(url.pathname.includes("/functions/v1/"))
    return route.fulfill({status:200,headers,body:'{"queued":false,"reason":"already_present"}'});
   return route.fulfill({status:200,headers,body:JSON.stringify(data)});
  }
  // The app must remain usable without a real third-party server during QA.
  return route.fulfill({status:200,headers,body:"[]"});
 });
});

test("Following stays device-local and immediately requests an authorized shared source check",async ({page})=>{
 const imports=[];
 page.on("request",request=>{
  if(request.method()==="POST"&&new URL(request.url()).pathname==="/rest/v1/rpc/app_access_history_demand")
   imports.push(JSON.parse(request.postData()||"{}"));
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>window.badmintonLibraryToggleFollow({id:"05-123456",name:"Testperson",club:"Testverein"}));
 await expect.poll(()=>imports.some(request=>request.p_player_dbv_id==="05-123456"),{timeout:10000}).toBe(true);
 expect(imports.every(request=>Object.keys(request).join(",")==="p_player_dbv_id")).toBe(true);
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect.poll(()=>imports.some(request=>request.p_player_dbv_id===PLAYER),{timeout:10000}).toBe(true);
});

test("An invited member sees individually sourced match statistics and navigable proof cards",async({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Philipp");
 await expect(page.locator("#match-stats-values")).toBeVisible();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("1");
 await expect(page.locator("#match-stats-values .match-stat.losses strong")).toHaveText("0");
 await expect(page.locator("#match-stats-source")).toContainText("Bisher belegte Spiele");
 await expect(page.locator("#match-stats-details")).toBeVisible();
 // v180: only real outcomes and direct proof navigation remain on Home.
 await expect(page.locator("#match-stats-source-link")).toBeHidden();
 await expect(page.locator("#match-stats-provenance")).toBeHidden();
 await expect(page.locator(".home-stats-link")).toBeVisible();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
});

test("v153: screenshot regression – own AK totals survive restricted official source and missing coverage",async({page})=>{
 const calls=[];
 await page.route("**/player_match_observations?*",route=>{
  calls.push(route.request().url());
  return route.fulfill({status:403,headers,body:'{"code":"42501"}'});
 });
 await page.route("**/rpc/app_access_player_coverage",route=>
  route.fulfill({status:503,headers,body:'{"error":"temporary"}'}));
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await page.locator("#home-match-filter-panel > summary").click();
 await page.locator("#match-stats-age").selectOption("own");
 await expect(page.locator("#match-stats-values .match-stat.wins strong")).toHaveText("1");
 await expect(page.locator("#match-stats-retry")).toBeHidden();
 await expect(page.locator("#match-stats-note")).not.toContainText("teilweise abrufbar");
 expect(calls).toHaveLength(0);
});
test("Coverage RPC outage must not hide individually verified match cards",async ({page})=>{
 let coverageUnavailable=true;
 await page.route("**/rpc/app_access_player_coverage",route=>{
  if(coverageUnavailable)return route.fulfill({status:503,headers,body:'{"error":"temporary"}'});
  return route.fallback();
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await expect(page.locator("#match-stats-note")).toContainText("Bisher belegte Spiele");
 await expect(page.locator("#match-stats-source")).toContainText("Bisher belegte Spiele");
 await expect(page.locator("#match-stats-retry")).toBeHidden();
 await expect(page.locator("#match-stats-source-link")).toHaveAttribute("href",
  "https://badhub.de/spieler/"+PLAYER+"?saison=all&src=gesamt");
 coverageUnavailable=false;
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
});

test("Import coverage counts stored rows, never invents a processing cursor",async ({page})=>{
 await page.route("**/rpc/app_access_player_coverage",route=>{
  const body=JSON.parse(route.request().postData()||"{}");
  if(body.p_player_dbv_id===PLAYER)return route.fulfill({
   status:200,headers,body:JSON.stringify({dbv_id:PLAYER,
    match_cards:5,placements:0,top_four:0,import_status:"partial",
    last_import:"2026-10-10T12:00:00Z"})
  });
  return route.fallback();
 });
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#external-match-progress")).toContainText("1 von 5");
 await expect(page.locator("#external-match-progress")).not.toContainText("4 von 5");
 await expect(page.locator("#external-match-progress")).toContainText("Letzter dokumentierter Importversuch");
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
});

// Legacy public-history screenshot fixtures are no longer shipped to visitors.
// Resume these only with synthetic, explicitly authenticated private fixtures.
test.skip("Club-confirmed win is displayed separately from scored matches",async ({page})=>{
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#history-timeline .history-event").first()).toBeVisible();
 await page.evaluate(()=>window.renderHistory("05-071969",[
  {id:"05-071969",name:"Charlotte Metzger"},{id:"05-070879",name:"Philipp Metzger"}
 ],{mode:"own"}));
 const note=page.locator("#history-timeline .history-match-evidence");
 await expect(note).toHaveCount(1);
 await expect(note).toContainText("mindestens 1 Sieg bestätigt");
 await expect(note).toContainText("nicht in der Spielstatistik enthalten");
 // Both sourced Charlotte tournaments remain visible; only the older event contains the club-confirmed win.
 await expect(page.locator("#history-timeline .history-event")).toHaveCount(2);
 const witnessedEvent=page.locator("#history-timeline .history-event").filter({hasText:"4. E-Rangliste Südwürttemberg"});
 await expect(witnessedEvent).toHaveCount(1);
 await expect(witnessedEvent.locator(".history-match-evidence")).toHaveCount(1);
 await expect(witnessedEvent.locator(".history-source-link")).toHaveAttribute("href",
  "https://spvgg.org/abteilungen/badminton/aktuelles/4-e-rangliste-suedwuerttemberg-u11-u19-am-26-september-2026");
 await expect(page.locator("#history-timeline .history-event").filter({hasText:"55. Baden-Württembergische Meisterschaft"})).toHaveCount(1);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test("Crossfed DBV tournament proofs keep their own source URL and year",async ({page})=>{
 await page.route("**/player_external_match_facts?*",route=>{
  const url=new URL(route.request().url());
  if(url.searchParams.get("dbv_id")==="eq."+PLAYER)return route.fulfill({
   status:200,headers,body:JSON.stringify([sourceRecord,{
    ...sourceRecord,source_key:"tournament:dbv-950:me-u17:ko:verified",
    source_url:"https://badhub.de/dbv/turnier.php?id=950",
    competition:"DBV-Turnier 2025",competition_id:"950",match_year:2025,
    match_date:"2025-12-12",opponent_names:["Beleggegner"]
   }])
  });
  return route.fallback();
 });
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#external-match-count")).toContainText("2 einzeln belegte Spiele");
 await expect(page.locator("#external-match-list .external-match-item")).toHaveCount(2);
 await expect(page.locator('#external-match-list a[href="https://badhub.de/dbv/turnier.php?id=950"]')).toHaveCount(1);
 await page.locator("#external-match-year").selectOption("2025");
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
});

test.skip("Sourced friend tournament placements remain separate from individual match facts",async ({page})=>{
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#history-timeline .history-event").first()).toBeVisible();
 const profiles=[
  {id:"05-070879",name:"Philipp Metzger"},
  {id:"05-071969",name:"Charlotte Metzger"},
  {id:"05-061350",name:"Sarah Storz"},
  {id:"05-070006",name:"Vinzent Pius Ott"}
 ];
 await page.evaluate(profiles=>window.renderHistory("05-061350",profiles,{mode:"friend"}),profiles);
 await expect(page.locator("#history-timeline")).toContainText("2. C-Rangliste BW");
 await expect(page.locator("#history-timeline")).toContainText("3.");
 await expect(page.locator("#history-timeline")).toContainText("Raphael Argast");
 await expect(page.locator("#history-timeline")).toContainText("1. B-Rangliste SüdOst");
 await expect(page.locator("#trophy-shelf")).toBeVisible();
 await expect(page.locator("#history-timeline .history-event").filter({hasText:"2. C-Rangliste BW"}).locator(".history-source-link")).toHaveAttribute("href",
  "https://spvgg.org/abteilungen/badminton/aktuelles/2-c-rangliste-bw-u11-u19-am-28-februar-1-maerz-2026");
 await page.evaluate(profiles=>window.renderHistory("05-070006",profiles,{mode:"friend"}),profiles);
 await expect(page.locator("#history-timeline")).toContainText("2. C-Rangliste BW");
 await expect(page.locator("#history-timeline")).toContainText("19.");
 await expect(page.locator("#history-timeline")).not.toContainText("Raphael Argast");
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).not.toHaveText("2");
});

test.skip("Older verified 2025 B-Ranglisten appear for followed players without invented matches",async ({page})=>{
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#history-timeline .history-event").first()).toBeVisible();
 const profiles=[
  {id:"05-070879",name:"Philipp Metzger"},{id:"05-071969",name:"Charlotte Metzger"},
  {id:"05-061350",name:"Sarah Storz"},{id:"05-070006",name:"Vinzent Pius Ott"}
 ];
 await page.evaluate(p=>window.renderHistory("05-061350",p,{mode:"friend"}),profiles);
 await expect(page.locator("#history-timeline")).toContainText("2. B-Rangliste SüdOst");
 await expect(page.locator("#history-timeline")).toContainText("3. B-Rangliste SüdOst");
 await expect(page.locator('#history-timeline a.history-source-link[href="https://spvgg.org/abteilungen/badminton/aktuelles/2-b-rangliste-suedost-u13-u19-am-17-18-mai-2025"]')).toHaveCount(1);
 await expect(page.locator('#history-timeline a.history-source-link[href="https://spvgg.org/abteilungen/badminton/aktuelles/3-b-rangliste-suedost-u13-u19-am-5-6-juli-2025"]')).toHaveCount(1);
 await page.evaluate(p=>window.renderHistory("05-070006",p,{mode:"friend"}),profiles);
 await expect(page.locator("#history-timeline")).toContainText("34. Südwürttembergische Meisterschaft");
 await expect(page.locator("#history-timeline")).toContainText("Ruixiang Wang");
 await expect(page.locator('#history-timeline a.history-source-link[href="https://spvgg.org/abteilungen/badminton/aktuelles/34-suedwuerttembergische-meisterschaft-u11-u19-am-12-juli-2025"]')).toHaveCount(1);
});

test.skip("Scored club reports show real opponents and sets without mixing Badhub statistics",async ({page})=>{
 await page.goto("/#historie",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#history-timeline .history-event").first()).toBeVisible();
 const roster=[{id:"05-070879",name:"Philipp Metzger"},{id:"05-071969",name:"Charlotte Metzger"},
  {id:"05-061350",name:"Sarah Storz"},{id:"05-070006",name:"Vinzent Pius Ott"}];
 // Count is loaded asynchronously and can be briefly reset by a background refresh.
 // Assert a grounded value before and after switching the historical proof viewer.
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
 await page.evaluate(roster=>window.renderHistory("05-070006",roster,{mode:"friend"}),roster);
 const vinzent=page.locator("#history-timeline .history-scored-match-proof");
 await expect(vinzent).toHaveCount(1);
 await expect(vinzent.locator("li")).toHaveCount(3);
 await expect(vinzent).toContainText("Ruixiang Wang");
 await expect(vinzent).toContainText("14:21 · 25:23 · 17:21");
 await expect(vinzent).toContainText("Paul Wader");
 await expect(vinzent).toContainText("21:8 · 21:8");
 await page.evaluate(roster=>window.renderHistory("05-061350",roster,{mode:"friend"}),roster);
 const sarah=page.locator("#history-timeline .history-scored-match-proof");
 await expect(sarah.locator("li")).toHaveCount(2);
 await expect(page.locator("#history-timeline")).toContainText("Annika Karmann");
 await expect(page.locator("#history-timeline")).toContainText("19:21 · 19:21");
 await expect(page.locator("#history-timeline")).toContainText("Eva Heiden / Maya Yildiz");
 await expect(page.locator("#external-match-count")).toContainText("1 einzeln belegte Spiele");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
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
 await expect(page.locator("#match-stats-reference")).toBeHidden();
 await expect(page.locator("#match-stats-values")).toBeVisible();
 await expect(page.locator("#match-stats-values .match-stat.matches strong")).toHaveText("1");
 await expect(page.locator("#match-stats-note")).toContainText("Bisher belegte Spiele");
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

test("Live tab shows personal matchday and a verified official tournament link",async ({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const part=type=>today.find(x=>x.type===type).value;
 const date=part("year")+"-"+part("month")+"-"+part("day");
 const id="E24DC6EE-152A-454D-B00C-E625B751D7D5";
 await page.evaluate(({date,id})=>{
  const key="shuttleboard-v1";const saved=JSON.parse(localStorage.getItem(key));
  saved.officialLinks=[{id,url:"https://dbv.turnier.de/tournament/"+id,name:"Test Jugendturnier",
   startDate:date,endDate:date,playerId:"05-070879"}];
  localStorage.setItem(key,JSON.stringify(saved));
 },{date,id});
 await page.route("**/player_live_snapshots?*",route=>route.fulfill({status:200,headers,body:JSON.stringify([{
  dbv_id:PLAYER,provider:"Badhub",source_url:"https://badhub.de/spieler/"+PLAYER+"/live",
  checked_at:new Date().toISOString(),payload:{tournament:{name:"Test Jugendturnier"},
   running:{match_id:"m1",class:"HE U11",opponent:"Gegner A",is_team1:1,sets:[[11,8]],court:"Feld 3"},
   next:{queue_position:0},upcoming:[{match_id:"m1"},{match_id:"m2",class:"HD U11",opponent:"Gegner B"}],
   past:[{match_id:"m0",class:"HE U11",team1_won:true,is_team1:1,sets:[[11,7],[11,9]]}],entries:[]}
  }])}));
 await page.reload({waitUntil:"domcontentloaded"});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 await expect(page.locator(".matchday-overview")).toBeVisible();
 await expect(page.locator("#live-radar-content")).toContainText("Jetzt auf dem Feld");
 await expect(page.locator("#live-radar-content")).toContainText("Deine nächsten Spiele");
 await expect(page.locator("#live-radar-content")).toContainText("Bereits gespielte Begegnungen");
 await expect(page.locator("#live-radar-content .radar-match")).toHaveCount(3);
 await expect(page.locator("#live-radar-content .matchday-current")).toBeVisible();
 const order=await page.locator("#live-radar-content").evaluate(host=>{
  const game=host.querySelector(".matchday-current"),counts=host.querySelector(".matchday-overview");
  return game&&counts&&Boolean(game.compareDocumentPosition(counts)&Node.DOCUMENT_POSITION_FOLLOWING);
 });
 expect(order).toBe(true,"The actual game must come before secondary counts");

 await expect(page.locator("#live-tournament-links a").first()).toHaveAttribute("href","https://dbv.turnier.de/tournament/"+id);
 await expect(page.locator(".bottom-nav a[aria-current='page']")).toHaveCount(1);
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
 await page.goto("/#einstellungen");
 await page.locator('a[data-settings-target="profile"]').click();
 await expect(page.locator("#settings-room-profile")).toBeVisible();
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
 await expect(page.locator("#backup-title")).toBeHidden();
 await page.locator('a[data-settings-target="daten"]').click();
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

test("Settings rooms: followed players have their own searchable page and deep link",async ({page})=>{
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-hub")).toBeVisible();
 await expect(page.locator("#friend-settings-list")).toBeHidden();
 await expect(page.locator("#team-settings-list")).toBeHidden();
 await expect(page.locator("#backup-export")).toBeHidden();
 await page.locator('a[data-settings-target="spieler"]').click();
 await expect(page).toHaveURL(/#einstellungen\/spieler$/);
 await expect(page.locator("#friend-settings-list")).toBeVisible();
 await expect(page.locator("#friend-settings-list")).toContainText("Sarah Storz");
 await page.locator("#settings-followed-player-search").fill("unbekannt");
 await expect(page.locator("#settings-followed-empty")).toBeVisible();
 await page.locator("#settings-followed-player-search").fill("Sarah");
 await expect(page.locator("#settings-followed-empty")).toBeHidden();
 await page.locator('#settings-room-spieler a[href="#einstellungen"]').click();
 await expect(page.locator("#settings-room-hub")).toBeVisible();
 await page.goto("/#einstellungen/mannschaften",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-mannschaften")).toBeVisible();
 await page.goto("/#einstellungen/darstellung",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-language")).toBeVisible();
 await page.goto("/#einstellungen/daten",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#backup-export")).toBeVisible();
});

test("Invalid backup is rejected without changing local family state",async ({page})=>{
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 await page.locator('a[data-settings-target="daten"]').click();
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
