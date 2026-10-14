import {test,expect} from "@playwright/test";
const store={
 players:[{id:"01-000001",name:"Spielerin Beispiel",club:"SV Test"},
          {id:"01-000002",name:"Spieler Muster",club:"SV Test"}],
 friends:[],officialLinks:[],activeProfileId:"01-000001",chosen:"01-000001",
 historyProfilesInitialized:true
};
test("Explicit profile choice opens data import before another screen, without a network read",async({page})=>{
 let protectedReads=0;
 await page.route("**/rest/v1/rpc/private_*",route=>{protectedReads++;return route.abort("failed")});
 await page.addInitScript(saved=>localStorage.setItem("shuttleboard-v1",JSON.stringify(saved)),store);
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#profile-import-dialog")).not.toBeVisible();
 await page.locator(".focus-switcher summary").click();
 await page.locator('[data-switch-profile="01-000002"]').click();
 await expect(page.locator("#profile-import-dialog")).toBeVisible();
 await expect(page.locator("#profile-import-name")).toHaveText("Spieler Muster");
 await expect(page.locator("#profile-import-run")).toBeEnabled();
 expect(protectedReads).toBe(0,"Selecting a profile must not download personal data");
 await page.locator("#profile-import-later").click();
 await expect(page.locator("#profile-import-dialog")).not.toBeVisible();
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#profile-import-dialog")).not.toBeVisible();
});
test("Welcome offers data step immediately after saving, with skip to installation",async({page})=>{
 await page.goto("/welcome.html",{waitUntil:"domcontentloaded"});
 await page.locator("#welcome-manual-panel summary").click();
 await page.locator("#welcome-name").fill("Kind Beispiel");
 await page.locator("#welcome-form button[type=submit]").click();
 await expect(page.locator("#onboard-profile")).toBeHidden();
 await expect(page.locator("#onboard-data")).toBeVisible();
 await expect(page.locator("#onboard-install")).toBeHidden();
 await expect(page.locator("#welcome-data-import")).toBeVisible();
 await page.locator("#welcome-data-skip").click();
 await expect(page.locator("#onboard-install")).toBeVisible();
 await expect(page.locator("#onboard-data")).toBeHidden();
});
