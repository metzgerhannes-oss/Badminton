import {test,expect} from "./invited-member.fixture.mjs";

// UX2 #388: synthetic local profiles; fixture denies production Supabase and source networks.
const own={id:"99-800010",name:"Eigenes Testprofil"};
const friends=[
 {id:"98-800001",name:"Alpha Test",club:"Testverein"},
 {id:"98-800002",name:"Beta Test",club:"Testverein"},
 {id:"98-800003",name:"Gamma Test",club:"Testverein"}
];
async function seed(page){
 await page.addInitScript(({own,friends})=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[own],friends,officialLinks:[],activeProfileId:own.id,chosen:own.id,
   historyProfilesInitialized:true
  }));
 },{own,friends});
}
const ids=page=>page.locator("#friend-list [data-follow-row]")
 .evaluateAll(rows=>rows.map(row=>row.dataset.followRow));

for(const width of [320,390]){
 test("v217: filtered player list disables reorder and minus preserves family at "+width+"px",async({page})=>{
  await seed(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
  await expect(page.locator("#friend-list [data-follow-row]")).toHaveCount(3);
  const search=page.locator("#followed-player-search");
  await search.fill("Alpha");
  await expect(page.locator("#friend-list [data-follow-row]")).toHaveCount(1);
  await expect(page.locator('[data-friend-grip="98-800001"]')).toHaveCount(0);
  await expect(page.locator('[data-edit-friend="98-800001"]')).toBeEnabled();
  await search.fill("");
  expect(await ids(page)).toEqual(friends.map(p=>p.id));
  const before=await page.evaluate(()=>location.hash);
  await page.locator('[data-unfollow-inline="98-800002"]').click();
  expect(await page.evaluate(()=>location.hash)).toBe(before);
  expect(await ids(page)).toEqual(["98-800001","98-800003"]);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(saved.players).toEqual([own]);
  expect(saved.friends.map(p=>p.id)).toEqual(["98-800001","98-800003"]);
  await expect(page.locator("#friend-manage-details")).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}

test("v217: pointer drag reorders the main list and persists after reload",async({page})=>{
 await seed(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 const grip=page.locator('[data-friend-grip="98-800003"]');
 const first=page.locator('[data-follow-row="98-800001"]');
 const a=await grip.boundingBox(),b=await first.boundingBox();
 expect(a).not.toBeNull();expect(b).not.toBeNull();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
 await page.mouse.down();
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});
 await page.mouse.up();
 expect(await ids(page)).toEqual(["98-800003","98-800001","98-800002"]);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 expect(await ids(page)).toEqual(["98-800003","98-800001","98-800002"]);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toEqual([own]);
});

test("v217: inline minus offers one-click Undo restoring previous order",async({page})=>{
 await seed(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await page.locator('[data-unfollow-inline="98-800002"]').click();
 expect(await ids(page)).toEqual(["98-800001","98-800003"]);
 const undo=page.locator("#toast .toast-undo");
 await expect(undo).toBeVisible();
 await undo.click();
 expect(await ids(page)).toEqual(friends.map(p=>p.id));
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 expect(await ids(page)).toEqual(friends.map(p=>p.id));
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(saved.players).toEqual([own]);
 await expect(page.locator("#friend-manage-details")).toHaveCount(0);
});
