import {test,expect} from "./invited-member.fixture.mjs";

/* Step 8: UI only, synthetic invited account. The inherited fixture blocks
   productive Supabase and all other external network traffic. */
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"UI Testprofil"}],friends:[],officialLinks:[],
   activeProfileId:"05-070879",chosen:"05-070879",historyProfilesInitialized:true
  }));
 });
});

test("320px and 390px: subtle tap feedback, instant view change, intact keyboard focus",async({page})=>{
 await page.emulateMedia({reducedMotion:"no-preference"});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:720});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const nav=page.locator('.bottom-nav a[data-page="spieler"]');
  const icon=nav.locator(":scope > span");
  await expect(icon).toHaveCSS("transition-property","transform");
  await expect(icon).toHaveCSS("transition-duration","0.14s");
  await expect(page.locator('.bottom-nav a[data-page="berichte"]')).toHaveCount(0);
  await nav.click();
  await expect(page.locator("#view-spieler")).toBeVisible();
  await expect(nav).toHaveAttribute("aria-current","page");
  await page.locator('#view-spieler a.context-reports-link[href="#berichte"]').click();
  await expect(page.locator("#view-berichte")).toBeVisible();
  const heading=page.locator("#view-berichte h2").first();
  await expect(heading).toBeFocused();
  const button=page.locator("#report-refresh");
  await expect(button).toHaveCSS("transition-property",/transform/);
  const computed=await page.evaluate(()=>({
   pageAnimation:getComputedStyle(document.querySelector(".page.active")).animationName,
   navTarget:document.querySelector('.bottom-nav a[data-page="spieler"]').getBoundingClientRect().height,
   zoom:document.querySelector('meta[name="viewport"]').content,
   overflow:getComputedStyle(document.body).overflowX
  }));
  expect(computed.pageAnimation).toBe("none");
  expect(computed.navTarget).toBeGreaterThanOrEqual(44);
  expect(computed.zoom).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
  expect(computed.overflow).toBe("hidden");
 }
});

test("reduced motion: new touch transitions and transforms are off",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-start")).toBeVisible();
 const nav=page.locator('.bottom-nav a[data-page="spieler"]');
 const icon=nav.locator(":scope > span");
 await expect(icon).toHaveCSS("transition-property","none");
 const settings=page.locator(".topbar-settings");
 await expect(settings).toHaveCSS("transition-property","none");
 await nav.click();
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect(nav).toHaveAttribute("aria-current","page");
 const navAnimation=await icon.evaluate(el=>getComputedStyle(el).animationName);
 expect(navAnimation).toBe("none");
});

test("nav changes do not affect local profile/friends storage or desktop Navy",async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.goto("/#verein",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-verein")).toBeVisible();
 await expect(page.locator(".club-overview-panel")).toHaveCSS("background-color","rgb(17, 44, 81)");
 const before=await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"));
 await page.locator('.bottom-nav a[data-page="spieler"]').click();
 await expect(page.locator("#view-spieler")).toBeVisible();
 await page.locator('#view-spieler a.context-reports-link[href="#berichte"]').click();
 await expect(page.locator("#view-berichte")).toBeVisible();
 const after=await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"));
 expect(after).toBe(before);
});


test("P1 iPhone: pressed navigation and action controls give feedback even with reduced motion",async({page})=>{
 await page.emulateMedia({reducedMotion:"reduce"});
 await page.setViewportSize({width:320,height:720});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const nav=page.locator('.bottom-nav a[data-page="spieler"]');
 const bounds=await nav.boundingBox();
 expect(bounds).not.toBeNull();
 await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
 await page.mouse.down();
 await expect(nav).toHaveCSS("outline-style","solid");
 await expect(nav).toHaveCSS("outline-width","2px");
 await page.mouse.up();
 await expect(page.locator("#view-spieler")).toBeVisible();
 const profileState=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(profileState.activeProfileId).toBe("05-070879");
 // The action is a real control on the reports screen; keyboard focus and
 // reduced-motion settings must not suppress static tactile feedback.
 await page.locator('#view-spieler a.context-reports-link[href="#berichte"]').click();
 const button=page.locator("#report-refresh");
 await expect(button).toBeVisible();
 const b=await button.boundingBox();
 expect(b).not.toBeNull();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
 await page.mouse.down();
 await expect(button).toHaveCSS("outline-style","solid");
 await expect(button).toHaveCSS("outline-width","2px");
 await page.mouse.up();
});
