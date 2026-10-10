import {test,expect} from "@playwright/test";
const PLAYER="05-070879",FRIEND="05-061350";
test.beforeEach(async ({page})=>{
 await page.addInitScript(({id,friend})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id,name:"Philipp Metzger",birthYear:2016}],
   friends:[{id:friend,name:"Sarah Storz"}],officialLinks:[],
   activeProfileId:id,chosen:id,historyProfilesInitialized:true
  }));
 },{id:PLAYER,friend:FRIEND});
});
test("Keyboard, navigation, and Escape retain a consistent profile",async ({page})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".bottom-nav a[aria-current='page']")).toHaveCount(1);
 const add=page.locator("#add-player");
 await add.focus();
 await add.click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.keyboard.press("Escape");
 await expect(page.locator("#player-dialog")).not.toBeVisible();
 await page.locator('.bottom-nav a[data-page="start"]').click();
 await expect(page.locator(".focused-profile")).toContainText("Philipp");
 await expect(page.locator(".bottom-nav a[aria-current='page']")).toHaveCount(1);
});
test("Going offline does not delete local family data",async ({page,context})=>{
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await context.setOffline(true);
 await expect(page.locator("#connection-status")).toBeVisible();
 await page.locator('.bottom-nav a[data-page="start"]').click();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.friends.some(x=>x.id===FRIEND)).toBe(true);
 await context.setOffline(false);
 await expect(page.locator("#connection-status")).toBeHidden();
 await page.reload({waitUntil:"domcontentloaded"});
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(after.activeProfileId).toBe(PLAYER);
 expect(after.friends.some(x=>x.id===FRIEND)).toBe(true);
});
