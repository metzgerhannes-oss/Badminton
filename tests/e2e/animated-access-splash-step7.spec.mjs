import {test,expect} from "./supabase-isolated.fixture.mjs";

/* U7 / #286: only synthetic sessions and intercepted Supabase responses.
   No requests are ever permitted to reach the productive backend. */
const API="https://yadexibmjmnjfmfabrug.supabase.co";
const headers={
 "Access-Control-Allow-Origin":"*",
 "Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer",
 "Content-Type":"application/json"
};
async function withExistingSession(page){
 await page.addInitScript(()=>{
  localStorage.setItem("schmetterlinge.communitySession.v1",JSON.stringify({
   access_token:"synthetic-access-token",refresh_token:"synthetic-refresh-token",
   expires_at:Date.now()+3600000,user_id:"24c76504-b86c-4c73-a01a-b6210b78e3a3"
  }));
 });
}
test("checking uses original club logo and animated shuttle without visible text or invitation controls",async({page})=>{
 await withExistingSession(page);
 let allowResponse;
 await page.route(API+"/rest/v1/rpc/app_access_status",async route=>{
  await new Promise(resolve=>{allowResponse=resolve;});
  await route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
 });
 await page.setViewportSize({width:320,height:640});
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-splash")).toBeVisible();
 await expect(page.locator(".app-access-panel")).toBeHidden();
 await expect(page.locator("body > .app")).toBeHidden();
 await expect(page.locator("#app-access-splash img")).toHaveAttribute("src","./assets/spvgg-schmetterlinge.svg");
 await expect(page.locator("#app-access-splash .app-access-visually-hidden")).toContainText("Zugang wird geprüft");
 await expect(page.locator(".app-access-shuttle")).toHaveCSS("animation-name","app-access-shuttle-flight");
 expect(await page.locator("#app-access-splash").evaluate(el=>el.innerText.trim())).toBe("Zugang wird geprüft.");
 await expect.poll(()=>Boolean(allowResponse)).toBe(true);
 allowResponse();
 await expect(page.locator("#app-access-gate")).toBeHidden();
 await expect(page.locator("body > .app")).toBeVisible();
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 const stored=await page.evaluate(()=>localStorage.getItem("schmetterlinge.communitySession.v1"));
 expect(stored).toContain("synthetic-access-token");
});
test("a failed status check shows the actionable error and does not trap the user in animation",async({page})=>{
 await withExistingSession(page);
 await page.route(API+"/rest/v1/rpc/app_access_status",route=>
  route.fulfill({status:503,headers,body:'{"message":"offline"}'}));
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","denied");
 await expect(page.locator("#app-access-splash")).toBeHidden();
 await expect(page.locator(".app-access-panel")).toBeVisible();
 await expect(page.locator("#app-access-status")).toContainText("Zugangsdienst nicht erreichbar");
 await expect(page.locator("#app-access-code")).toBeVisible();
 await expect(page.locator("body > .app")).toBeHidden();
});
test("reduced motion keeps the shuttle static while a session is being checked",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await withExistingSession(page);
 let resolveCheck;
 await page.route(API+"/rest/v1/rpc/app_access_status",async route=>{
  await new Promise(resolve=>{resolveCheck=resolve;});
  await route.fulfill({status:200,headers,body:'{"allowed":true,"owner":false}'});
 });
 await page.setViewportSize({width:390,height:844});
 await page.goto("/",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-splash")).toBeVisible();
 await expect(page.locator(".app-access-shuttle")).toHaveCSS("animation-name","none");
 await expect.poll(()=>Boolean(resolveCheck)).toBe(true);
 resolveCheck();
 await expect(page.locator("#app-access-gate")).toBeHidden();
});
