import {test,expect} from "@playwright/test";
const DBV="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const SOURCE="https://dbv.turnier.de/tournament/"+DBV;
const INV_ID="a10b0c0d-2e3f-4a5b-8c6d-7e8f9a0b1c2d";
const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
test("Private invitation is explicit, one event only, anonymous reader, revocable",async ({browser})=>{
 const creator=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 const guest=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 const owner=await creator.newPage(),reader=await guest.newPage();
 let auth=0,writes=0,reads=0,revokes=0,token="",revoked=false;
 const state={players:[{id:"05-000111",name:"Testspieler"}],friends:[],
  activeProfileId:"05-000111",chosen:"05-000111",historyProfilesInitialized:true,
  officialLinks:[{id:DBV,url:SOURCE,name:"Testturnier",playerId:"05-000111",
   startDate:"2026-12-03",endDate:"2026-12-04"}]};
 await creator.addInitScript(data=>{localStorage.setItem("shuttleboard-v1",JSON.stringify(data));localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({access_token:"test.member",refresh_token:"test.refresh",expires_at:Date.now()+3600000,user_id:"a1111111-2222-4333-8444-555555555555"}));},state);
 const api=async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname==="127.0.0.1")return route.continue();
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers});
  if(url.pathname==="/rest/v1/rpc/app_access_status")return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
   if(url.pathname==="/auth/v1/signup"){
   auth++;
   return route.fulfill({status:200,headers,body:JSON.stringify({
    user:{id:"a1111111-2222-4333-8444-555555555555"},access_token:"test.jwt",
    refresh_token:"test.refresh",expires_in:3600
   })});
  }
  if(url.pathname==="/rest/v1/rpc/private_tournament_invite_create"){
   writes++;const data=JSON.parse(req.postData()||"{}");
   expect(Object.keys(data).sort()).toEqual(["p_end_date","p_source_url","p_start_date","p_title","p_token"].sort());
   expect(JSON.stringify(data)).not.toContain("05-000111");
   token=data.p_token;
   expect(token).toMatch(/^[0-9a-f]{64}$/);
   return route.fulfill({status:200,headers,body:JSON.stringify([{
    invitation_id:INV_ID,expires_at:"2026-12-10T00:00:00+00:00"
   }])});
  }
  if(url.pathname==="/rest/v1/rpc/private_tournament_invite_revoke"){
   revokes++;expect(JSON.parse(req.postData()||"{}").p_invitation_id).toBe(INV_ID);
   revoked=true;
   return route.fulfill({status:200,headers,body:"true"});
  }
  if(url.pathname==="/rest/v1/rpc/private_tournament_invite_read"){
   reads++;expect(JSON.parse(req.postData()||"{}").p_token).toBe(token);
   return route.fulfill({status:200,headers,body:JSON.stringify(revoked?[]:[{
    title:"Testturnier",start_date:"2026-12-03",end_date:"2026-12-04",
    source_url:SOURCE,expires_at:"2026-12-10T00:00:00+00:00"
   }])});
  }
  return route.fulfill({status:200,headers,body:"[]"});
 };
 await owner.route("**/*",api);await reader.route("**/*",api);
 try{
  await owner.goto("/#turniere");
  expect(auth).toBe(0);
  await owner.locator('[data-private-invite-id="'+DBV+'"]').click();
  await expect(owner.locator("#private-invite-dialog")).toBeVisible();
  expect(auth).toBe(0);
  await owner.locator("#private-invite-create").click();
  await expect(owner.locator("#private-invite-url")).toHaveValue(/private-invite\.html#invite=[0-9a-f]{64}$/);
  expect(auth).toBe(0);expect(writes).toBe(1);
  const link=await owner.locator("#private-invite-url").inputValue();
  await reader.goto(link);
  await expect(reader.locator("#invite-data")).toBeVisible();
  await expect(reader.locator("#invite-title")).toHaveText("Testturnier");
  await expect(reader.locator("#invite-status")).toContainText("Einladung geprüft");
  expect(new URL(reader.url()).hash).toBe("");
  expect(auth).toBe(0);expect(reads).toBe(1);
  expect(await reader.locator("body").innerText()).not.toContain("Testspieler");
  await owner.locator("#private-invite-revoke").click();
  await expect(owner.locator("#private-invite-status")).toContainText("widerrufen");
  expect(revokes).toBe(1);
  await reader.goto(link);
  await expect(reader.locator("#invite-status")).toContainText("ungültig, abgelaufen oder wurde widerrufen");
  await expect(reader.locator("#invite-data")).toBeHidden();
  expect(reads).toBe(2);
 }finally{await creator.close();await guest.close();}
});
