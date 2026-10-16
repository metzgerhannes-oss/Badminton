import {test,expect} from "./supabase-isolated.fixture.mjs";

const DBV="05-070879";
const USER="2980046b-abd4-4056-b275-090a7364c4ac";
const EVENT="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const BOOKMARK={id:EVENT,playerId:DBV,name:"Beispielturnier",startDate:"2026-12-03",endDate:"2026-12-04"};
test.beforeEach(async ({page})=>{
 await page.addInitScript(({dbv,user})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:dbv,name:"Testspieler"}],friends:[],officialLinks:[],
   activeProfileId:dbv,chosen:dbv,historyProfilesInitialized:true
  }));
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   user_id:user,access_token:"test-token-only",
   refresh_token:"test-refresh-only",expires_at:Date.now()+3_600_000
  }));
 },{dbv:DBV,user:USER});
});

test("guest trying public share never signs up and preserves local-only result",async ({page})=>{
 let signups=0,grantReads=0,publicWrites=0;
 await page.route("**/auth/v1/signup",route=>{signups++;return route.fulfill({status:429,body:"{}"});});
 await page.route("**/rest/v1/player_publication_grants?*",route=>{grantReads++;return route.fulfill({status:200,body:"[]"});});
 await page.route("**/rest/v1/user_tournament_links?*",route=>{publicWrites++;return route.fulfill({status:201,body:"{}"});});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.evaluate(()=>localStorage.removeItem("schmetterlinge.communitySession.v1"));
 await page.evaluate(bookmark=>window.dispatchEvent(
  new CustomEvent("badminton:share-tournament",{detail:{bookmark,publicShare:true}})
 ),BOOKMARK);
 await expect(page.locator("#community-sync-status")).toContainText("bereits geprüftem Verwalterzugang");
 expect(signups).toBe(0);
 expect(grantReads).toBe(0);
 expect(publicWrites).toBe(0);
 const state=await page.evaluate(()=>localStorage.getItem("schmetterlinge.communitySession.v1"));
 expect(state).toBeNull();
});

test("unverified session cannot send a public tournament hint",async ({page})=>{
 let inserts=0,grantChecks=0;
 await page.route("**/rest/v1/player_publication_grants?*",route=>{
  grantChecks++;
  return route.fulfill({status:200,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},body:"[]"});
 });
 await page.route("**/rest/v1/user_tournament_links?*",route=>{
  inserts++;
  return route.fulfill({status:201,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},body:"{}"});
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Boolean(window.badmintonCommunity));
 await page.evaluate(bookmark=>window.dispatchEvent(
  new CustomEvent("badminton:share-tournament",{detail:{bookmark,publicShare:true}})
 ),BOOKMARK);
 await expect(page.locator("#community-sync-status")).toContainText("keine geprüfte Veröffentlichungsberechtigung");
 await expect(page.locator("#community-sync-status")).toContainText("Das Turnier bleibt privat auf deinem Gerät");
 await expect(page.locator("#community-sync-status")).not.toContainText(USER);
 expect(grantChecks).toBe(1);
 expect(inserts).toBe(0);
 const flags=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communityShares.v1")||"{}"));
 expect(flags[DBV+"|"+EVENT]).toBeFalsy();
});

test("approved session can share only after a matching player grant",async ({page})=>{
 let inserts=0,checked=false;
 await page.route("**/rest/v1/player_publication_grants?*",route=>{
  const u=new URL(route.request().url());
  checked=u.searchParams.get("user_id")==="eq."+USER&&
   u.searchParams.get("player_dbv_id")==="eq."+DBV;
  return route.fulfill({status:200,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},
    body:JSON.stringify([{player_dbv_id:DBV}])});
 });
 await page.route("**/rest/v1/user_tournament_links?*",route=>{
  inserts++;
  return route.fulfill({status:201,contentType:"application/json",
    headers:{"Access-Control-Allow-Origin":"*"},body:"{}"});
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>Boolean(window.badmintonCommunity));
 await page.evaluate(bookmark=>window.dispatchEvent(
  new CustomEvent("badminton:share-tournament",{detail:{bookmark,publicShare:true}})
 ),BOOKMARK);
 await expect(page.locator("#community-sync-status")).toContainText("Deine Follower können es sehen");
 expect(checked).toBe(true);
 expect(inserts).toBe(1);
 const flags=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communityShares.v1")||"{}"));
 expect(flags[DBV+"|"+EVENT]).toBe(true);
});
