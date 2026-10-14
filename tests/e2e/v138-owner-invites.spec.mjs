import {test,expect} from "@playwright/test";
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const id="11111111-2222-4333-8444-555555555555";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Content-Type":"application/json"};
function seedSession(){
 localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
  access_token:"owner-jwt",refresh_token:"owner-refresh",
  expires_at:Date.now()+3600000,user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
 }));
}
test("owner sees server-confirmed app invites in the invitations room and can revoke",async({page})=>{
 let revoked=false,requests=0,revocations=0;
 await page.addInitScript(seedSession);
 await page.route(API+"/**",async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(path.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":true}'});
  if(path.endsWith("/rpc/app_access_invites_overview")){
   requests++;
   const result=[{id,created_at:"2026-10-14T11:00:00Z",
    redeem_until:"2026-11-13T11:00:00Z",revoked_at:revoked?"2026-10-14T12:00:00Z":null,
    accepted_count:2}];
   return route.fulfill({status:200,headers,body:JSON.stringify(result)});
  }
  if(path.endsWith("/rpc/app_access_invite_revoke")){
   expect(JSON.parse(req.postData()||"{}")).toEqual({p_invitation_id:id});
   revoked=true;revocations++;
   return route.fulfill({status:200,headers,body:"true"});
  }
  return route.fulfill({status:200,headers,body:"[]"});
 });
 page.on("dialog",dialog=>dialog.accept());
 await page.goto("/#einstellungen/einladungen",{waitUntil:"domcontentloaded"});
 const room=page.locator("#settings-room-einladungen");
 await expect(room).toBeVisible();
 await expect(room.locator(".invitation-card")).toBeVisible();
 await expect(room.locator(".invitation-overview")).toContainText("2 angenommene Zugänge");
 await expect(room.locator(".invitation-overview")).not.toContainText("@");
 await room.getByRole("button",{name:"Link und Zugänge widerrufen"}).click();
 await expect(room.locator(".invitation-overview")).toContainText("Widerrufen");
 expect(revocations).toBe(1);
 expect(requests).toBeGreaterThanOrEqual(2);
 await page.goto("/#einstellungen/daten",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-daten .invitation-card")).toHaveCount(0);
});
test("uninvited session cannot see invitation overview",async({page})=>{
 await page.route(API+"/**",async route=>{
  const req=route.request();
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  return route.fulfill({status:401,headers,body:'{"message":"not authorized"}'});
 });
 await page.goto("/#einstellungen/einladungen",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("#settings-room-einladungen .invitation-card")).toBeHidden();
});
