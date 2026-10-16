import {test,expect} from "./supabase-isolated.fixture.mjs";

// v138: a player-only grant may open the UI, but must not become broad membership.
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const invite="11111111-2222-4333-8444-555555555555";
const player="99-000001";
const headers={"Access-Control-Allow-Origin":"*","Content-Type":"application/json"};

test.beforeEach(async({page})=>{
 await page.addInitScript(({invite,player})=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"narrow-jwt",refresh_token:"narrow-refresh",expires_at:Date.now()+3600000,
   user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  }));
  localStorage.setItem("schmetterlinge.acceptedPlayerInvite.v3",JSON.stringify([invite]));
  localStorage.setItem("schmetterlinge.acceptedPlayerInviteBindings.v1",JSON.stringify({[invite]:player}));
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[],friends:[{id:player,name:"Testspieler"}],activeProfileId:player,
   viewingFriendId:player,officialLinks:[]
  }));
 },{invite,player});
});

test("server-confirmed narrow player link opens the app without broad sports membership",async({page})=>{
 await page.route(API+"/**",async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":false,"owner":false}'});
  if(path.endsWith("/rpc/private_player_access_read"))
   return route.fulfill({status:200,headers,body:JSON.stringify({player:{dbv_id:player,name:"Testspieler"}})});
  return route.fulfill({status:403,headers,body:'{"message":"no global access"}'});
 });
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("body > .app")).toBeVisible();
 const rights=await page.evaluate(()=>({
  shell:window.badmintonAppAccess.shellAllowed,
  global:window.badmintonAppAccess.allowed,
  token:window.badmintonAppAccess.accessToken
 }));
 expect(rights).toEqual({shell:true,global:false,token:null});
});

test("revoked player link cannot open the app",async({page})=>{
 await page.route(API+"/**",async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":false,"owner":false}'});
  return route.fulfill({status:403,headers,body:'{"message":"revoked"}'});
 });
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
});
