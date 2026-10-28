import {test,expect} from "./invited-member.fixture.mjs";

// UX/F08: no live Supabase traffic; all members and tournaments are synthetic.
// A Home tournament is an exact local bookmark, not a guess based on its title.
const OWNER="99-000001";
const CALENDAR="dbv-calendar-999987";
const UUID="E24DC6EE-152A-454D-B00C-E625B751D7D5";
const EVENT_URL="https://dbv.turnier.de/tournament/"+UUID;
test.beforeEach(async({page})=>{
 await page.addInitScript(({owner,id,uuid,url})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:owner,name:"Synthetisches Familienprofil",club:"Testverein"}],
   friends:[],activeProfileId:owner,chosen:owner,historyProfilesInitialized:true,
   officialLinks:[
    {id,source:"dbv-calendar",url:"https://turniere.badminton.de/",
     playerId:owner,name:"3. D-RLT BAW SW U11-U19",
     startDate:"2028-11-22",endDate:"2028-11-22",place:"Gomaringen",deadline:"2028-11-15"},
    {id:uuid,url,playerId:owner,name:"German Masters U11",
     startDate:"2028-12-05",endDate:"2028-12-06",place:"",deadline:""}
   ]
  }));
 },{owner:OWNER,id:CALENDAR,uuid:UUID,url:EVENT_URL});
});

for(const width of [320,390]){
 test("Home opens the exact tournament card without an extra tap at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  const direct=page.locator('.upcoming-tournament-row[href="#turniere/'+CALENDAR+'/'+OWNER+'"]');
  await expect(direct).toHaveCount(1);
  await expect(direct).toContainText("Gomaringen");
  await direct.click();
  await expect(page).toHaveURL(new RegExp("#turniere/"+CALENDAR+"/"+OWNER+"$"));
  await expect(page.locator("#view-turniere")).toBeVisible();
  const card=page.locator('#official-tournament-list [data-saved-tournament-id="'+CALENDAR+'"]');
  await expect(card).toBeVisible();
  await expect(card).toBeFocused();
  await expect(card.locator("h3")).toContainText("· Gomaringen");
  await expect(card.locator(".saved-tournament-dates")).toContainText("22.");
  await expect(card.locator(".saved-tournament-player")).toHaveText("Spieler: Synthetisches Familienprofil");
  await expect(card.locator('.card-open-primary')).toHaveText("DBV-Kalender öffnen");
  await expect(card.locator('.card-open-primary')).toHaveAttribute("href","https://turniere.badminton.de/");
  const box=await card.evaluate(node=>{
   const footer=node.querySelector(".saved-tournament-player").getBoundingClientRect();
   const actions=node.querySelector(".local-shortcut-actions").getBoundingClientRect();
   return {after:footer.top>=actions.bottom-1,screenWidth:document.documentElement.scrollWidth-innerWidth};
  });
  expect(box.after).toBe(true);
  expect(box.screenWidth).toBeLessThanOrEqual(2);
  await page.goBack();
  await expect(page.locator("#view-start")).toBeVisible();
 });
}

test("direct DBV URL is used only when the matching source calendar key confirms it",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 const calendar=page.locator('#official-tournament-list [data-saved-tournament-id="'+CALENDAR+'"]');
 const masters=page.locator('#official-tournament-list [data-saved-tournament-id="'+UUID+'"]');
 await expect(calendar.locator(".card-open-primary")).toHaveText("DBV-Kalender öffnen ↗");
 await expect(masters.locator(".card-open-primary")).toHaveAttribute("href",EVENT_URL);
 await expect(masters.locator("h3")).toHaveText("German Masters U11");
 await expect(masters.locator(".saved-tournament-venue")).toHaveText("Austragungsort nicht erfasst");
 await page.evaluate(({id,url})=>window.dispatchEvent(new CustomEvent("badminton:dbv-calendar-loaded",{
  detail:{entries:[{key:id,hasDirectLink:true,url,title:"3. D-RLT BAW SW U11-U19",
    start:"2028-11-22",end:"2028-11-22",place:"Gomaringen",deadline:"2028-11-15"}]}
 })),{id:CALENDAR,url:EVENT_URL});
 await expect(calendar.locator(".card-open-primary")).toHaveAttribute("href",EVENT_URL);
 await expect(calendar.locator(".card-open-primary")).toHaveText("Offizielle Turnierseite ↗");
});
