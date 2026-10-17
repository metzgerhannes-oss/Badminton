import {test,expect} from "./invited-member.fixture.mjs";

// Step 3: only client-side navigation/scroll/focus. Production Supabase is mocked.
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"05-070879",name:"Testprofil",club:"Testverein"}],
   friends:[{id:"05-061350",name:"Testfreund"}],
   officialLinks:[],activeProfileId:"05-070879",chosen:"05-070879",
   historyProfilesInitialized:true
  }));
 });
});
test("browser Back restores earlier scroll, new tabs start at top",async({page})=>{
 await page.setViewportSize({width:320,height:640});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-start")).toBeVisible();
 const max=await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight);
 expect(max).toBeGreaterThan(240);
 await page.evaluate(()=>window.scrollTo({top:Math.min(420,document.documentElement.scrollHeight-innerHeight),behavior:"instant"}));
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(200);
 const previous=await page.evaluate(()=>window.scrollY);
 await page.locator('.bottom-nav a[data-page="spieler"]').click();
 await expect(page.locator("#view-spieler")).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(20);
 await page.goBack();
 await expect(page).toHaveURL(/#start$/);
 await expect(page.locator("#view-start")).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(180);
 const restored=await page.evaluate(()=>window.scrollY);
 expect(Math.abs(restored-previous)).toBeLessThanOrEqual(55);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.activeProfileId).toBe("05-070879");
 expect(stored.friends).toHaveLength(1);
});
test("a newly selected tab starts at top and active route is clear",async({page})=>{
 await page.setViewportSize({width:390,height:720});
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await page.locator('.bottom-nav a[data-page="turniere"]').click();
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator('.bottom-nav a[data-page="turniere"]')).toHaveAttribute("aria-current","page");
 await expect(page.locator('.bottom-nav a[aria-current="page"]')).toHaveCount(1);
 await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeLessThan(20);
});
test("settings Back and Escape-closed profile dialog preserve keyboard navigation",async({page})=>{
 await page.setViewportSize({width:320,height:640});
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-hub")).toBeVisible();
 await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-profile")).toBeVisible();
 const opener=page.locator("#add-player");
 await opener.focus();
 await opener.click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(page.locator("#player-dialog")).toBeHidden();
 await expect(opener).toBeFocused();
 await page.goBack();
 await expect(page).toHaveURL(/#einstellungen$/);
 await expect(page.locator("#settings-room-hub")).toBeVisible();
});
test("explicit modal cancel restores its opener without moving the screen",async({page})=>{
 await page.setViewportSize({width:375,height:667});
 await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
 const opener=page.locator("#add-player");
 await opener.click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#player-dialog")).toBeHidden();
 await expect(opener).toBeFocused();
});
