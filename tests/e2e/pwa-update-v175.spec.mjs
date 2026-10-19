import {test,expect} from "./invited-member.fixture.mjs";

// Synthetic previous shell release (v177) versus fresh current static probe (v178).
// All production Supabase routes are blocked by the inherited context fixture.
test("iPhone PWA offers the next release and refreshes without deleting existing local profile",async({page})=>{
 let scriptLoads=0,probeLoads=0;
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Gespeichertes Testprofil"}],
   activeProfileId:"05-070879",chosen:"05-070879",
   friends:[],officialLinks:[],historyProfilesInitialized:true
  }));
 });
 await page.route("**/app-release.js**",async route=>{
  const url=new URL(route.request().url());
  const response=await route.fetch();
  const current=await response.text();
  if(url.searchParams.has("pwa-check")){probeLoads++;return route.fulfill({status:200,contentType:"text/javascript",body:current});}
  scriptLoads++;
  return route.fulfill({status:200,contentType:"text/javascript",
   body:scriptLoads===1?current.replace('version:"v178"','version:"v177"'):current});
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto("/index.html#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#pwa-update-prompt")).toBeVisible();
 await expect(page.locator("#pwa-update-prompt")).toContainText("v178");
 await page.locator("#pwa-update-apply").click();
 await expect(page).toHaveURL(/app-update=v178/);
 await expect(page.locator("#pwa-update-prompt")).toHaveCount(0);
 await expect(page.locator("#view-spieler")).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")||"null"));
 expect(saved.players).toHaveLength(1);
 expect(saved.players[0].name).toBe("Gespeichertes Testprofil");
 expect(probeLoads).toBeGreaterThanOrEqual(1);
});

test("already current PWA shows no update prompt at 320px and 390px",async({page})=>{
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#pwa-update-prompt")).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
 }
});
