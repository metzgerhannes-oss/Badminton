import {test,expect} from "./invited-member.fixture.mjs";

// v200: synthetic local identities only; fixture denies productive Supabase.
const own={id:"99-900010",name:"Eigenes Testprofil"};
const friends=[
 {id:"98-900001",name:"Zulu Test"},
 {id:"98-900002",name:"Alpha Test"},
 {id:"98-900003",name:"Beta Test"}
];
const teamKeys=["nuliga:999999:3","nuliga:999999:1","nuliga:999999:2"];

test("v200: player ordering persists, keyboard focus survives, reset is explicit, new follow appends",async({page})=>{
 await page.addInitScript(({own,friends})=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[own],friends,officialLinks:[],activeProfileId:own.id,chosen:own.id,historyProfilesInitialized:true
  }));
 },{own,friends});
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#spieler");
 const details=page.locator("#friend-manage-details");
 await details.locator("summary").click();
 const order=()=>page.locator('#friend-settings-list [data-friend-move][data-direction="-1"]')
  .evaluateAll(buttons=>buttons.map(button=>button.dataset.friendMove));
 expect(await order()).toEqual(["98-900001","98-900002","98-900003"]);
 const moved=page.locator('[data-friend-move="98-900003"][data-direction="-1"]');
 await moved.click();
 await expect(moved).toBeFocused();
 expect(await order()).toEqual(["98-900001","98-900003","98-900002"]);
 await page.reload();
 await page.locator("#friend-manage-details summary").click();
 expect(await order()).toEqual(["98-900001","98-900003","98-900002"]);
 await page.locator("#friend-order-reset").click();
 await expect(page.locator("#friend-order-reset")).toBeFocused();
 expect(await order()).toEqual(["98-900002","98-900003","98-900001"]);
 const result=await page.evaluate(()=>window.badmintonLibraryToggleFollow({id:"98-900004",name:"Delta Test"}));
 expect(result.ok).toBe(true);
 expect(await order()).toEqual(["98-900002","98-900003","98-900001","98-900004"]);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.players).toEqual([own]);
 expect(stored.friends.map(p=>p.id)).toEqual(await order());
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test("v200: team order and reset persist without touching profile storage",async({page})=>{
 await page.addInitScript(({own,teamKeys})=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[own],friends:[],officialLinks:[],activeProfileId:own.id,chosen:own.id,historyProfilesInitialized:true
  }));
  if(!localStorage.getItem("schmetterlinge-followed-teams-v1"))localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify(teamKeys));
 },{own,teamKeys});
 await page.setViewportSize({width:320,height:720});
 await page.goto("/#mannschaft");
 await expect(page.locator('#team-settings-list [data-team-move][data-direction="-1"]')).toHaveCount(3);
 await page.locator("#team-manage-details summary").click();
 const order=()=>page.locator('#team-settings-list [data-team-move][data-direction="-1"]')
  .evaluateAll(buttons=>buttons.map(button=>button.dataset.teamMove));
 expect(await order()).toEqual(teamKeys);
 const moved=page.locator('[data-team-move="nuliga:999999:2"][data-direction="-1"]');
 await moved.click();
 await expect(moved).toBeFocused();
 expect(await order()).toEqual(["nuliga:999999:3","nuliga:999999:2","nuliga:999999:1"]);
 await page.locator("#team-order-reset").click();
 await expect(page.locator("#team-order-reset")).toBeFocused();
 expect(await order()).toEqual(["nuliga:999999:1","nuliga:999999:2","nuliga:999999:3"]);
 await page.reload();
 await page.locator("#team-manage-details summary").click();
 expect(await order()).toEqual(["nuliga:999999:1","nuliga:999999:2","nuliga:999999:3"]);
 const saved=await page.evaluate(()=>({
  teams:JSON.parse(localStorage.getItem("schmetterlinge-followed-teams-v1")),
  profile:JSON.parse(localStorage.getItem("shuttleboard-v1"))
 }));
 expect(saved.teams).toEqual(["nuliga:999999:1","nuliga:999999:2","nuliga:999999:3"]);
 expect(saved.profile.players).toEqual([own]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});
