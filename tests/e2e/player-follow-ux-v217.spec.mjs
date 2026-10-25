import {test,expect} from "./invited-member.fixture.mjs";
for(const width of [320,390,1280]){
 test("v217: "+width+"px one search, reorder, independent unfollow and persistent family",async({page})=>{
  await page.addInitScript(()=>{if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-920001",name:"Eigenes Profil"}],
   friends:[{id:"98-920002",name:"Zoe Test"},{id:"98-920003",name:"Anna Test"},{id:"98-920004",name:"Max Test"}],
   activeProfileId:"99-920001",chosen:"99-920001",officialLinks:[],historyProfilesInitialized:true
  }));});
  await page.setViewportSize({width,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  const order=()=>page.locator("#friend-list [data-follow-row]").evaluateAll(nodes=>nodes.map(x=>x.dataset.followRow));
  expect(await order()).toEqual(["98-920002","98-920003","98-920004"]);
  const search=page.locator("#followed-player-search");
  await expect(search).toBeVisible();
  await expect(page.locator("#player-add-open")).toHaveCount(0);
  await expect(page.locator("#friend-manage-details")).toHaveCount(0);
  const grip=page.locator('[data-friend-grip="98-920004"]');
  await grip.focus();
  await page.keyboard.press("ArrowUp");
  await expect(grip).toBeFocused();
  expect(await order()).toEqual(["98-920002","98-920004","98-920003"]);
  await page.reload({waitUntil:"domcontentloaded"});
  expect(await order()).toEqual(["98-920002","98-920004","98-920003"]);
  await search.fill("Anna");
  await expect(page.locator("#friend-list [data-follow-row]")).toHaveCount(1);
  await expect(page.locator("#player-discover")).toBeVisible();
  await expect(page.locator("[data-friend-grip]")).toHaveCount(0);
  await expect(page.locator("[data-edit-friend]")).toBeEnabled();
  await search.fill("");
  expect(await order()).toEqual(["98-920002","98-920004","98-920003"]);
  await page.locator('[data-unfollow-inline="98-920004"]').click();
  expect(await order()).toEqual(["98-920002","98-920003"]);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
  expect(saved.players.map(x=>x.id)).toEqual(["99-920001"]);
  expect(saved.friends.map(x=>x.id)).toEqual(["98-920002","98-920003"]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
test("v217 touch/pointer grip reorder does not open a player card",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[{id:"99-930001",name:"Eigenes Profil"}],
  friends:[{id:"98-930002",name:"Erster Test"},{id:"98-930003",name:"Zweiter Test"},{id:"98-930004",name:"Dritter Test"}],
  activeProfileId:"99-930001",chosen:"99-930001",officialLinks:[],historyProfilesInitialized:true
 })));
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 const grip=page.locator('[data-friend-grip="98-930004"]');
 const top=page.locator('[data-follow-row="98-930002"]');
 const from=await grip.boundingBox(),to=await top.boundingBox();
 expect(from&&to).toBeTruthy();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
 await page.mouse.down();
 await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});
 await page.mouse.up();
 const order=await page.locator("#friend-list [data-follow-row]").evaluateAll(nodes=>nodes.map(el=>el.dataset.followRow));
 expect(order[0]).toBe("98-930004");
 await expect(page.locator("#view-spieler")).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).activeProfileId)).toBe("99-930001");
});
