import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile("data/dbv-calendar.json","utf8"));
const own={players:[{id:"05-070879",name:"Testprofil"}],friends:[],officialLinks:[],
 activeProfileId:"05-070879",chosen:"05-070879",historyProfilesInitialized:true};
test.beforeEach(async ({page})=>{
 await page.addInitScript(value=>localStorage.setItem("shuttleboard-v1",JSON.stringify(value)),own);
 await page.route("**/*.supabase.co/**",route=>{
  const url=new URL(route.request().url());
  const rows=url.pathname.endsWith("/dbv_calendar_entries")?data.entries:[];
  return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(rows),
   headers:{"Access-Control-Allow-Origin":"*"}});
 });
});
test("Official calendar clusters by state, age and level without invented registrations",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const results=page.locator("#dbv-calendar-results");
 await expect(page.locator("#dbv-calendar-status")).toContainText("109 offiziellen");
 await expect(results.locator(".dbv-calendar-entry").first()).toBeVisible();
 const filter=page.locator("#dbv-calendar-region");
 await filter.selectOption("Baden-Württemberg");
 await expect(page.locator("#dbv-calendar-status")).toContainText("14 von 109");
 await expect(results.locator(".dbv-calendar-cluster h4")).toHaveCount(1);
 await expect(results).not.toContainText("bestätigte Anmeldung");
 await filter.selectOption("all");
 await page.locator("#dbv-calendar-age").selectOption("U11");
 await expect(page.locator("#dbv-calendar-status")).toContainText("von 109");
 await expect(results.locator(".dbv-calendar-entry").first()).toBeVisible();
 await page.locator("#dbv-calendar-age").selectOption("all");
 await page.locator("#dbv-calendar-level").selectOption("C");
 await expect(results.locator(".dbv-calendar-entry").first()).toContainText("C");
 await page.locator("#dbv-calendar-level").selectOption("all");
 await page.locator("#dbv-calendar-group").selectOption("level");
 await expect(results.locator(".dbv-calendar-cluster h4").first()).toBeVisible();
 const rect=await page.locator(".dbv-calendar-panel").boundingBox();
 expect(rect.x).toBeGreaterThanOrEqual(0);
 expect(rect.x+rect.width).toBeLessThanOrEqual(322);
 await expect(page.locator('.dbv-calendar-entry a[href="https://turniere.badminton.de/"]').first()).toBeVisible();
});
