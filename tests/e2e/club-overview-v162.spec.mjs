import {test,expect} from "./invited-member.fixture.mjs";

// A fully synthetic club fixture: no requests to real Supabase or external providers.
const fixture={schemaVersion:1,clubId:"10777",sourceKind:"official_club_team_photo_captions",sourceSeason:"2025/26",
 teams:["I","II","III","IV","V"].map((team,i)=>({team,
  sourceUrl:"https://www.spvgg.org/abteilungen/badminton/mannschaften/"+(i+1)+"-mannschaft",
  members:i===0?["Spieler Eins","Spieler Zwei","Spieler Drei","Spieler Vier","Spieler Fünf"]:
   ["Spieler Eins",...Array.from({length:5},(_,j)=>"Testname "+"ABCDE"[i]+" "+"ABCDE"[j])] }))};
test("v162 desktop: entire available club roster, filters, profile navigation and dark theme",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"05-123456",name:"Jugend Muster",club:"SpVgg Mössingen"}],
  friends:[],officialLinks:[],activeProfileId:"05-123456"
 })));
 await page.route("**/data/spvgg-active-roster.json",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
 await page.goto("/#verein");
 await expect(page.locator("#view-verein")).toHaveClass(/active/);
 await expect(page.locator("#club-overview-table tbody tr")).toHaveCount(26);
 await expect(page.locator("#club-overview-total")).toContainText("26 erfasste Namen");
 await expect(page.locator("#club-overview-status")).not.toContainText("nicht erreichbar");
 await expect(page.locator(".desktop-club-nav")).toBeVisible();
 await expect(page.locator("body")).toHaveCSS("background-color","rgb(9, 26, 50)");
 await page.locator("#club-overview-search").fill("Spieler Eins");
 await expect(page.locator("#club-overview-table tbody tr")).toHaveCount(1);
 await page.locator("#club-overview-reset").click();
 await page.locator("#club-overview-team").selectOption("I");
 await expect(page.locator("#club-overview-table tbody tr")).toHaveCount(5);
 await page.locator("#club-overview-reset").click();
 await page.locator("[data-open-profile='05-123456']").click();
 await expect(page).toHaveURL(/#start$/);
});
test("v162 mobile: club menu remains invisible and ordinary navigation is unchanged",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start");
 await expect(page.locator(".desktop-club-nav")).toBeHidden();
 await expect(page.locator(".bottom-nav a[data-page='spieler']")).toBeVisible();
 const c=await page.evaluate(()=>({nav:getComputedStyle(document.querySelector(".bottom-nav")).flexDirection,
  overflow:document.documentElement.scrollWidth-innerWidth}));
 expect(c.nav).toBe("row");
 expect(c.overflow).toBeLessThanOrEqual(2);
});


test("v225: homonyms remain separate from roster identities on desktop",async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"05-123456",name:"Spieler Eins",club:"SpVgg Mössingen",ageClass:"U15"},
   {id:"05-654321",name:"Spieler Eins",club:"SpVgg Mössingen",ageClass:"U13"}],
  friends:[],officialLinks:[],activeProfileId:"05-123456"
 })));
 await page.route("**/data/spvgg-active-roster.json",route=>
  route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(fixture)}));
 await page.goto("/#verein");
 const matches=page.locator("#club-overview-table tbody tr").filter({hasText:"Spieler Eins"});
 await expect(matches).toHaveCount(3);
 const official=matches.filter({hasText:"Vereinsquelle"});
 await expect(official).toHaveCount(1);
 await expect(official.locator("td").nth(2)).toHaveText("Nicht erfasst");
 await expect(official.locator("td").nth(3)).toHaveText("–");
 await expect(official.locator("[data-open-profile]")).toHaveCount(0);
 await expect(official).toContainText("Namensgleichheit nicht verifiziert");
 const own=matches.filter({hasText:"Nur lokal"});
 await expect(own).toHaveCount(2);
 await expect(own.locator("[data-open-profile]")).toHaveCount(2);
 await expect(own.locator("[data-open-profile='05-123456']")).toHaveCount(1);
 await expect(own.locator("[data-open-profile='05-654321']")).toHaveCount(1);
 await page.locator("#club-overview-team").selectOption("I");
 await expect(page.locator("#club-overview-table tbody tr")).toHaveCount(5);
});
