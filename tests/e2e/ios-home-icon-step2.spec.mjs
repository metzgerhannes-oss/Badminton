import {test,expect} from "./invited-member.fixture.mjs";

// Step 2 only: iOS/PWA metadata and storage continuity, with isolated fake Supabase responses.
const originPath="/";
const assets=[
 ["schmetterlinge-apple-touch-icon-180.png",180],
 ["schmetterlinge-pwa-192.png",192],
 ["schmetterlinge-pwa-512.png",512]
];

test("existing homescreen scope, startup and player data survive the icon release",async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1")){
   localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"05-070879",name:"Schmetterlinge Testprofil"}],
    friends:[{id:"05-061350",name:"Freund Testprofil"}],
    officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
    historyProfilesInitialized:true
   }));
  }
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-start")).toBeVisible();
 const manifest=await (await page.request.get("/manifest.webmanifest")).json();
 expect(manifest.display).toBe("standalone");
 expect(manifest.scope).toBe("./");
 expect(manifest.start_url).toBe("./#start");
 expect(manifest.icons.filter(i=>i.type==="image/png").map(i=>i.sizes).sort())
  .toEqual(["192x192","512x512"]);
 for(const target of ["/#start","/welcome.html"]){
  await page.goto(target,{waitUntil:"domcontentloaded"});
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content","yes");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content","Schmetterlinge");
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content","default");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href","./assets/schmetterlinge-apple-touch-icon-180.png");
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(stored.activeProfileId).toBe("05-070879");
  expect(stored.friends[0].id).toBe("05-061350");
 }
});
test("all official-logo PNG icons are valid and exact dimensions",async({page})=>{
 await page.goto(originPath,{waitUntil:"domcontentloaded"});
 for(const [filename,pixels] of assets){
  const res=await page.request.get("/assets/"+filename);
  expect(res.ok(),filename).toBeTruthy();
  const png=await res.body();
  expect(png.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(pixels);
  expect(png.readUInt32BE(20)).toBe(pixels);
  expect(png.length).toBeLessThan(200000);
 }
});
test("iPhone accessibility zoom remains allowed with app branding",async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const viewport=await page.locator('meta[name="viewport"]').getAttribute("content");
 expect(viewport).toContain("viewport-fit=cover");
 expect(viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
 await expect(page.locator(".brand-logo")).toBeVisible();
 await expect(page.locator(".topbar-settings")).toBeVisible();
});
