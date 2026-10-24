import {test,expect} from "./invited-member.fixture.mjs";
const own=[{id:"99-000001",name:"Eigenes A"},{id:"99-000002",name:"Eigenes B"}];
test.beforeEach(async({page})=>{
 await page.addInitScript(own=>{
  if(!localStorage.getItem("shuttleboard-v1"))
   localStorage.setItem("shuttleboard-v1",JSON.stringify({players:own,friends:[{id:"98-000003",name:"Gefolgt"}],
    officialLinks:[],activeProfileId:own[0].id,chosen:own[0].id,historyProfilesInitialized:true}));
 },own);
});
test("F10 P2-A: private Snake route, pause and own-profile-only records on 320px",async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.goto("/#turniere");
 await page.locator('a[href="#spiele"]').first().click();
 await expect(page.locator("#view-spiele")).toBeVisible();
 await expect(page.locator("#arcade-profile option")).toHaveCount(2);
 await expect(page.locator("#arcade-profile")).not.toContainText("Gefolgt");
 await expect(page.locator("#arcade-time")).toHaveText("120 s");
 await expect(page.locator("#arcade-score")).toHaveText("0");
 const buttons=page.locator(".arcade-controls button");
 for(const b of await buttons.all()){const box=await b.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44)}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 await page.locator("#arcade-start").click();
 await expect(page.locator("#arcade-status")).toContainText("Start in");
 await page.locator("#arcade-pause").click();
 await expect(page.locator("#arcade-status")).toContainText("Pausiert");
 const paused=await page.locator("#arcade-time").textContent();
 await page.waitForTimeout(350);
 expect(await page.locator("#arcade-time").textContent()).toBe(paused);
 await page.locator("#arcade-resume").click();
 await page.locator(".arcade-controls [data-snake-direction=up]").click();
 await page.locator("#arcade-exit").click();
 await expect(page.locator("#view-turniere")).toBeVisible();
 const stored=await page.evaluate(()=>({family:localStorage.getItem("shuttleboard-v1"),arcade:localStorage.getItem("schmetterlinge-arcade-v1")}));
 expect(JSON.parse(stored.family).players).toEqual(own);
 expect(stored.arcade).toBeNull(); // abort never creates/publishes a score
});
test("F10 P2-A: only local private records; switching own profiles cannot adopt another score",async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge-arcade-v1",JSON.stringify({version:1,records:[
   {profileId:"99-000001",arcadeId:"11111111-1111-4111-8111-111111111111",best:80,modeVersion:1},
   {profileId:"99-000002",arcadeId:"22222222-2222-4222-8222-222222222222",best:20,modeVersion:1}
  ]}));
 });
 await page.goto("/#spiele");
 await expect(page.locator("#arcade-best")).toHaveText("80");
 await page.locator("#arcade-profile").selectOption("99-000002");
 await expect(page.locator("#arcade-best")).toHaveText("20");
 await page.reload();
 await expect(page.locator("#arcade-best")).toHaveText("80");
 await expect(page.locator("#arcade-no-profile")).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"))).toContain("99-000001");
});
