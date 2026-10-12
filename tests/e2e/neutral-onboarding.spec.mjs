import {test,expect} from "@playwright/test";

test("Installed app searches DBV and returns with verified player ID",async ({page})=>{
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.pathname==="/rest/v1/players")return route.fulfill({
   status:200,contentType:"application/json",
   body:JSON.stringify([
    {dbv_id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen",birth_year:2010,age_class:"U17"},
    {dbv_id:"05-051234",name:"Sarah Beispiel",club:"Anderer Verein",birth_year:2011,age_class:"U17"}
   ]),headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer"}
  });
  if(url.hostname==="127.0.0.1"||url.hostname==="localhost")return route.continue();
  return route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer"}});
 });
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#first-run-dialog")).toBeVisible();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(before.players).toHaveLength(0);
 await page.locator("#first-run-new").click();
 await expect(page).toHaveURL(/\/welcome\.html\?from=app$/);
 await expect(page.locator("#welcome-player-search")).toBeVisible();
 await page.locator("#welcome-player-search").fill("Storz");
 const hit=page.locator(".welcome-search-hit",{hasText:"Sarah Storz"});
 await expect(hit).toContainText("DBV 05-061350");
 await expect(hit).toContainText("SpVgg Mössingen");
 await hit.click();
 const unsaved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(unsaved.players).toHaveLength(0);
 await page.locator("#welcome-selection-save").click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(1);
 expect(saved.players[0]).toMatchObject({id:"05-061350",name:"Sarah Storz",birthYear:2010,club:"SpVgg Mössingen"});
 expect(saved.activeProfileId).toBe("05-061350");
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#first-run-dialog")).not.toBeVisible();
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
});

test("Cancel installed-app search without silently creating a profile",async ({page})=>{
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"
  ?route.continue():route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*"}}));
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.locator("#first-run-new").click();
 await expect(page.locator("#welcome-app-back")).toBeVisible();
 await page.locator("#welcome-app-back").click();
 await expect(page.locator("#first-run-dialog")).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(0);
});

test("Installed app offers local-only manual fallback without a DBV result",async ({page})=>{
 await page.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"
  ?route.continue():route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*"}}));
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await page.locator("#first-run-new").click();
 await page.locator("#welcome-manual-panel summary").click();
 await page.locator("#welcome-name").fill("Kind ohne Rangliste");
 await page.locator('#welcome-form button[type="submit"]').click();
 await expect(page).toHaveURL(/\/index\.html#start$/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(1);
 expect(saved.players[0].id).toMatch(/^local-/);
});

test("Invitation link finds a verified player by name and saves only after confirmation",async ({page})=>{
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.pathname==="/rest/v1/players"){
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify([
    {dbv_id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen",birth_year:2010,age_class:"U17"},
    {dbv_id:"05-051234",name:"Sarah Beispiel",club:"Anderer Verein",birth_year:2011,age_class:"U17"}
   ]),headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer"}});
  }
  if(url.hostname==="127.0.0.1"||url.hostname==="localhost")return route.continue();
  return route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*"}});
 });
 await page.goto("/welcome.html",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#welcome-manual-panel")).not.toHaveAttribute("open","");
 await page.locator("#welcome-player-search").fill("Storz");
 const result=page.locator(".welcome-search-hit",{hasText:"Sarah Storz"});
 await expect(result).toContainText("05-061350");
 await result.click();
 await expect(page.locator("#welcome-selection")).toBeVisible();
 const before=await page.evaluate(()=>localStorage.getItem("shuttleboard-v1"));
 expect(before).toBeNull();
 await page.locator("#welcome-selection-save").click();
 await expect(page.locator("#onboard-install")).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(1);
 expect(saved.players[0]).toMatchObject({id:"05-061350",name:"Sarah Storz",club:"SpVgg Mössingen",birthYear:2010});
 expect(saved.activeProfileId).toBe("05-061350");
});

test("Invitation still offers manual creation when no public DBV result exists",async ({page})=>{
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.hostname==="127.0.0.1"||url.hostname==="localhost")return route.continue();
  return route.fulfill({status:200,contentType:"application/json",body:"[]",
   headers:{"Access-Control-Allow-Origin":"*"}});
 });
 await page.goto("/welcome.html",{waitUntil:"domcontentloaded"});
 await page.locator("#welcome-player-search").fill("Nicht Vorhanden");
 await expect(page.locator("#welcome-search-status")).toContainText("Kein passender");
 await page.locator("#welcome-manual-panel summary").click();
 await page.locator("#welcome-name").fill("Neues Kind");
 await page.locator('#welcome-form input[name="birthYear"]').fill("2016");
 await page.locator('#welcome-form button[type="submit"]').click();
 await expect(page.locator("#onboard-install")).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toHaveLength(1);
 expect(saved.players[0].name).toBe("Neues Kind");
 expect(saved.players[0].id).toMatch(/^local-/);
});
