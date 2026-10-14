import {test,expect} from "@playwright/test";

const player="99-123456";
test("Profile choice offers optional local data import once; settings can reopen it",async ({page})=>{
 await page.addInitScript(id=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id,name:"Testspielerin",club:"Musterverein"}],
   activeProfileId:id,chosen:id,friends:[],officialLinks:[]
  }));
 },player);
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#focused-profile")).toContainText("Testspielerin");
 // The app shell can paint before ES modules finish loading: wait for the
 // import feature to mount before simulating a user selection.
 await expect(page.locator(".player-copy-entry button")).toHaveCount(1);
 const sent=await page.evaluate(id=>{
  window.dispatchEvent(new CustomEvent("badminton:profile-selected",{detail:{playerId:id}}));
  return localStorage.getItem("schmetterlinge.consentedPlayerData.v1");
 },player);
 expect(sent,"Simply offering import must not copy private data").toBeNull();
 const dialog=page.locator("#player-copy-dialog");
 await expect(dialog).toBeVisible();
 await expect(dialog).toContainText("Deine Daten übernehmen");
 await expect(page.locator("#player-copy-now")).toBeVisible();
 await page.locator("#player-copy-later").click();
 await expect(dialog).toBeHidden();
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent("badminton:profile-selected",{detail:{playerId:id,source:"onboarding"}})),player);
 await expect(dialog).toBeHidden();
 // A normal profile switch or library selection never blocks the current task.
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent("badminton:profile-selected",{detail:{playerId:id}})),player);
 await expect(dialog).toBeHidden();
 await page.goto("/#einstellungen/daten",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#settings-room-daten")).toBeVisible();
 await page.getByRole("button",{name:"Daten für ausgewählten Spieler übernehmen"}).click();
 await expect(dialog).toBeVisible();
 await expect(page.locator("#player-copy-summary")).toContainText("Noch keine lokale Datenkopie");
 await page.locator("#player-copy-later").click();
});
