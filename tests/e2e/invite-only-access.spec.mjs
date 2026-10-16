import {test,expect} from "./supabase-isolated.fixture.mjs";

// Security-relevant browser contract; real database grants must also be verified
// against Supabase before deployment. Never bypass the gate in production.
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const KEY="a".repeat(64);
const headers={"Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Content-Type":"application/json"};

test("without an accepted invitation the app shell stays hidden",async({page})=>{
 await page.route(API+"/**",async route=>route.fulfill({status:401,headers,body:'{"message":"not authorized"}'}));
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
 await expect(page.locator("#app-access-status")).toContainText("nur mit Einladung");
});

test("a valid invitation creates a device session and unlocks the shell",async({page})=>{
 const calls=[];
 await page.route(API+"/**",async route=>{
  const req=route.request(),u=new URL(req.url());
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(u.pathname.endsWith("/auth/v1/signup"))
   return route.fulfill({status:200,headers,body:JSON.stringify({
    access_token:"browser-test-jwt",refresh_token:"browser-test-refresh",expires_in:3600,
    user:{id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"}
   })});
  if(u.pathname.endsWith("/rpc/app_access_invite_accept")){
   const body=JSON.parse(req.postData()||"{}");calls.push(body.p_secret);
   return route.fulfill({status:200,headers,body:"true"});
  }
  if(u.pathname.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  return route.fulfill({status:200,headers,body:"[]"});
 });
 await page.goto("/#appinvite="+KEY,{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("body > .app")).toBeVisible();
 expect(calls).toEqual([KEY]);
 await expect(page).toHaveURL(/#start$/);
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communitySession.v1")||"null"));
 expect(session?.user_id).toBeTruthy();
 await page.reload();
 await expect(page.locator("#app-access-gate")).toBeHidden();
});

test("revoked access does not open the app despite a stored session",async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"revoked-jwt",refresh_token:"revoked-refresh",
   expires_at:Date.now()+3600000,user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
  }));
 });
 await page.route(API+"/**",async route=>{
  if(route.request().url().endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":false,"owner":false}'});
  return route.fulfill({status:200,headers,body:"[]"});
 });
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
});

test("on iPhone PWA a full forwarded invitation link can be pasted after installation",async({page})=>{
 const redeemed=[];
 await page.route(API+"/**",async route=>{
  const req=route.request(),u=new URL(req.url());
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(u.pathname.endsWith("/auth/v1/signup"))
   return route.fulfill({status:200,headers,body:JSON.stringify({
    access_token:"fresh-pwa-jwt",refresh_token:"fresh-pwa-refresh",expires_in:3600,
    user:{id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"}
   })});
  if(u.pathname.endsWith("/rpc/app_access_invite_accept")){
   redeemed.push(JSON.parse(req.postData()||"{}").p_secret);
   return route.fulfill({status:200,headers,body:"true"});
  }
  if(u.pathname.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":'+(redeemed.length?"true":"false")+',"owner":false}'});
  return route.fulfill({status:200,headers,body:"[]"});
 });
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await page.locator("#app-access-code").fill("https://metzgerhannes-oss.github.io/Badminton/index.html#appinvite="+KEY);
 await page.locator("#app-access-submit").click();
 await expect(page.locator("#app-access-gate")).toBeHidden();
 expect(redeemed).toEqual([KEY]);
});
