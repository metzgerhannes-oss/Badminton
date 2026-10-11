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
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(5);
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
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(4);
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
 await expect(page.locator("#tournament-live-select")).toHaveValue(TOURNAMENT_ID);
 await expect(page.locator(".event-match-card")).toHaveCount(2);
 await expect(page.locator("#tournament-live-count")).toContainText("2 importierte Matches");
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
test("No verified import is never presented as an empty official tournament",async ({page})=>{
 await page.goto("/#live",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#tournament-live-content")).toContainText("Noch kein turnierweiter Spielplan importiert");
 await expect(page.locator("#tournament-live-count")).toContainText("Noch keine importierten Matchdaten");
 await expect(page.locator("#tournament-live-content")).not.toContainText("0 Spiele im Turnier");
});
