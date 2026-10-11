import {test,expect} from "@playwright/test";

const PLAYER="05-070879";
const FRIEND="05-061350";
const TOURNAMENT_ID="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const KEY="shuttleboard-v1";
const today=()=>Object.fromEntries(
  new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date()).map(p=>[p.type,p.value])
);
function dateToday(){const p=today();return p.year+"-"+p.month+"-"+p.day}
test.beforeEach(async ({page})=>{
 await page.addInitScript(({player,friend,key,id})=>{
  const parts=Object.fromEntries(
    new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date()).map(p=>[p.type,p.value]));
  const date=parts.year+"-"+parts.month+"-"+parts.day;
  if(!localStorage.getItem("matchday-nav-test")){
   localStorage.setItem(key,JSON.stringify({
    players:[{id:player,name:"Eigener Spieler"}],
    friends:[{id:friend,name:"Verfolgter Spieler"}],
    officialLinks:[{id,url:"https://dbv.turnier.de/tournament/"+id,
      name:"Turniertag Test",playerId:player,startDate:date,endDate:date}],
    activeProfileId:player,chosen:player,historyProfilesInitialized:true
   }));
  }
 },{player:PLAYER,friend:FRIEND,key:KEY,id:TOURNAMENT_ID});
 await page.route("**/*.supabase.co/**",route=>route.fulfill({
  status:200,headers:{"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
  body:route.request().method()==="POST"?'{"queued":false}':"[]"
 }));
});
test("Saved tournament makes LIVE a prominent fifth tab without duplicate score feeds",async ({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(5);
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 const rect=await page.locator("#live-nav-tab").boundingBox();
 expect(rect?.width).toBeGreaterThanOrEqual(44);
 expect(rect?.height).toBeGreaterThanOrEqual(44);
 await page.locator("#live-nav-tab").click();
 await expect(page).toHaveURL(/#live$/);
 await expect(page.locator("#view-turniere")).toBeVisible();
 await expect(page.locator("#live-radar-content")).toBeVisible();
 await expect(page.locator(".live-hub-bookmarks")).toBeHidden();
 await expect(page.locator("#live-nav-tab")).toHaveAttribute("aria-current","page");
 await page.locator("#live-player-select").selectOption(FRIEND);
 await expect(page).toHaveURL(/#live$/);
 await expect(page.locator(".focused-profile")).toContainText("Verfolgter Spieler");
 await page.locator(".live-tournaments-return").click();
 await expect(page).toHaveURL(/#turniere$/);
 await expect(page.locator(".live-hub-bookmarks")).toBeVisible();
});
test("Expired tournament removes LIVE tab but ordinary tournament route remains",async ({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeVisible();
 await page.evaluate(key=>{
  const stored=JSON.parse(localStorage.getItem(key));
  stored.officialLinks[0].startDate="2020-01-01";
  stored.officialLinks[0].endDate="2020-01-01";
  localStorage.setItem(key,JSON.stringify(stored));
  localStorage.setItem("matchday-nav-test","1");
 },KEY);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("#live-nav-tab")).toBeHidden();
 await expect(page.locator(".bottom-nav a:visible")).toHaveCount(4);
 await page.locator('.bottom-nav a[data-page="turniere"]').click();
 await expect(page.locator("#live-radar-content")).toBeVisible();
});
