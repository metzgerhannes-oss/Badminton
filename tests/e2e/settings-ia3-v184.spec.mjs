import {test,expect} from "./invited-member.fixture.mjs";

// All browser tests use synthetic storage and block production Supabase traffic.
const own=[{id:"99-100001",name:"Mein Kind Eins"},{id:"99-100002",name:"Mein Kind Zwei"}];
const friends=[{id:"98-200001",name:"Gefolgt Eins"}];
async function seed(page){
 await page.addInitScript(({own,friends})=>{
  localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:own,friends,activeProfileId:own[0].id,chosen:own[0].id,
   officialLinks:[],historyProfilesInitialized:true
  }));
 },{own,friends});
}
const targets=[
 ["profile","Profile & Familie"],
 ["darstellung","App & Darstellung"],
 ["einladungen","Zugänge & Freigaben"],
 ["daten","Daten & Datenschutz"],
 ["hilfe","Hilfe & Informationen"]
];
test("v184: five accessible canonical settings rooms, no duplicate functions",async({page})=>{
 await seed(page);
 await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#app-access-gate")).toBeHidden();
 const nav=page.locator("#settings-room-hub nav[aria-label='Einstellungsbereiche']");
 await expect(nav.locator(".settings-room-link")).toHaveCount(5);
 await expect(page.locator("#settings-room-hub")).toBeVisible();
 for(const [id,title] of targets){
  const link=nav.locator('[data-settings-target="'+id+'"]');
  await expect(link).toContainText(title);
  await link.click();
  await expect(page).toHaveURL(new RegExp("#einstellungen/"+id+"$"));
  await expect(page.locator("#settings-room-"+id)).toBeVisible();
  await expect(page.locator("#settings-room-"+id+" h3").first()).toHaveText(title);
  await expect(page.locator("#settings-room-hub")).toBeHidden();
  await page.locator("#settings-room-"+id+" a.settings-room-back").click();
  await expect(page.locator("#settings-room-hub")).toBeVisible();
 }
 await expect(page.locator("#settings-room-profile #profile-list")).toHaveCount(1);
 await expect(page.locator("#settings-room-darstellung #app-language")).toHaveCount(1);
 await expect(page.locator("#settings-room-darstellung #club-branding-form")).toHaveCount(1);
 await expect(page.locator("#settings-room-einladungen .invitation-card")).toHaveCount(1);
 await expect(page.locator("#settings-room-einladungen #owner-admin-panel")).toHaveCount(1);
 await expect(page.locator("#settings-room-einladungen #owner-activation-setup")).toHaveCount(1);
 await expect(page.locator("#settings-room-daten #backup-export")).toHaveCount(1);
 await expect(page.locator("#settings-room-hilfe .sources-reference-link")).toHaveCount(1);
 await expect(page.locator('#settings-room-hilfe a[href="./wiki.html"]')).toHaveCount(1);
 await expect(page.locator("#view-einstellungen #friend-settings-list")).toHaveCount(0);
 await expect(page.locator("#view-einstellungen #team-settings-list")).toHaveCount(0);
});

test("v184: existing deep links redirect, local profiles and follows survive settings navigation",async({page})=>{
 await seed(page);
 await page.goto("/#einstellungen/quellen",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/#einstellungen\/hilfe$/);
 await expect(page.locator("#settings-room-hilfe")).toBeVisible();
 await page.goto("/#einstellungen/spieler",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/#spieler$/);
 await expect(page.locator("#view-spieler")).toBeVisible();
 await page.goto("/#einstellungen/mannschaften",{waitUntil:"domcontentloaded"});
 await expect(page).toHaveURL(/#mannschaft$/);
 await expect(page.locator("#view-mannschaft")).toBeVisible();
 await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#profile-list .own-profile")).toHaveCount(2);
 await page.locator("#settings-room-profile a.settings-room-back").click();
 await page.locator('nav.bottom-nav a[data-page="start"]').click();
 await expect(page.locator("#view-start")).toBeVisible();
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.players.map(p=>p.id)).toEqual(own.map(p=>p.id));
 expect(stored.friends.map(p=>p.id)).toEqual(friends.map(p=>p.id));
 expect(stored.activeProfileId).toBe(own[0].id);
});
for(const width of [320,390,1280,1920]){
 test("v184: settings remain readable and touch accessible at "+width+"px",async({page})=>{
  await seed(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await expect(page.locator("#settings-room-hub .settings-room-link")).toHaveCount(5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
  const sizes=await page.locator("#settings-room-hub .settings-room-link").evaluateAll(
   links=>links.map(node=>node.getBoundingClientRect().height));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
  await page.locator('[data-settings-target="daten"]').click();
  await expect(page.locator("#settings-room-daten #backup-export")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
