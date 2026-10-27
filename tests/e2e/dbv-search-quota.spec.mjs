import {test,expect} from "./invited-member.fixture.mjs";
import {test as guestTest} from "./supabase-isolated.fixture.mjs";

// F03 #327: synthetic 429 from the member-only DBV identity RPC. All Supabase
// traffic stays behind the hard offline browser firewall.
const HEADERS={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Expose-Headers":"Retry-After",
 "Content-Type":"application/json",
 "Retry-After":"30"
};
test("429 search keeps local setup intact and never fetches the public player backup",async({page})=>{
 let rpcCalls=0,backupRequests=0;
 page.on("request",request=>{
  if(new URL(request.url()).pathname.includes("/data/player-library/"))backupRequests++;
 });
 await page.route("**/rest/v1/rpc/search_dbv_player_identity",route=>{
  if(route.request().method()==="OPTIONS")
   return route.fulfill({status:204,headers:HEADERS,body:""});
  rpcCalls++;
  return route.fulfill({status:429,headers:HEADERS,body:'{"message":"synthetic quota"}'});
 });
 await page.goto("/welcome.html?from=app",{waitUntil:"domcontentloaded"});
 const search=page.locator("#welcome-player-search");
 await expect(search).toBeVisible();
 await search.fill("Mira");
 await expect(page.locator("#welcome-search-status")).toContainText("zu vieler Anfragen");
 await expect(page.locator(".welcome-search-hit")).toHaveCount(0);
 expect(rpcCalls).toBe(1);
 expect(backupRequests).toBe(0,"429 must not be bypassed through static player files");
 await search.fill("Mira Muster");
 await expect(page.locator("#welcome-search-status")).toContainText("zu vieler Anfragen");
 expect(rpcCalls).toBe(1,"Client cooldown blocks repeated RPC attempts");
 expect(backupRequests).toBe(0);
 expect(await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"))).toBeNull();
});

guestTest("anonymous Auth without family membership cannot query DBV identities",async({page})=>{
 let identityRequests=0;
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"synthetic-anonymous-auth-not-a-member",
   refresh_token:"synthetic-refresh",
   expires_at:Date.now()+3600000,
   user_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  }));
 });
 await page.route("**/rest/v1/rpc/app_access_status",route=>
  route.fulfill({status:200,headers:HEADERS,body:'{"allowed":false,"owner":false}'}));
 await page.route("**/rest/v1/rpc/search_dbv_player_identity",route=>{
  identityRequests++;
  return route.fulfill({status:403,headers:HEADERS,body:'{"message":"forbidden"}'});
 });
 await page.goto("/welcome.html?from=app",{waitUntil:"domcontentloaded"});
 await page.locator("#welcome-player-search").fill("Mira");
 await expect(page.locator("#welcome-search-status")).toContainText("gesperrt");
 expect(identityRequests).toBe(0,"Anonymous Auth must not query the SECURITY DEFINER identity RPC");
 expect(await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"))).toBeNull();
});
