import {test,expect} from "./invited-member.fixture.mjs";

// The first-run profile picker is correctly modal. Use a synthetic existing
// player so this shell test measures navigation, not an unfinished onboarding.
// Same test-only fixture as the already-established step 8 browser suite.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))
   localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"05-070879",name:"UI Testprofil"}],friends:[],officialLinks:[],
    activeProfileId:"05-070879",chosen:"05-070879",
    historyProfilesInitialized:true
   }));
 });
});

/* Static fixture / mocked invited session and blocked production network. */
test("desktop PR 1: full-width header, large original logo and nonoverlapping rail",async({page})=>{
 for(const width of [1280,1440,1920]){
  await page.setViewportSize({width,height:900});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const metrics=await page.evaluate(()=>{
   const rect=s=>document.querySelector(s).getBoundingClientRect();
   const header=rect(".app>.topbar"),logo=rect(".app>.topbar .brand-logo");
   const nav=rect(".bottom-nav"),content=rect("#hauptinhalt");
   return {headerLeft:header.left,headerRight:header.right,
    logoHeight:logo.height,navRight:nav.right,navTop:nav.top,
    headerBottom:header.bottom,contentLeft:content.left,
    position:getComputedStyle(document.querySelector(".bottom-nav")).position,
    navCount:document.querySelectorAll("nav.bottom-nav").length,
    pageOverflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(metrics.position).toBe("fixed");
  expect(metrics.navCount).toBe(1);
  expect(metrics.headerLeft).toBeGreaterThanOrEqual(0);
  expect(metrics.headerLeft).toBeLessThanOrEqual(32);
  expect(metrics.headerRight).toBeGreaterThanOrEqual(width-32);
  expect(metrics.logoHeight).toBeGreaterThanOrEqual(87);
  expect(metrics.navRight).toBeLessThanOrEqual(metrics.contentLeft-8);
  expect(metrics.navTop).toBeGreaterThanOrEqual(metrics.headerBottom);
  expect(metrics.pageOverflow).toBeLessThanOrEqual(2);
 }
 await page.locator('.bottom-nav a[data-page="spieler"]').click();
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect(page.locator('.bottom-nav a[data-page="spieler"]')).toHaveAttribute("aria-current","page");
});

test("desktop PR 1: medium desktop, RTL and unchanged narrow-screen navigation",async({page})=>{
 for(const width of [1080,1024,768,390,320]){
  await page.setViewportSize({width,height:850});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const result=await page.evaluate(()=>{
   const nav=document.querySelector(".bottom-nav"),main=document.querySelector("#hauptinhalt");
   const navRect=nav.getBoundingClientRect(),mainRect=main.getBoundingClientRect();
   return {navPosition:getComputedStyle(nav).position,navRight:navRect.right,
    contentLeft:mainRect.left,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  expect(result.overflow).toBeLessThanOrEqual(2);
  if(width>=1080){
   expect(result.navRight).toBeLessThanOrEqual(result.contentLeft-4);
  }else{
   expect(result.navPosition).toBe("fixed");
   await expect(page.locator(".bottom-nav")).toBeVisible();
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const rtl=await page.evaluate(()=>{
  document.documentElement.dir="rtl";
  const nav=document.querySelector(".bottom-nav").getBoundingClientRect();
  const main=document.querySelector("#hauptinhalt").getBoundingClientRect();
  return {navLeft:nav.left,mainRight:main.right,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 expect(rtl.navLeft).toBeGreaterThanOrEqual(rtl.mainRight+4);
 expect(rtl.overflow).toBeLessThanOrEqual(2);
});
