import {test,expect} from "./invited-member.fixture.mjs";

// Regression: the UI must explain missing owner privileges instead of silently
// omitting every "create invitation" action. All Supabase traffic is synthetic.
test("permissions page explains hidden invitations and recovers after owner check",async({page})=>{
 // An accepted family member with an existing local profile can navigate to
 // Settings. A brand-new install would correctly show first-run onboarding.
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-100001",name:"Synthetisches Profil",birthYear:2016,club:"Testverein"}],
   friends:[],activeProfileId:"99-100001",chosen:"99-100001",
   officialLinks:[],historyProfilesInitialized:true
  }));
 });
 let isOwner=false;
 await page.route("**/*.supabase.co/rest/v1/rpc/app_access_status",route=>
  route.fulfill({status:route.request().method()==="OPTIONS"?204:200,
   contentType:"application/json",
   headers:{"Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
    "Access-Control-Allow-Methods":"POST,OPTIONS"},
   body:route.request().method()==="OPTIONS"?"":JSON.stringify({allowed:true,owner:isOwner})}));
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#einstellungen/einladungen",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-einladungen")).toBeVisible();
 await expect(page.locator("#invite-access-help")).toBeVisible();
 await expect(page.locator("#invite-access-message")).toContainText("keine Betreiberrechte");
 await expect(page.locator(".invitation-card")).toBeHidden();
 isOwner=true;
 await page.locator("#invite-access-recheck").click();
 await expect(page.locator(".invitation-card")).toBeVisible();
 await expect(page.locator("#invite-share")).toBeVisible();
 await expect(page.locator("#invite-access-help")).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});
