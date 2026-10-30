import {test,expect} from "./invited-member.fixture.mjs";
// Two code activation is performed only on the origin where the PWA lives.
// All backend responses are synthetic; never contact productive Supabase.
const invite="a".repeat(64),handover="b".repeat(64);
test("P0 installed member upgrades to owner through one-time transfer",async({page})=>{
 const requested=[];
 await page.route("**/*.supabase.co/rest/v1/rpc/app_access_invite_accept",route=>{
  requested.push({rpc:"accept",body:route.request().postDataJSON()});
  return route.fulfill({status:200,contentType:"application/json",body:"true"});
 });
 await page.route("**/*.supabase.co/rest/v1/rpc/app_owner_device_transfer_claim",route=>{
  requested.push({rpc:"claim",body:route.request().postDataJSON()});
  return route.fulfill({status:200,contentType:"application/json",body:"true"});
 });
 await page.route("**/*.supabase.co/rest/v1/rpc/app_access_status",route=>
  route.fulfill({status:200,contentType:"application/json",
   body:JSON.stringify({allowed:true,owner:requested.some(x=>x.rpc==="claim")})}));
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-100001",name:"Demo",club:"Test"}],friends:[],
   activeProfileId:"99-100001",chosen:"99-100001",historyProfilesInitialized:true,officialLinks:[]
  }));
 });
 await page.goto("/#einstellungen/einladungen",{waitUntil:"domcontentloaded"});
 const section=page.locator("#owner-activation-setup");
 await expect(section).toBeAttached();
 await section.locator("summary").first().click();
 await section.locator('a[href="./owner-device-transfer.html"]').click();
 await expect(page).toHaveURL(/\/owner-device-transfer\.html$/);
 await page.locator("#invitation").fill(invite);
 await page.locator("#handover").fill(handover);
 await page.locator("#transfer-submit").click();
 await expect.poll(()=>requested.map(x=>x.rpc)).toEqual(["accept","claim"]);
 expect(requested[0].body).toEqual({p_secret:invite});
 expect(requested[1].body).toEqual({p_invitation_secret:invite,p_transfer_secret:handover});
 await expect(page).toHaveURL(/\/index\.html#einstellungen$/);
 expect(page.url()).not.toContain(invite);
 expect(page.url()).not.toContain(handover);
});
test("P0 invalid one-time codes are rejected before Supabase calls",async({page})=>{
 let called=false;
 await page.route("**/*.supabase.co/rest/v1/rpc/app_owner_device_transfer_claim",route=>{
  called=true;return route.fulfill({status:200,body:"true"});
 });
 await page.goto("/owner-device-transfer.html");
 await page.locator("#invitation").fill("abc");
 await page.locator("#handover").fill("def");
 await page.locator("#transfer-submit").click();
 await expect(page.locator("#status")).toContainText("vollständigen Codes");
 expect(called).toBe(false);
 expect(page.url()).not.toContain("abc");
});
