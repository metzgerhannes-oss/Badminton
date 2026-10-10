import {test,expect} from "@playwright/test";

test("Fresh device configures its own player without receiving another family's profile",async ({page})=>{
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.hostname==="127.0.0.1"||url.hostname==="localhost")return route.continue();
  return route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer"}});
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#first-run-dialog")).toBeVisible();
 await expect(page.locator("#first-run-choices")).toContainText("noch kein eigenes Profil");
 const savedBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(savedBefore.players).toHaveLength(0);
 expect(savedBefore.activeProfileId).toBe("");
 await page.locator("#first-run-new").click();
 await expect(page.locator("#player-dialog")).toBeVisible();
 await page.locator('#player-form input[name="name"]').fill("Testkind");
 await page.locator('#player-form input[name="id"]').fill("05-123456");
 await page.locator('#player-form button[type="submit"]').click();
 await expect(page.locator("#player-dialog")).not.toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Testkind");
 const savedAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(savedAfter.players.map(p=>p.name)).toEqual(["Testkind"]);
 expect(savedAfter.activeProfileId).toBe("05-123456");
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#first-run-dialog")).not.toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Testkind");
});

test("Canceled initial player form does not force another family's defaults",async ({page})=>{
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"
  ?route.continue():route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*"}}));
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.locator("#first-run-new").click();
 await page.locator("#cancel-dialog").click();
 await expect(page.locator("#first-run-dialog")).toBeVisible();
 const profiles=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).players);
 expect(profiles).toHaveLength(0);
});
