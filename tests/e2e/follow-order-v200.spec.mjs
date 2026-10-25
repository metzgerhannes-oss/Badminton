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
 await moved.click(); // At the top the up arrow is disabled: focus must fall back to down.
 await expect(page.locator('[data-friend-move="98-900003"][data-direction="1"]')).toBeFocused();
 expect(await order()).toEqual(["98-900003","98-900001","98-900002"]);
 await page.reload();
 await page.locator("#friend-manage-details summary").click();
 expect(await order()).toEqual(["98-900003","98-900001","98-900002"]);
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
 await moved.click(); // Boundary fallback must keep an enabled arrow focused.
 await expect(page.locator('[data-team-move="nuliga:999999:2"][data-direction="1"]')).toBeFocused();
 expect(await order()).toEqual(["nuliga:999999:2","nuliga:999999:3","nuliga:999999:1"]);
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

for(const size of [0,1,5,20]){
 test("P2 #291: "+size+" followed players stay ordered, finish restores focus",async({page})=>{
  const friends=Array.from({length:size},(_,i)=>({
   id:"98-"+String(900100+i).padStart(6,"0"),name:"Synthetischer Spieler "+String(i).padStart(2,"0")
  }));
  await page.addInitScript(({friends})=>{
   if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"99-900010",name:"Eigenes Testprofil"}],friends,
    officialLinks:[],activeProfileId:"99-900010",chosen:"99-900010",
    historyProfilesInitialized:true
   }));
  },{friends});
  await page.setViewportSize({width:size%2?390:320,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  const details=page.locator("#friend-manage-details");
  await details.locator("summary").click();
  const arrows=page.locator('#friend-settings-list [data-friend-move][data-direction="-1"]');
  await expect(arrows).toHaveCount(size);
  if(size>1){
   const id=friends[size-1].id;
   await page.locator('[data-friend-move="'+id+'"][data-direction="-1"]').click();
   await page.locator("#friend-order-done").click();
   await expect(details).not.toHaveAttribute("open");
   await expect(details.locator("summary")).toBeFocused();
   await page.reload({waitUntil:"domcontentloaded"});
   await details.locator("summary").click();
   const ordered=await arrows.evaluateAll(nodes=>nodes.map(el=>el.dataset.friendMove));
   expect(ordered.at(-2)).toBe(id);
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
   expect(saved.friends.map(p=>p.id)).toEqual(ordered);
   expect(saved.players).toHaveLength(1);
  }else{
   await expect(page.locator("#friend-order-reset")).toBeDisabled();
   await page.locator("#friend-order-done").click();
   await expect(details.locator("summary")).toBeFocused();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
 test("P2 #291: "+size+" followed teams stay ordered, finish restores focus",async({page})=>{
  const teams=Array.from({length:size},(_,i)=>"nuliga:999999:"+(i+1));
  await page.addInitScript(({teams})=>{
   if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"99-900010",name:"Eigenes Testprofil"}],friends:[],
    officialLinks:[],activeProfileId:"99-900010",chosen:"99-900010",
    historyProfilesInitialized:true
   }));
   if(!localStorage.getItem("schmetterlinge-followed-teams-v1"))
    localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify(teams));
  },{teams});
  await page.setViewportSize({width:size%2?390:320,height:844});
  await page.goto("/#mannschaft",{waitUntil:"domcontentloaded"});
  const details=page.locator("#team-manage-details");
  await details.locator("summary").click();
  const arrows=page.locator('#team-settings-list [data-team-move][data-direction="-1"]');
  await expect(arrows).toHaveCount(size);
  if(size>1){
   const id=teams[size-1];
   await page.locator('[data-team-move="'+id+'"][data-direction="-1"]').click();
   await page.locator("#team-order-done").click();
   await expect(details).not.toHaveAttribute("open");
   await expect(details.locator("summary")).toBeFocused();
   await page.reload({waitUntil:"domcontentloaded"});
   await details.locator("summary").click();
   const ordered=await arrows.evaluateAll(nodes=>nodes.map(el=>el.dataset.teamMove));
   expect(ordered.at(-2)).toBe(id);
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge-followed-teams-v1")));
   expect(stored).toEqual(ordered);
  }else{
   await expect(page.locator("#team-order-reset")).toBeDisabled();
   await page.locator("#team-order-done").click();
   await expect(details.locator("summary")).toBeFocused();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
