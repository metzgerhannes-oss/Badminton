import {test,expect} from "./supabase-isolated.fixture.mjs";

// Synthetic browser storage only. Neither Safari nor Playwright may upload private
// family profiles or touch production Supabase while testing an installation.
const family={
 players:[{id:"99-100001",name:"Testperson A",birthYear:2016,club:"Testverein"}],
 friends:[{id:"99-100002",name:"Testperson B"}],
 officialLinks:[],activeProfileId:"99-100001",chosen:"99-100001",
 historyProfilesInitialized:true
};

test("existing Safari profile can download a local file before installing",async({page})=>{
 await page.addInitScript(data=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify(data));
 },family);
 await page.setViewportSize({width:320,height:700});
 await page.goto("/welcome.html#installation",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#onboard-install")).toBeVisible();
 const section=page.locator("#install-existing-backup");
 await expect(section).toBeVisible();
 const button=page.locator("#install-backup-export");
 await expect(button).toContainText("Meine Daten sichern");
 const size=await button.boundingBox();
 expect(size.height).toBeGreaterThanOrEqual(44);
 const [download]=await Promise.all([page.waitForEvent("download"),button.click()]);
 expect(download.suggestedFilename()).toMatch(/^schmetterlinge-sicherung-\d{4}-\d\d-\d\d\.json$/);
 const stream=await download.createReadStream();
 let serialized="";
 for await(const chunk of stream)serialized+=chunk.toString("utf8");
 const archive=JSON.parse(serialized);
 expect(archive.kind).toBe("schmetterlinge-local-backup");
 expect(archive.schemaVersion).toBe(2);
 expect(archive.data.players.map(x=>x.id)).toEqual(["99-100001"]);
 expect(archive.data.friends.map(x=>x.id)).toEqual(["99-100002"]);
 expect(archive.data.activeProfileId).toBe("99-100001");
 expect(archive.calendarEvents).toEqual([]);
 await expect(page.locator("#install-backup-feedback")).toContainText("Sicherung erstellt");
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1"))))
  .toEqual(family);
});

test("fresh iPhone has no backup action for an empty Safari store",async({page})=>{
 await page.goto("/welcome.html#installation",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#onboard-install")).toBeVisible();
 await expect(page.locator("#install-existing-backup")).toBeHidden();
});

test("invalid legacy Safari data is never downloaded or silently overwritten",async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-100001",name:"Testperson A"}],
   friends:[],officialLinks:[],activeProfileId:"99-999999"
  }));
 });
 await page.goto("/welcome.html#installation",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#install-backup-export")).toBeVisible();
 await page.locator("#install-backup-export").click();
 await expect(page.locator("#install-backup-feedback")).toContainText(
  "Das aktive Profil ist kein eigenes Spielerprofil");
 const existing=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(existing.activeProfileId).toBe("99-999999");
});
