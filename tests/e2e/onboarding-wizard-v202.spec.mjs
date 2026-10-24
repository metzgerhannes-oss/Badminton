import {test,expect} from "./invited-member.fixture.mjs";
const player={id:"99-900099",name:"Synthetisches Profil",club:"Testverein"};
const store={players:[player],friends:[],officialLinks:[],activeProfileId:player.id,chosen:player.id,historyProfilesInitialized:true};
test("F07 wizard resumes, reuses real controls and never clears local profiles",async({page})=>{
 await page.addInitScript(data=>{
  if(localStorage.getItem("shuttleboard-v1")===null)localStorage.setItem("shuttleboard-v1",JSON.stringify(data));
  // Seed once per tab, not again after the finish/reload assertion.
  if(sessionStorage.getItem("syntheticWizardSeeded")!=="1"){
   if(localStorage.getItem("schmetterlinge.setupWizard.v1")===null)localStorage.setItem("schmetterlinge.setupWizard.v1","0");
   sessionStorage.setItem("syntheticWizardSeeded","1");
  }
 },store);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start");
 const wizard=page.locator("#onboarding-wizard");
 await expect(wizard).toBeVisible();
 await expect(page.locator("#onboarding-progress")).toHaveText("1 von 4");
 await page.locator("#onboarding-action").click();
 await expect(page.locator("#onboarding-progress")).toHaveText("2 von 4");
 await page.locator("#onboarding-action").click();
 await expect(wizard).not.toBeVisible();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.locator("#cancel-dialog").click();
 await page.locator("#onboarding-resume").click();
 await expect(page.locator("#onboarding-action")).toHaveText("Weiter");
 await page.locator("#onboarding-action").click();
 await expect(page.locator("#onboarding-progress")).toHaveText("3 von 4");
 await page.locator("#onboarding-later").click();
 await page.reload();
 await expect(wizard).toBeVisible();
 await expect(page.locator("#onboarding-progress")).toHaveText("3 von 4");
 await page.locator("#onboarding-action").click();
 await expect(page.locator("#team-discover")).toBeVisible();
 await page.locator("#onboarding-resume").click();
 await page.locator("#onboarding-action").click();
 await expect(page.locator("#onboarding-progress")).toHaveText("4 von 4");
 await page.locator("#onboarding-action").click();
 await expect(page.locator("#dbv-calendar-q")).toBeFocused();
 await page.locator("#onboarding-resume").click();
 await page.locator("#onboarding-action").click();
 await expect(wizard).not.toBeVisible();
 await expect(page).toHaveURL(/#start$/);
 expect(await page.evaluate(()=>localStorage.getItem("schmetterlinge.setupWizard.v1"))).toBeNull();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toEqual([player]);
 await page.reload();
 await expect(wizard).not.toBeVisible();
});
test("F07 existing user is never forced into setup and can restart it in settings",async({page})=>{
 await page.addInitScript(data=>{
  if(localStorage.getItem("shuttleboard-v1")===null)localStorage.setItem("shuttleboard-v1",JSON.stringify(data));
 },store);
 await page.goto("/#einstellungen/hilfe");
 await expect(page.locator("#onboarding-wizard")).not.toBeVisible();
 await page.locator("#onboarding-restart").click();
 await expect(page.locator("#onboarding-wizard")).toBeVisible();
 await expect(page.locator("#onboarding-skip")).toBeHidden();
 await page.locator("#onboarding-later").click();
 expect(await page.evaluate(()=>localStorage.getItem("schmetterlinge.setupWizard.v1"))).toBe("0");
});

test("F07 wizard translates progress and controls in English/Arabic without losing profiles",async({page})=>{
 await page.setViewportSize({width:320,height:700});
 await page.addInitScript(data=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify(data));
  localStorage.setItem("schmetterlinge.setupWizard.v1","0");
  localStorage.setItem("schmetterlinge.uiLanguage","en");
 },store);
 await page.goto("/#start");
 const dialog=page.locator("#onboarding-wizard");
 await expect(dialog).toBeVisible();
 await expect(page.locator("#onboarding-title")).toHaveText("Your profile");
 await expect(page.locator("#onboarding-progress")).toHaveText("1 of 4");
 await page.evaluate(()=>window.SchmetterlingeI18n.choose("ar"));
 await expect(page.locator("html")).toHaveAttribute("dir","rtl");
 await expect(page.locator("#onboarding-title")).toHaveText("ملفك الشخصي");
 await expect(page.locator("#onboarding-progress")).toHaveText("1 من 4");
 const box=await dialog.boundingBox();
 expect(box).not.toBeNull();
 expect(box.x).toBeGreaterThanOrEqual(-1);
 expect(box.x+box.width).toBeLessThanOrEqual(321);
 await page.locator("#onboarding-later").click();
 await expect(page.locator("#onboarding-resume")).toBeVisible();
 const resume=await page.locator("#onboarding-resume").boundingBox();
 expect(resume).not.toBeNull();
 expect(resume.x).toBeGreaterThanOrEqual(-1);
 expect(resume.x+resume.width).toBeLessThanOrEqual(321);
 await page.evaluate(()=>window.SchmetterlingeI18n.choose("en"));
 await page.locator("#onboarding-resume").click();
 await expect(page.locator("#onboarding-progress")).toHaveText("1 of 4");
 await page.locator("#onboarding-action").click();
 await expect(page.locator("#onboarding-title")).toHaveText("More players");
 await expect(page.locator("#onboarding-progress")).toHaveText("2 of 4");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toEqual([player]);
});
