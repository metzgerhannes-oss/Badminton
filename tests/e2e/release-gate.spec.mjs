import {test,expect} from "./invited-member.fixture.mjs";
const PLAYER="05-070879";
test.beforeEach(async ({page})=>{
 await page.addInitScript(id=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id,name:"Philipp Metzger",birthYear:2016,club:"SpVgg Mössingen"}],
   friends:[],officialLinks:[],activeProfileId:id,chosen:id,historyProfilesInitialized:true
  }));
 },PLAYER);
 await page.route("https://**/*.supabase.co/**",route=>route.fulfill({
  status:200,contentType:"application/json",body:new URL(route.request().url()).pathname.endsWith("/rpc/app_access_status")?'{"allowed":true,"owner":false}':"[]",
  headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}
 }));
});
test("Compact iPhone layout and dialog buttons remain operable",async ({page},info)=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#spieler");
 for(const tab of await page.locator(".bottom-nav a:visible").all()){
  const box=await tab.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
 }
 await page.goto("/#einstellungen/profile");
   await expect(page.locator("#settings-room-profile")).toBeVisible();
  await page.locator("#add-player").click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.locator("#player-dialog button[type=submit]").scrollIntoViewIfNeeded();
 await expect(page.locator("#player-dialog button[type=submit]")).toBeVisible();
 await page.screenshot({path:info.outputPath("compact-player-form.png")});
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#player-dialog")).not.toBeVisible();
});

test("v64 app chrome keeps four readable, non-overlapping tabs from SE to tablet",async ({page})=>{
 for(const width of [320,375,390,768]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  const tabs=page.locator(".bottom-nav a:visible");
  await expect(tabs).toHaveCount(5);
  await expect(page.locator(".topbar-settings")).toBeVisible();
  await expect(page.locator(".brand-logo")).toBeVisible();
  const frames=[];
  for(const tab of await tabs.all()){
   const rect=await tab.boundingBox();
   expect(rect,"navigation tab must be laid out").toBeTruthy();
   expect(rect.width).toBeGreaterThanOrEqual(44);
   expect(rect.height).toBeGreaterThanOrEqual(44);
   frames.push(rect);
  }
  for(let i=1;i<frames.length;i++){
   expect(frames[i].x).toBeGreaterThanOrEqual(frames[i-1].x+frames[i-1].width-1);
  }
  const style=await page.locator(".bottom-nav a:visible").first().evaluate(el=>getComputedStyle(el).width);
  expect(Number.parseFloat(style)).toBeGreaterThanOrEqual(44);
  const logo=await page.locator(".brand-logo").boundingBox();
  const settings=await page.locator(".topbar-settings").boundingBox();
  expect(logo.x+logo.width).toBeLessThan(settings.x+2);
 }
 await page.locator('.bottom-nav a[data-page="turniere"]').click();
 await expect(page.locator('#view-turniere')).toBeVisible();
 await page.locator(".brand").click();
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Philipp");
});

test("v65 extracted home cards and dialogs retain readable component styling",async ({page})=>{
 for(const width of [320,375,390,768]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".focused-profile")).toBeVisible();
  const profile=page.locator(".focused-profile");
  const shape=await profile.evaluate(el=>{
   const css=getComputedStyle(el);
   return {radius:css.borderTopLeftRadius,color:css.color,background:css.backgroundImage};
  });
  expect(shape.radius).toBe("16px");
  expect(shape.background).toContain("linear-gradient");
  await page.locator('.bottom-nav a[data-page="spieler"]').click();
  await page.goto("/#einstellungen/profile");
   await expect(page.locator("#settings-room-profile")).toBeVisible();
  await page.locator("#add-player").click();
  await expect(page.locator("#player-dialog")).toBeVisible();
  const dialogStyle=await page.locator("#player-dialog").evaluate(el=>{
   const css=getComputedStyle(el);
   return {color:css.color,background:css.backgroundImage};
  });
  expect(dialogStyle.background).toContain("linear-gradient");
  expect(dialogStyle.color).toBe("rgb(12, 48, 90)");
  const button=page.locator("#player-dialog button[type=submit]");
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await page.locator("#cancel-dialog").click();
  await expect(page.locator("#player-dialog")).not.toBeVisible();
 }
});

test("v68 legacy cleanup preserves active app views and dialog on narrow layouts",async ({page})=>{
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const base=await page.locator(".bottom-nav").evaluate(el=>{
   const css=getComputedStyle(el);
   return {position:css.position,display:css.display};
  });
  expect(base.position).toBe("fixed");
  expect(base.display).toBe("flex");
  const brand=await page.locator(".brand-logo").evaluate(el=>({
   clip:getComputedStyle(el).clipPath,mask:getComputedStyle(el).maskImage
  }));
  expect(brand.clip).toBe("none");
  expect(brand.mask).toBe("none");
  for(const view of ["turniere","spieler","berichte"]){
   await page.locator('.bottom-nav a[data-page="'+view+'"]').click();
   await expect(page.locator("#view-"+view)).toBeVisible();
  }
  await page.locator('.bottom-nav a[data-page="spieler"]').click();
  await page.goto("/#einstellungen/profile");
   await expect(page.locator("#settings-room-profile")).toBeVisible();
  await page.locator("#add-player").click();
  await expect(page.locator("#player-dialog")).toBeVisible();
  await page.locator("#cancel-dialog").click();
  await expect(page.locator("#player-dialog")).not.toBeVisible();
  await page.locator(".brand").click();
  await expect(page.locator("#view-start")).toBeVisible();
  await expect(page.locator(".focused-profile")).toContainText("Philipp");
 }
});

test("v70 CSS consolidation preserves app chrome, profile and dialog on phones and tablets",async ({page})=>{
 for(const width of [320,375,390,768]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  const tabs=page.locator(".bottom-nav a:visible");
  await expect(tabs).toHaveCount(5);
  await expect(page.locator(".focused-profile")).toContainText("Philipp");
  const chrome=await page.evaluate(()=>{
   const nav=getComputedStyle(document.querySelector(".bottom-nav"));
   const crest=getComputedStyle(document.querySelector(".brand-logo"));
   const profile=getComputedStyle(document.querySelector(".focused-profile"));
   return {
    navPosition:nav.position,navDisplay:nav.display,logoClip:crest.clipPath,
    logoMask:crest.maskImage,profileRadius:profile.borderTopLeftRadius,
    profileGradient:profile.backgroundImage
   };
  });
  expect(chrome.navPosition).toBe("fixed");
  expect(chrome.navDisplay).toBe("flex");
  expect(chrome.logoClip).toBe("none");
  expect(chrome.logoMask).toBe("none");
  expect(chrome.profileRadius).toBe("16px");
  expect(chrome.profileGradient).toContain("linear-gradient");
  for(const tab of await tabs.all()){
   const box=await tab.boundingBox();
   expect(box.width).toBeGreaterThanOrEqual(44);
   expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.bottom-nav a[data-page="spieler"]').click();
  await expect(page.locator("#view-spieler")).toBeVisible();
  await page.goto("/#einstellungen/profile");
   await expect(page.locator("#settings-room-profile")).toBeVisible();
  await page.locator("#add-player").click();
  await expect(page.locator("#player-dialog")).toBeVisible();
  await page.locator("#cancel-dialog").click();
  await expect(page.locator("#player-dialog")).not.toBeVisible();
  await page.locator(".brand").click();
  await expect(page.locator("#view-start")).toBeVisible();
  await expect(page.locator(".focused-profile")).toContainText("Philipp");
 }
});

test("v142 member statistics appear only once on all mobile widths",async ({page})=>{
 for(const width of [320,375,390,768]){
  await page.setViewportSize({width,height:700});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>window.badmintonAppAccess?.allowed)).toBe(true);
  await expect(page.locator("#match-stats-reference")).toBeHidden();
  const tiles=page.locator("#match-stats-values .match-stat");
  await expect(tiles).toHaveCount(4);
  for(const tile of await tiles.all()){
   const frame=await tile.boundingBox();
   expect(frame).toBeTruthy();
   expect(frame.width).toBeGreaterThan(35);
   expect(frame.x+frame.width).toBeLessThanOrEqual(width+1);
  }
  await expect(page.locator("#match-stats-source-link")).toContainText("Badhub");
 }
});
