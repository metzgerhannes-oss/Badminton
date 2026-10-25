import {test,expect} from "./invited-member.fixture.mjs";

// F10 paused: navigation is hidden; legacy #spiele remains private and offline.
// Every fixture value is synthetic. No productive API, user profile, or score is accessed.
const profileId="99-000001";
const recordId="11111111-1111-4111-8111-111111111111";
const own=[{id:profileId,name:"Synthetic Player"}];
const records=best=>JSON.stringify({version:1,records:[{profileId,arcadeId:recordId,best,modeVersion:1}]});
const seeded={
 "shuttleboard-v1":JSON.stringify({
  players:own,friends:[],officialLinks:[],activeProfileId:profileId,
  chosen:profileId,historyProfilesInitialized:true
 }),
 "schmetterlinge-arcade-v1":records(80),
 "schmetterlinge-arcade-2048-v1":records(2048),
 "schmetterlinge-arcade-pong-v1":records(17)
};
const scoreKeys=Object.keys(seeded).filter(key=>key.startsWith("schmetterlinge-arcade-"));

test.beforeEach(async({page})=>{
 await page.addInitScript(values=>{
  for(const [key,value] of Object.entries(values))
   if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
 },seeded);
});

test("F10 pause: no arcade entry on Home or Turniere; direct route and all private records survive",async({page})=>{
 for(const width of [320,390]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start");
  await expect(page.locator("#view-start")).toBeVisible();
  await expect(page.locator('#view-start a[href="#spiele"]')).toHaveCount(0);
  await expect(page.locator(".arcade-entry")).toHaveCount(0);
  await page.goto("/#turniere");
  await expect(page.locator("#view-turniere")).toBeVisible();
  await expect(page.locator('#view-turniere a[href="#spiele"]')).toHaveCount(0);
  await expect(page.locator('a[href="#spiele"]')).toHaveCount(0);
 }
 await page.goto("/#spiele");
 await expect(page.locator("#view-spiele")).toBeVisible();
 await expect(page.locator("#arcade-best")).toHaveText("80");
 await page.locator("#arcade-game").selectOption("2048");
 await expect(page.locator("#arcade-2048-best")).toHaveText("2048");
 await page.locator("#arcade-game").selectOption("pong");
 await expect(page.locator("#arcade-pong-best")).toHaveText("17");
 await page.reload();
 await expect(page.locator("#view-spiele")).toBeVisible();
 await page.locator("#arcade-game").selectOption("snake");
 await expect(page.locator("#arcade-best")).toHaveText("80");
 const actual=await page.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),scoreKeys);
 expect(actual).toEqual(Object.fromEntries(scoreKeys.map(key=>[key,seeded[key]])));
 const family=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(family.players).toEqual(own);
});
