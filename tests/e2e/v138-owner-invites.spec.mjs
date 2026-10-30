import {test,expect} from "./supabase-isolated.fixture.mjs";
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const id="11111111-2222-4333-8444-555555555555";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Content-Type":"application/json"};
function seedSession(){
 // Prevent an unrelated first-run dialog from covering the invitations controls.
 localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"99-000001",name:"Testspielerin"}],friends:[],
  activeProfileId:"99-000001",chosen:"99-000001",officialLinks:[]
 }));
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


test("remote revocation hides stale cached share and copy controls without issuing a new grant",async({page})=>{
 let remotelyRevoked=false,overviewReads=0,inviteIssues=0;
 const secret="f".repeat(64);
 await page.addInitScript(({secret,id})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-000001",name:"Synthetisches Testprofil"}],friends:[],
   activeProfileId:"99-000001",chosen:"99-000001",officialLinks:[]
  }));
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"synthetic-owner-jwt",refresh_token:"synthetic-refresh",
   expires_at:Date.now()+3600000,user_id:"aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  }));
  localStorage.setItem("schmetterlinge.appIssuedInvite.v136",JSON.stringify({
   id,secret,expires:"2026-12-01T00:00:00Z",revoked:false
  }));
 },{secret,id});
 await page.route(API+"/**",route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(path.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":true}'});
  if(path.endsWith("/rpc/app_access_invites_overview")){
   overviewReads++;
   return route.fulfill({status:200,headers,body:JSON.stringify([{
    id,created_at:"2026-10-14T11:00:00Z",redeem_until:"2026-11-13T11:00:00Z",
    revoked_at:remotelyRevoked?"2026-10-29T19:00:00Z":null,accepted_count:1
   }])});
  }
  if(path.endsWith("/rpc/app_access_invite_issue"))inviteIssues++;
  return route.fulfill({status:401,headers,body:'{"message":"Synthetic QA: denied"}'});
 });
 await page.goto("/#einstellungen/einladungen",{waitUntil:"domcontentloaded"});
 const room=page.locator("#settings-room-einladungen");
 await expect(room.locator(".invitation-overview")).toContainText("1 angenommene Zugänge");
 await expect(room.locator("#invite-copy")).toBeVisible();
 await expect(room.locator("#invite-link-preview")).toHaveAttribute("href",/#appinvite=/);
 remotelyRevoked=true;
 await room.getByRole("button",{name:"Liste aktualisieren"}).click();
 await expect(room.locator(".invitation-overview")).toContainText("Widerrufen");
 await expect(room.locator("#invite-copy")).toBeHidden();
 await expect(room.locator("#invite-revoke")).toBeHidden();
 await expect(room.locator("#invite-link-preview")).toHaveAttribute("href","./welcome.html#installation");
 await expect(room.locator("#invite-status")).toContainText("wurde widerrufen");
 const local=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.appIssuedInvite.v136")));
 expect(local.revoked).toBe(true);
 expect(local.id).toBe(id);
 expect(inviteIssues).toBe(0);
 expect(overviewReads).toBe(2,"Remote revoke should not cause a refresh loop");
});

test("cached owner link is rechecked at copy time; remote revoke cannot be shared",async({page})=>{
 let remoteRevoked=false,overviewReads=0,newGrants=0;
 const secret="e".repeat(64);
 await page.addInitScript(seedSession);
 await page.addInitScript(({id,secret})=>{
  localStorage.setItem("schmetterlinge.appIssuedInvite.v136",JSON.stringify({
   id,secret,expires:"2026-12-01T00:00:00Z",revoked:false
  }));
 },{id,secret});
 await page.route(API+"/**",route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(path.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":true}'});
  if(path.endsWith("/rpc/app_access_invites_overview")){
   overviewReads++;
   return route.fulfill({status:200,headers,body:JSON.stringify([{
    id,created_at:"2026-10-14T11:00:00Z",redeem_until:"2026-11-13T11:00:00Z",
    revoked_at:remoteRevoked?"2026-10-30T07:59:00Z":null,accepted_count:1
   }])});
  }
  if(path.endsWith("/rpc/app_access_invite_issue"))newGrants++;
  return route.fulfill({status:401,headers,body:'{"message":"Synthetic QA: denied"}'});
 });
 await page.goto("/#einstellungen/einladungen",{waitUntil:"domcontentloaded"});
 const room=page.locator("#settings-room-einladungen");
 await expect(room.locator(".invitation-overview")).toContainText("1 angenommene Zugänge");
 await expect(room.locator("#invite-copy")).toBeVisible();
 remoteRevoked=true; // Revoked on another device after initial overview.
 await room.locator("#invite-copy").click();
 await expect(room.locator("#invite-status")).toContainText("Einladung wurde widerrufen");
 await expect(room.locator("#invite-copy")).toBeHidden();
 await expect(room.locator("#invite-link-preview")).toHaveAttribute("href","./welcome.html#installation");
 const cached=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.appIssuedInvite.v136")));
 expect(cached.revoked).toBe(true);
 expect(overviewReads).toBeGreaterThanOrEqual(2);
 expect(newGrants).toBe(0,"Never create a replacement grant when sharing a remotely revoked link");
});
