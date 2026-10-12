import {test,expect} from "@playwright/test";
const PLAYER="05-070879",EVENT="A1B2C3D4-1111-4111-8111-111111111111";
const SOURCE_URL="https://dbv.turnier.de/tournament/"+EVENT;
const USER="4f7463b4-57d1-4b86-a973-9208d27ab38d";
const ID="77d419c9-2e3c-4b9c-89ef-24fd1dab2ca8";
const headers={"Access-Control-Allow-Origin":"*","Content-Type":"application/json"};
test("Private event invitation is opt-in, guest-readable, limited, and revocable",async({browser})=>{
 const a=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 const b=await browser.newContext({baseURL:"http://127.0.0.1:4173",serviceWorkers:"block"});
 const owner=await a.newPage(),guest=await b.newPage();
 const local={players:[{id:PLAYER,name:"Testprofil"}],friends:[],activeProfileId:PLAYER,chosen:PLAYER,
  officialLinks:[{id:EVENT,playerId:PLAYER,url:SOURCE_URL,name:"Jugend-RLT",startDate:"2026-12-03",endDate:"2026-12-04"}],
  historyProfilesInitialized:true};
 await a.addInitScript(data=>localStorage.setItem("shuttleboard-v1",JSON.stringify(data)),local);
 let signup=0,creation=0,revoke=0,publicWrites=0,guestCalls=0,revoked=false;
 const handler=async route=>{
  const req=route.request(),u=new globalThis.URL(req.url());
  if(u.hostname==="127.0.0.1"||u.hostname==="localhost")return route.continue();
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers});
  if(u.pathname==="/auth/v1/signup"){signup++;
   return route.fulfill({status:200,headers,body:JSON.stringify({access_token:"test.access.token",
    refresh_token:"test.refresh.token",expires_in:3600,user:{id:USER}})});}
  if(u.pathname==="/rest/v1/rpc/private_tournament_invite_create"){creation++;
   const data=JSON.parse(req.postData()||"{}");
   expect(Object.keys(data).sort()).toEqual(["p_token","p_title","p_start_date","p_end_date","p_source_url"].sort());
   expect(data.p_token).toMatch(/^[a-f0-9]{64}$/);
   expect(data.p_title).toBe("Jugend-RLT");expect(data.p_source_url).toBe(SOURCE_URL);
   expect(JSON.stringify(data)).not.toContain(PLAYER);
   return route.fulfill({status:200,headers,body:JSON.stringify([{
    invitation_id:ID,expires_at:"2026-12-10T12:00:00Z"}])});
  }
  if(u.pathname==="/rest/v1/rpc/private_tournament_invite_read"){guestCalls++;
   const data=JSON.parse(req.postData()||"{}");
   expect(data.p_token).toMatch(/^[a-f0-9]{64}$/);
   return route.fulfill({status:200,headers,body:revoked?"[]":JSON.stringify([{
    title:"Jugend-RLT",start_date:"2026-12-03",end_date:"2026-12-04",
    source_url:SOURCE_URL,expires_at:"2026-12-10T12:00:00Z"}])});
  }
  if(u.pathname==="/rest/v1/rpc/private_tournament_invite_revoke"){revoke++;
   const data=JSON.parse(req.postData()||"{}");expect(data.p_invitation_id).toBe(ID);
   revoked=true;return route.fulfill({status:200,headers,body:"true"});}
  if(u.pathname==="/rest/v1/user_tournament_links"&&req.method()!=="GET")publicWrites++;
  return route.fulfill({status:200,headers,body:"[]"});
 };
 await owner.route("**/*",handler);await guest.route("**/*",handler);
 try{
  await owner.goto("/#turniere",{waitUntil:"domcontentloaded"});
  await owner.locator('[data-private-invite-id="'+EVENT+'"]').click();
  await expect(owner.locator("#private-share-dialog")).toBeVisible();
  expect(signup).toBe(0);expect(creation).toBe(0);
  await owner.locator("#private-share-create").click();
  await expect(owner.locator("#private-share-status")).toContainText("Privater Link erstellt");
  expect(signup).toBe(1);expect(creation).toBe(1);expect(publicWrites).toBe(0);
  const link=await owner.locator("#private-share-link").inputValue();
  expect(link).toContain("/private-invite.html#t=");
  const token=new globalThis.URL(link).hash.slice(3);expect(token).toMatch(/^[a-f0-9]{64}$/);
  await guest.goto(link);
  await expect(guest.locator("#invite-page-title")).toContainText("Jugend-RLT");
  await expect(guest.locator("#invite-page-source")).toHaveAttribute("href",SOURCE_URL);
  await expect(guest.locator("body")).not.toContainText("Testprofil");
  await expect(guest.locator("body")).not.toContainText(PLAYER);
  const guestSession=await guest.evaluate(()=>localStorage.getItem("schmetterlinge.communitySession.v1"));
  expect(guestSession).toBeNull();
  expect(new URL(guest.url()).hash).toBe("");
  await owner.locator("#private-share-revoke").click();
  await expect(owner.locator("#private-share-status")).toContainText("Link widerrufen");
  expect(revoke).toBe(1);
  await guest.goto(link);
  await expect(guest.locator("#invite-page-status")).toContainText("abgelaufen, widerrufen");
  expect(guestCalls).toBe(2);expect(signup).toBe(1);expect(publicWrites).toBe(0);
 }finally{await a.close();await b.close();}
});
