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

test("v64 app chrome keeps four readable, non-overlapping tabs from SE to tablet",async ({page})=>{
 for(const width of [320,375,390,768]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  const tabs=page.locator(".bottom-nav a");
  await expect(tabs).toHaveCount(4);
  await expect(page.locator(".topbar-settings")).toBeVisible();
  await expect(page.locator(".brand-logo")).toBeVisible();
  const frames=[];
  for(const tab of await tabs.all()){
   const rect=await tab.boundingBox();
   expect(rect,"navigation tab must be laid out").toBeTruthy();
   expect(rect.width).toBeGreaterThanOrEqual(44);
   expect(rect.height).toBeGreaterThanOrEqual(44);
   frames.push(rect);
  }
  for(let i=1;i<frames.length;i++){
   expect(frames[i].x).toBeGreaterThanOrEqual(frames[i-1].x+frames[i-1].width-1);
  }
  const style=await page.locator(".bottom-nav a").first().evaluate(el=>getComputedStyle(el).width);
  expect(Number.parseFloat(style)).toBeGreaterThanOrEqual(44);
  const logo=await page.locator(".brand-logo").boundingBox();
  const settings=await page.locator(".topbar-settings").boundingBox();
  expect(logo.x+logo.width).toBeLessThan(settings.x+2);
 }
 await page.locator('.bottom-nav a[data-page="turniere"]').click();
 await expect(page.locator('#view-turniere')).toBeVisible();
 await page.locator(".brand").click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Philipp");
});
