import {test,expect} from "@playwright/test";

const PLAYER="05-070879";
const FRIEND="05-061350";
const TOURNAMENT_ID="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const KEY="shuttleboard-v1";
const today=()=>Object.fromEntries(
  new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date()).map(p=>[p.type,p.value])
);
function dateToday(){const p=today();return p.year+"-"+p.month+"-"+p.day}
test.beforeEach(async ({page})=>{
 await page.addInitScript(({player,friend,key,id})=>{
  const parts=Object.fromEntries(
    new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date()).map(p=>[p.type,p.value]));
  const date=parts.year+"-"+parts.month+"-"+parts.day;
  if(!localStorage.getItem("matchday-nav-test")){
   localStorage.setItem(key,JSON.stringify({
    players:[{id:player,name:"Eigener Spieler"}],
    friends:[{id:friend,name:"Verfolgter Spieler"}],
    officialLinks:[{id,url:"https://dbv.turnier.de/tournament/"+id,
      name:"Turniertag Test",playerId:player,startDate:date,endDate:date}],
    activeProfileId:player,chosen:player,historyProfilesInitialized:true
   }));
  }
 },{player:PLAYER,friend:FRIEND,key:KEY,id:TOURNAMENT_ID});
 await page.route("**/*.supabase.co/**",route=>route.fulfill({
  status:200,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
  body:route.request().method()==="POST"?'{"queued":false}':"[]"
 }));
});
test("Saved tournament makes LIVE a prominent fifth tab without duplicate score feeds",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(6);
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 const rect=await page.locator("#live-nav-tab").boundingBox();
 expect(rect?.width).toBeGreaterThanOrEqual(44);
 expect(rect?.height).toBeGreaterThanOrEqual(44);
 await page.locator("#live-nav-tab").click();
 await expect(page).toHaveURL(/#live$/);
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator("#live-radar-content")).toBeVisible();
 await expect(page.locator(".live-hub-bookmarks")).toBeHidden();
 await expect(page.locator("#live-nav-tab")).toHaveAttribute("aria-current","page");
 await page.locator("#live-player-select").selectOption(FRIEND);
 await expect(page).toHaveURL(/#live$/);
 await expect(page.locator(".focused-profile")).toContainText("Verfolgter Spieler");
 await page.locator(".live-tournaments-return").click();
 await expect(page).toHaveURL(/#turniere$/);
 await expect(page.locator(".live-hub-bookmarks")).toBeVisible();
});
test("Expired tournament removes LIVE tab but ordinary tournament route remains",async ({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 await page.evaluate(key=>{
  const stored=JSON.parse(localStorage.getItem(key));
  stored.officialLinks[0].startDate="2020-01-01";
  stored.officialLinks[0].endDate="2020-01-01";
  localStorage.setItem(key,JSON.stringify(stored));
  localStorage.setItem("matchday-nav-test","1");
 },KEY);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeHidden();
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(5);
 await page.locator('.bottom-nav a[data-page="turniere"]').click();
 await expect(page.locator("#live-radar-content")).toBeVisible();
});


test("Tournament-wide browser shows only sourced matches and supports fields and status filters",async ({page})=>{
 const eventDbId="11111111-2222-4333-8444-555555555555";
 const match1="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 const match2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
 await page.route("**/rest/v1/tournaments?*",route=>route.fulfill({
  status:200,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
  body:JSON.stringify([{id:eventDbId,name:"Turniertag Test",source_url:"https://dbv.turnier.de/tournament/"+TOURNAMENT_ID}])
 }));
 await page.route("**/rest/v1/matches?*",route=>route.fulfill({
  status:200,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
  body:JSON.stringify([
   {id:match1,tournament_id:eventDbId,status:"playing",court:"2",
    scheduled_at:new Date().toISOString(),last_synced_at:new Date().toISOString(),
    events:{title:"JE U11"},match_participants:[
     {side:1,player_position:1,players:{name:"Eigener Spieler"}},
     {side:2,player_position:1,participant_name:"Rivalin"}],
    match_games:[{game_number:1,side1_points:11,side2_points:9}]},
   {id:match2,tournament_id:eventDbId,status:"finished",court:"3",
    scheduled_at:new Date().toISOString(),last_synced_at:new Date().toISOString(),
    events:{title:"HD U11"},match_participants:[
     {side:1,player_position:1,participant_name:"Team A"},
     {side:2,player_position:1,participant_name:"Team B"}],
    match_games:[{game_number:1,side1_points:15,side2_points:11}]}
  ])
 }));
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator('[data-matchday-view="mine"]')).toHaveAttribute("aria-pressed","true");
 await expect(page.locator(".live-dbv")).toBeVisible();
 await expect(page.locator(".live-tournament-follow")).toBeHidden();
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator(".live-dbv")).toBeHidden();
 await expect(page.locator(".live-tournament-follow")).toBeVisible();
 await expect(page.locator("#tournament-live-select")).toHaveValue(TOURNAMENT_ID);
 await expect(page.locator(".event-match-card")).toHaveCount(2);
 await expect(page.locator("#tournament-live-count")).toContainText("2 belegte Spiele");
 await expect(page.locator("#tournament-live-content")).toContainText("11:9");
 await expect(page.locator("#tournament-live-content")).toContainText("15:11");
 await page.locator('[data-tournament-status="finished"]').click();
 await expect(page.locator(".event-match-card")).toHaveCount(1);
 await expect(page.locator(".event-match-card")).toContainText("HD U11");
 await page.locator('[data-tournament-status="all"]').click();
 await page.locator("#tournament-court-filter").selectOption("2");
 await expect(page.locator(".event-match-card")).toHaveCount(1);
 await expect(page.locator(".event-match-card")).toContainText("JE U11");
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await expect(page.locator('#live-tournament-links a').first()).toHaveAttribute("href","https://dbv.turnier.de/tournament/"+TOURNAMENT_ID);
});
test("DBV event is immediately available; extra Badhub source stays optional",async ({page})=>{
 const eventRequests=[];
 page.on("request",request=>{
  if(request.url().includes("schmetterlinge-event-feed")&&request.url().includes("/v1/event"))
   eventRequests.push(request.url());
 });
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#tournament-live-select")).toHaveValue(TOURNAMENT_ID);
 await expect(page.locator('#live-tournament-links a')).toHaveAttribute("href",
  "https://dbv.turnier.de/tournament/"+TOURNAMENT_ID);
 await expect(page.locator("#badhub-event-panel")).toBeVisible();
 await expect(page.locator("#badhub-event-form")).toBeHidden();
 expect(eventRequests).toHaveLength(0);
 await page.locator("#badhub-event-panel > summary").click();
 await expect(page.locator("#badhub-event-results")).toContainText("keine eindeutig zugeordnete Badhub-Quelle");
 await expect(page.locator("#badhub-event-form")).toBeHidden();
 await page.locator("#badhub-event-manual > summary").click();
 await expect(page.locator("#badhub-event-form")).toBeVisible();
 await expect(page.locator('#live-tournament-links a')).toHaveAttribute("href",
  "https://dbv.turnier.de/tournament/"+TOURNAMENT_ID);
 expect(eventRequests).toHaveLength(0);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
});

test("No verified import is never presented as an empty official tournament",async ({page})=>{
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".live-tournament-follow")).toBeHidden();
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator(".live-tournament-follow")).toBeVisible();
 await expect(page.locator("#tournament-live-content")).toContainText("Noch keine Begegnungen importiert");
 await expect(page.locator("#tournament-live-filters")).toBeHidden();
 await expect(page.locator("#tournament-live-count")).toBeHidden();
 await expect(page.locator("#tournament-live-content")).not.toContainText("0 Spiele im Turnier");
});

test("Switches focus without parallel full-event queries and restores personal view",async ({page})=>{
 const hits=[];
 page.on("request",req=>{
  if(new URL(req.url()).pathname==="/rest/v1/tournaments")hits.push("tournaments");
  if(new URL(req.url()).pathname==="/rest/v1/matches")hits.push("matches");
 });
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".live-dbv")).toBeVisible();
 await expect(page.locator(".live-tournament-follow")).toBeHidden();
 expect(hits).toHaveLength(0);
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator(".live-tournament-follow")).toBeVisible();
 await expect(page.locator(".live-dbv")).toBeHidden();
 await expect.poll(()=>hits.length).toBeGreaterThan(0);
 await expect(page.locator('[data-matchday-view="all"]')).toHaveAttribute("aria-pressed","true");
 await page.locator('[data-matchday-view="mine"]').click();
 await expect(page.locator(".live-dbv")).toBeVisible();
 await expect(page.locator(".live-tournament-follow")).toBeHidden();
 await page.locator(".live-tournaments-return").click();
 await expect(page).toHaveURL(/#turniere$/);
 await expect(page.locator(".live-hub-bookmarks")).toBeVisible();
 await expect(page.locator(".live-tournament-follow")).toBeVisible();
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator('[data-matchday-view="mine"]')).toHaveAttribute("aria-pressed","true");
});

test("Verified player snapshots produce real multi-player LIVE cards without claiming whole-event coverage",async ({page})=>{
 const now=new Date().toISOString();
 await page.route("**/rest/v1/player_live_snapshots?*",route=>route.fulfill({
  status:200,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
  body:JSON.stringify([
   {dbv_id:PLAYER,provider:"Badhub",source_url:"https://badhub.de/spieler/"+PLAYER+"/live",
    checked_at:now,payload:{tournament:{name:"Jugendcup"},
     running:{match_id:"m17",class:"JE U11",opponent:"Gegnerin A",is_team1:1,sets:[[15,9],[8,9]],court:"Feld 4"},
     next:null,upcoming:[],past:[],entries:[]}},
   {dbv_id:FRIEND,provider:"Badhub",source_url:"https://badhub.de/spieler/"+FRIEND+"/live",
    checked_at:now,payload:{tournament:{name:"Jugendcup"},
     running:null,next:{queue_position:1},upcoming:[{match_id:"m99",class:"DE U13",opponent:"Gegnerin B"}],
     past:[],entries:[]}}
  ])
 }));
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".followed-live")).toBeHidden();
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator(".followed-live-card")).toHaveCount(2);
 await expect(page.locator(".followed-live-card").first()).toContainText("Eigener Spieler");
 await expect(page.locator(".followed-live-card").first()).toContainText("15:9");
 await expect(page.locator(".followed-live-card").first()).toContainText("Spielt gerade");
 await expect(page.locator(".followed-live-card").nth(1)).toContainText("Verfolgter Spieler");
 await expect(page.locator(".followed-live-card").nth(1)).toContainText("Noch ein Spiel davor");
 await expect(page.locator(".followed-live-note")).toContainText("Nicht sämtliche Spiele");
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.locator(".followed-live-card").nth(1).getByRole("button",{name:"Meine Spiele ansehen"}).click();
 await expect(page.locator('[data-matchday-view="mine"]')).toHaveAttribute("aria-pressed","true");
 await expect(page.locator("#live-player-select")).toHaveValue(FRIEND);
});
test("Stale player snapshots must not present old sets as live scores",async ({page})=>{
 await page.route("**/rest/v1/player_live_snapshots?*",route=>route.fulfill({
  status:200,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
  body:JSON.stringify([{
   dbv_id:PLAYER,provider:"Badhub",source_url:"https://badhub.de/spieler/"+PLAYER+"/live",
   checked_at:new Date(Date.now()-20*60000).toISOString(),
   payload:{tournament:{name:"Gestern"},running:{sets:[[15,2]],class:"JE U11"},
    next:null,upcoming:[],past:[],entries:[]}
  }])
 }));
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator(".followed-live-card").first()).not.toContainText("15:2");
 await expect(page.locator(".followed-live-card").first()).not.toContainText("Spielt gerade");
});



test("Real Badhub event results from verified Worker display winning doubles and published sets",async ({page})=>{
 const provider="https://badhub.de/bvbb/turnier.php?id=4962";
 await page.route("**/v1/event?*",route=>{
  const url=new URL(route.request().url());
  const discipline=url.searchParams.get("disc")||"";
  const payload={provider:"Badhub",kind:"published-event-results",source_url:provider,
   checked_at:new Date().toISOString(),event:{id:"4962",association:"bvbb",name:"BBB 1. CD-RLT U9 2026"},
   disciplines:["winner","player","offenes Doppel U9","offenes Einzel C U9"],
   selected_discipline:discipline||null,
   matches:discipline?[{id:"bvbb:4962:offenes%20Doppel%20U9:1",discipline,round:"Achtelfinale",
    home:"Fahed Islam / Oskar Yi",away:"Leon Schneider-Zhao / Levi Weise",
    sets:["15:11","18:16"],winner:"home",category:"finished"}]:[]};
  return route.fulfill({status:200,contentType:"application/json",
   headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify(payload)});
 });
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator("#badhub-event-form")).toBeHidden();
 await page.locator("#badhub-event-panel > summary").click();
 await page.locator("#badhub-event-manual > summary").click();
 await expect(page.locator("#badhub-event-form")).toBeVisible();
 await page.locator("#badhub-event-url").fill(provider);
 await page.locator("#badhub-event-form button[type=submit]").click();
 await expect(page.locator("#badhub-event-discipline")).toHaveValue("offenes Doppel U9");
 await expect(page.locator(".badhub-match-card")).toHaveCount(1);
 await expect(page.locator(".badhub-match-card")).toContainText("15:11");
 await expect(page.locator(".badhub-match-card")).toContainText("18:16");
 await expect(page.locator(".badhub-match-card .badhub-winner")).toContainText("Fahed Islam");
 await expect(page.locator("#badhub-event-source")).toHaveAttribute("href",provider);
 await expect(page.locator("#badhub-event-note")).toContainText("Kein offizieller DBV-Livefeed");
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator('[data-matchday-view="all"]').click();
 await expect(page.locator("#badhub-event-form")).toBeHidden();
 await page.locator("#badhub-event-panel > summary").click();
 await expect(page.locator("#badhub-event-url")).toHaveValue(provider);
 await expect(page.locator(".badhub-match-card")).toHaveCount(1);
});

test("Published Badhub results remain reachable from Turniere without a live tournament",async ({page})=>{
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#badhub-event-form")).toBeHidden();
 await expect(page.locator("#tournament-live-select")).toBeVisible();
 await expect(page.locator('#live-tournament-links a')).toHaveAttribute("href",
  "https://dbv.turnier.de/tournament/"+TOURNAMENT_ID);
 await expect(page.locator("#live-radar-content")).toBeVisible();
 await expect(page.locator("#tournament-live-content")).toBeHidden();
 await page.locator("#badhub-event-panel > summary").click();
 await page.locator("#badhub-event-manual > summary").click();
 await expect(page.locator("#badhub-event-form")).toBeVisible();
 await page.locator("#badhub-event-url").fill("https://badhub.de/bvbb/turnier.php?id=4962");
 await expect(page.locator("#badhub-event-form button[type=submit]")).toBeEnabled();
});
