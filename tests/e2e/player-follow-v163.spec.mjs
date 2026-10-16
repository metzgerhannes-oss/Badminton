import {test,expect} from "./invited-member.fixture.mjs";

// Pure synthetic identity responses. Production Supabase and club APIs are
// blocked by the shared fixture; this test never calls the live backend.
const HEADERS={"Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
 "Content-Type":"application/json"};
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Testprofil",club:"SpVgg Mössingen"}],
   friends:[],officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
});
test("v163: mobile player following stays compact, saves the selection and resets search",async({page})=>{
 await page.setViewportSize({width:375,height:812});
 let lookups=0,rosterLoads=0;
 await page.route("**/data/spvgg-active-roster.json",route=>{
  rosterLoads++;
  return route.fulfill({status:404,body:"Unneeded in follow search"});
 });
 await page.route("**/*.supabase.co/rest/v1/rpc/search_dbv_player_identity",route=>{
  const data=JSON.parse(route.request().postData()||"{}");
  lookups++;
  return route.fulfill({status:200,headers:HEADERS,body:JSON.stringify(
   data.p_query==="Vinzent Pius"?[{
    dbv_id:"05-123456",name:"Vinzent Pius",club:"Beispielverein",
    age_class:"U13",association:"BAW-Baden-Württemberg"
   }]:[]
  )});
 });
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#player-add-open").click();
 await expect(page.locator("#player-discover")).toBeVisible();
 await expect(page.locator("#spvgg-active-roster")).toHaveCount(0);
 await expect(page.locator("#player-search-filters")).not.toHaveAttribute("open","");
 await expect(page.locator("#library-search")).toBeVisible();
 await page.locator("#library-search").fill("Vi");
 await expect(page.locator("#library-count")).toContainText("Suche ab drei Zeichen");
 expect(lookups).toBe(0);
 await page.locator("#library-search").fill("Vinzent Pius");
 await expect(page.locator("#library-count")).toContainText("1 passende Spieler");
 await expect(page.locator(".library-player")).toHaveCount(1);
 await expect(page.locator(".library-player")).toContainText("Vinzent Pius");
 await page.locator(".library-player [data-library-toggle]").click();
 await expect(page.locator("#player-discover")).toBeHidden();
 await expect(page.locator("#friend-list")).toContainText("Vinzent Pius");
 await expect(page.locator("#library-search")).toHaveValue("");
 await expect(page.locator("#player-add-open")).toContainText("Spieler folgen");
 expect(rosterLoads).toBe(0);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#friend-list")).toContainText("Vinzent Pius");
 await page.locator("#player-add-open").click();
 await expect(page.locator("#library-count")).toContainText("Spieler suchen");
 await expect(page.locator("#player-search-filters")).not.toHaveAttribute("open","");
});
test("v163: advanced filters are optional, do not enumerate players on their own",async({page})=>{
 let lookups=0;
 await page.route("**/*.supabase.co/rest/v1/rpc/search_dbv_player_identity",route=>{
  lookups++;
  return route.fulfill({status:200,headers:HEADERS,body:"[]"});
 });
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator("#player-add-open").click();
 await page.locator("#player-search-filters summary").click();
 await page.locator("#library-age").selectOption("U13");
 await page.locator("#library-club").fill("SpVgg Mössingen");
 await expect(page.locator("#library-count")).toContainText("Spieler suchen");
 expect(lookups).toBe(0);
 await page.locator("#library-search").fill("Nichtvorhanden");
 await expect(page.locator("#library-count")).toContainText("0 passende Spieler");
 expect(lookups).toBe(1);
 await page.locator("#library-reset").click();
 await expect(page.locator("#player-search-filters")).not.toHaveAttribute("open","");
 await expect(page.locator("#library-search")).toHaveValue("");
});
