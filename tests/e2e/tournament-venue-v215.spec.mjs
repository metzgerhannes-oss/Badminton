import {test,expect} from "./invited-member.fixture.mjs";

const player={id:"99-900011",name:"Synthetisches Familienprofil"};
const uuidA="11111111-2222-4333-8444-555555555555";
const uuidB="22222222-3333-4444-8555-666666666666";
const link=id=>"https://dbv.turnier.de/tournament/"+id;
const seed=(page,links=[])=>page.addInitScript(({player,links})=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
 players:[player],friends:[],officialLinks:links,activeProfileId:player.id,
 chosen:player.id,historyProfilesInitialized:true
})),{player,links});

for(const width of [320,390,1280]){
 test("v215 "+width+"px: manual venue survives edit and reload without a source request",async({page})=>{
  await seed(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
  await page.locator("#add-tournament").click();
  const form=page.locator("#tournament-form");
  await form.locator('input[name="url"]').fill(link(uuidA));
  await form.locator('input[name="name"]').fill("Synthetisches E-RLT");
  await form.locator('input[name="startDate"]').fill("2026-11-15");
  await form.locator('input[name="place"]').fill("Musterhalle, Musterstraße 1");
  await page.locator("#tournament-save").click();
  const card=page.locator("#official-tournament-list .tournament-card").first();
  await expect(card).toContainText("Austragungsort: Musterhalle, Musterstraße 1");
  await expect(card).toContainText(/15\.\s*Nov\.?\s*2026/);
  await page.reload({waitUntil:"domcontentloaded"});
  await expect(card).toContainText("Austragungsort: Musterhalle, Musterstraße 1");
  await card.locator("[data-edit-id]").click();
  await expect(form.locator('input[name="place"]')).toHaveValue("Musterhalle, Musterstraße 1");
  await form.locator('input[name="place"]').fill("Andere Musterhalle");
  await page.locator("#tournament-save").click();
  await expect(card).toContainText("Austragungsort: Andere Musterhalle");
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).officialLinks);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({id:uuidA,playerId:player.id,startDate:"2026-11-15",place:"Andere Musterhalle"});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}

test("v215: unrelated E/D tournament UUIDs never borrow each other's venue or date",async({page})=>{
 await seed(page,[
  {id:uuidA,url:link(uuidA),playerId:player.id,name:"E-RLT Musterstadt",startDate:"2026-11-15",endDate:""},
  {id:uuidB,url:link(uuidB),playerId:player.id,name:"D-RLT Musterstadt",startDate:"2026-11-22",endDate:"",place:"Offiziell nicht zugeordnete Musterhalle"}
 ]);
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const a=page.locator('[data-edit-id="'+uuidA+'"]').locator("xpath=ancestor::article");
 const b=page.locator('[data-edit-id="'+uuidB+'"]').locator("xpath=ancestor::article");
 await expect(a).toContainText("Austragungsort nicht erfasst");
 await expect(a).toContainText(/15\.\s*Nov\.?\s*2026/);
 await expect(b).toContainText("Offiziell nicht zugeordnete Musterhalle");
 await expect(b).toContainText(/22\.\s*Nov\.?\s*2026/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).officialLinks);
 expect(saved.find(x=>x.id===uuidA).place).toBe("");
 expect(saved.find(x=>x.id===uuidB).startDate).toBe("2026-11-22");
});

test("v215: existing calendar favorite accepts a local venue without changing calendar ID or dates",async({page})=>{
 const calendar={source:"dbv-calendar",id:"dbv-calendar-44094",url:"https://turniere.badminton.de/",
  playerId:player.id,name:"Synthetischer Kalendereintrag",startDate:"2026-11-22",endDate:"2026-11-22"};
 await seed(page,[calendar]);
 await page.setViewportSize({width:320,height:844});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 const card=page.locator("#official-tournament-list .tournament-card").first();
 await expect(card).toContainText("Austragungsort nicht erfasst");
 await card.locator("[data-edit-venue-id]").click();
 await expect(page).toHaveURL(/#turniere$/);
 await expect(page.locator("#tournament-venue-dialog")).toHaveAttribute("open","");
 await page.locator("#tournament-venue-input").fill("Synthetische Halle");
 await page.locator("#tournament-venue-form button[type=submit]").click();
 await expect(card).toContainText("Austragungsort: Synthetische Halle");
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(card).toContainText("Austragungsort: Synthetische Halle");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).officialLinks);
 expect(saved).toHaveLength(1);
 expect(saved[0]).toMatchObject({...calendar,place:"Synthetische Halle"});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});
