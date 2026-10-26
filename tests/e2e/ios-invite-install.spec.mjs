import {mkdir} from "node:fs/promises";
import {test,expect} from "./supabase-isolated.fixture.mjs";

const API="https://yadexibmjmnjfmfabrug.supabase.co";
const SECRET="b".repeat(64);
const headers={"Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json"};
function simulateIOS(page,{standalone=false}={}){
 return page.addInitScript(value=>{
  Object.defineProperty(navigator,"userAgent",{configurable:true,
   get:()=>"Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1"});
  Object.defineProperty(navigator,"standalone",{configurable:true,get:()=>value.standalone});
 },{standalone});
}
async function inviteApi(page){
 const calls=[];
 await page.route(API+"/**",route=>{
  const req=route.request(),url=new URL(req.url()),body=req.postData()||"";
  calls.push({path:url.pathname,body});
  if(req.method()==="OPTIONS")return route.fulfill({status:204,headers,body:""});
  if(url.pathname.endsWith("/auth/v1/signup"))
   return route.fulfill({status:200,headers,body:JSON.stringify({
    access_token:"synthetic-install-jwt",refresh_token:"synthetic-install-refresh",
    expires_in:3600,user:{id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"}
   })});
  if(url.pathname.endsWith("/rpc/app_access_invite_accept"))
   return route.fulfill({status:200,headers,body:"true"});
  if(url.pathname.endsWith("/rpc/app_access_status"))
   return route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
  return route.fulfill({status:401,headers,body:'{"message":"blocked"}'});
 });
 return calls;
}
test("iPhone Safari invitation opens install-first page without creating a session",async({page})=>{
 await simulateIOS(page);
 const calls=await inviteApi(page);
 await page.goto("/index.html#appinvite="+SECRET,{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(new RegExp("/install-invite\\.html#appinvite="+SECRET+"$"));
 await expect(page.getByRole("heading",{name:/Einmal einladen/})).toBeVisible();
 await expect(page.locator("#install-copy")).toBeVisible();
 await expect(page.locator('main > img')).toHaveAttribute("src","./assets/spvgg-schmetterlinge-splash.svg");
 // Existing app scripts may make unrelated, fully intercepted public read calls
 // before the navigation redirect commits in WebKit. They must never signup,
 // redeem the invitation or query the access grant in the Safari context.
 const accessCalls=calls.filter(({path})=>path.endsWith("/auth/v1/signup")||path.endsWith("/rpc/app_access_invite_accept")||path.endsWith("/rpc/app_access_status"));
 expect(accessCalls,"Safari must not consume an invitation or grant a session").toEqual([]);
 const content=await page.content();
 expect(content).not.toMatch(/rel="manifest"/);
 const browserLink=new URL(await page.locator("#browser-only").getAttribute("href"),page.url());
 expect(browserLink.search).toBe("");
 expect(browserLink.hash).toMatch(/^#appinvite=[a-f0-9]{64}&browser=1$/);
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow,"iOS install-first screen must not overflow at "+width).toBeLessThanOrEqual(2);
  const cta=await page.locator("#install-copy").boundingBox();
  expect(cta,"Save-invite action should be available without scrolling at "+width).toBeTruthy();
  expect(cta.y+cta.height,"Save-invite action must precede long install instructions").toBeLessThanOrEqual(844);
 }
 await mkdir("test-results",{recursive:true});
 await page.screenshot({
  path:"test-results/ios-install-first-"+test.info().project.name+".png",
  animations:"disabled"
 });
});
test("iPhone installed app redeems captured invitation automatically only once",async({page})=>{
 test.setTimeout(60000);
 await simulateIOS(page,{standalone:true});
 const calls=await inviteApi(page);
 // In loaded WebKit CI the access module may load after the first navigation.
 // Verify the mocked server membership response before expecting the visual grant.
 const membershipResponse=page.waitForResponse(response=>
  response.url().endsWith("/rpc/app_access_status")&&
  response.request().method()==="POST"&&response.status()===200,
  {timeout:30000});
 await page.goto("/install-invite.html#appinvite="+SECRET,{waitUntil:"domcontentloaded"});
 expect((await (await membershipResponse).json()).allowed).toBe(true);
 await expect(page.locator("#app-access-gate")).toBeHidden({timeout:20000});
 await expect(page).toHaveURL(/\/index\.html#start$/,{timeout:20000});
 const accepted=calls.filter(x=>x.path.endsWith("/rpc/app_access_invite_accept"));
 expect(accepted).toHaveLength(1);
 expect(JSON.parse(accepted[0].body)).toEqual({p_secret:SECRET});
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge.communitySession.v1")||"null"));
 expect(stored?.access_token).toBe("synthetic-install-jwt");
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden({timeout:20000});
 expect(calls.filter(x=>x.path.endsWith("/rpc/app_access_invite_accept"))).toHaveLength(1);
});
test("iPhone browser-only choice accepts the invite without infinite installation redirect",async({page})=>{
 test.setTimeout(60000);
 await simulateIOS(page);
 const calls=await inviteApi(page);
 await page.goto("/index.html#appinvite="+SECRET,{waitUntil:"domcontentloaded"});
 await expect(page.locator("#browser-only")).toBeVisible();
 // Synchronize with the synthetic membership response: under CI contention
 // WebKit can defer loading the access module after the browser-only click.
 // The gate must still close after the server has verified membership.
 const membershipResponse=page.waitForResponse(response=>
  response.url().endsWith("/rpc/app_access_status")&&
  response.request().method()==="POST"&&response.status()===200,
  {timeout:30000});
 await page.locator("#browser-only").click();
 expect((await (await membershipResponse).json()).allowed).toBe(true);
 await expect(page.locator("#app-access-gate")).toBeHidden({timeout:20000});
 await expect(page).toHaveURL(/\/index\.html#start$/,{timeout:20000});
 const acceptance=calls.findIndex(x=>x.path.endsWith("/rpc/app_access_invite_accept"));
 const statusCheck=calls.findIndex(x=>x.path.endsWith("/rpc/app_access_status"));
 expect(acceptance,"A browser-only invitation must be verified once before the access grant").toBeGreaterThanOrEqual(0);
 expect(statusCheck,"The server must independently confirm accepted membership").toBeGreaterThan(acceptance);
 expect(calls.filter(x=>x.path.endsWith("/rpc/app_access_invite_accept"))).toHaveLength(1);
});
test("existing installed PWA can use a single tap to accept clipboard invite",async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(value=>{
  Object.defineProperty(navigator,"clipboard",{configurable:true,
   value:{readText:async()=>value.link}});
 },{link:"https://metzgerhannes-oss.github.io/Badminton/index.html#appinvite="+SECRET});
 const calls=await inviteApi(page);
 await page.goto("/index.html#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeVisible();
 await expect(page.locator("#app-access-paste")).toBeVisible();
 const membershipResponse=page.waitForResponse(response=>
  response.url().endsWith("/rpc/app_access_status")&&
  response.request().method()==="POST"&&response.status()===200,
  {timeout:30000});
 await page.locator("#app-access-paste").click();
 expect((await (await membershipResponse).json()).allowed).toBe(true);
 await expect(page.locator("#app-access-gate")).toBeHidden({timeout:20000});
 expect(calls.filter(x=>x.path.endsWith("/rpc/app_access_invite_accept"))).toHaveLength(1);
});
test("invalid install-bootstrap URL never unlocks an app or calls Supabase",async({page})=>{
 await simulateIOS(page);
 const calls=await inviteApi(page);
 await page.goto("/install-invite.html#appinvite=invalid",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#install-copy")).toBeDisabled();
 await expect(page.locator("#install-status")).toContainText("Kein gültiger Einladungslink");
 expect(calls).toEqual([]);
});

test("#304: invite instructions distinguish existing app and installation with exact button labels",async({page})=>{
 await simulateIOS(page);
 const calls=await inviteApi(page);
 await page.goto("/install-invite.html#appinvite="+SECRET,{waitUntil:"domcontentloaded"});
 await expect(page.locator("#install-copy")).toHaveText("Einladung sichern");
 await expect(page.locator("#existing-installation > h2")).toHaveText("App bereits installiert?");
 await expect(page.locator("#new-installation > h2")).toHaveText("App zum ersten Mal installieren?");
 const existing=page.locator("#existing-installation li");
 await expect(existing).toHaveCount(3);
 await expect(existing.nth(0)).toContainText("Einladung sichern");
 await expect(existing.nth(2)).toContainText("Einladung aus Zwischenablage übernehmen");
 const fresh=page.locator("#new-installation li");
 await expect(fresh).toHaveCount(7);
 await expect(fresh.nth(2)).toContainText("Teilen");
 await expect(fresh.nth(3)).toContainText("Zum Home-Bildschirm hinzufügen");
 await expect(fresh.nth(6)).toContainText("Schmetterlinge");
 await expect(page.locator("#existing-installation")).not.toContainText("Tippe unten");
 await expect(page.locator("#new-installation")).not.toContainText("Code eingeben");
 // Merely reading instructions never redeems access or makes a Supabase request.
 expect(calls).toEqual([]);
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  const btn=await page.locator("#install-copy").boundingBox();
  expect(btn?.width).toBeGreaterThanOrEqual(44);
 }
});
