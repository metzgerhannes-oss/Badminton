import {test,expect} from "./invited-member.fixture.mjs";

const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS","Content-Type":"application/json"};
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Lokalprofil Test",club:"Beispielverein"}],
   friends:[],activeProfileId:"05-070879",chosen:"05-070879",officialLinks:[],historyProfilesInitialized:true
  }));
 });
});
test("player search differentiates idle, real zero matches and unavailable identity source",async({page})=>{
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url()),method=route.request().method();
  if(method==="OPTIONS")return route.fulfill({status:204,headers});
  if(url.pathname.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  if(url.pathname.endsWith("/rpc/search_dbv_player_identity"))
   return route.fulfill({status:200,headers,body:"[]"});
  return route.fulfill({status:200,headers,body:"[]"});
 });
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#player-discover")).toBeHidden();
 const visibleSearch=page.locator("#followed-player-search");
 await expect(visibleSearch).toBeVisible();
 const results=page.locator("#library-results");
 await expect(results).toHaveAttribute("data-state","idle");
 await visibleSearch.fill("Nichtvorhanden");
 await expect(page.locator("#player-discover")).toBeVisible();
 await expect(results).toHaveAttribute("data-state","empty");
 await expect(results).toContainText("Keine weiteren DBV-Spieler für diese Suche gefunden.");
 await expect(page.locator("#library-count")).toContainText("0 passende Spieler");
 await page.route("**/*.supabase.co/rest/v1/rpc/search_dbv_player_identity",route=>
  route.fulfill({status:503,headers,body:'{"message":"Simulierter Quellfehler"}'}));
 await visibleSearch.fill("Anderer Testname");
 await expect(results).toHaveAttribute("data-state","limited",{timeout:20000});
 await expect(results).toContainText("Zentrale DBV-Suche derzeit eingeschränkt");
 await expect(page.locator("#library-source")).toContainText("Nur gespeicherte Profile");
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.activeProfileId).toBe("05-070879");
});

test("unavailable tournament data does not become zero confirmed fixtures",async({page})=>{
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers});
  if(url.pathname.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  if(url.pathname.includes("/dbv_calendar_entries"))
   return route.fulfill({status:503,headers,body:'{"message":"Simulierter Datenquellenausfall"}'});
  return route.fulfill({status:200,headers,body:"[]"});
 });
 await page.route("**/data/dbv-calendar.json",route=>
  route.fulfill({status:503,body:"Snapshot testweise nicht erreichbar"}));
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const status=page.locator("#dbv-calendar-status");
 await expect(status).toHaveAttribute("data-state","offline",{timeout:30000});
 await expect(status).toContainText("Kalender");
 await expect(status).not.toContainText("0 passende Turniere");
 await expect(page.locator('a[href="https://turniere.badminton.de/"]').first()).toBeVisible();
});
