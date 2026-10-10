import {test,expect} from "@playwright/test";
const PLAYER="05-070879";
test.beforeEach(async ({page})=>{
 await page.addInitScript(id=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id,name:"Philipp Metzger",birthYear:2016,club:"SpVgg Mössingen"}],
   friends:[],officialLinks:[],activeProfileId:id,chosen:id,historyProfilesInitialized:true
  }));
 },PLAYER);
 await page.route("https://**/*.supabase.co/**",route=>route.fulfill({
  status:200,contentType:"application/json",body:"[]",
  headers:{"Access-Control-Allow-Origin":"*"}
 }));
});
test("Compact iPhone layout and dialog buttons remain operable",async ({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#spieler");
 for(const tab of await page.locator(".bottom-nav a").all()){
  const box=await tab.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
 }
 await page.locator("#add-player").click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.locator("#player-dialog button[type=submit]").scrollIntoViewIfNeeded();
 await expect(page.locator("#player-dialog button[type=submit]")).toBeVisible();
 await page.screenshot({path:info.outputPath("compact-player-form.png")});
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#player-dialog")).not.toBeVisible();
});
