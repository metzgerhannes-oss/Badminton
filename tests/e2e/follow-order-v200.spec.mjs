import {test,expect} from "./invited-member.fixture.mjs";

// v200: synthetic local identities only; fixture denies productive Supabase.
const own={id:"99-900010",name:"Eigenes Testprofil"};
const friends=[
 {id:"98-900001",name:"Zulu Test"},
 {id:"98-900002",name:"Alpha Test"},
 {id:"98-900003",name:"Beta Test"}
];
const teamKeys=["nuliga:999999:3","nuliga:999999:1","nuliga:999999:2"];

test("v217: direct player sorting persists and leaves own profiles intact",async({page})=>{
 await page.addInitScript(({own,friends})=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[own],friends,officialLinks:[],activeProfileId:own.id,chosen:own.id,historyProfilesInitialized:true
  }));
 },{own,friends});
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 const order=()=>page.locator("#friend-list [data-follow-row]").evaluateAll(rows=>rows.map(n=>n.dataset.followRow));
 expect(await order()).toEqual(["98-900001","98-900002","98-900003"]);
 const grip=page.locator('[data-friend-grip="98-900003"]');
 await grip.focus();
 await page.keyboard.press("ArrowUp");
 await expect(grip).toBeFocused();
 expect(await order()).toEqual(["98-900001","98-900003","98-900002"]);
 await page.keyboard.press("ArrowUp");
 expect(await order()).toEqual(["98-900003","98-900001","98-900002"]);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 expect(await order()).toEqual(["98-900003","98-900001","98-900002"]);
 await expect(page.locator("#friend-manage-details")).toHaveCount(0);
 const result=await page.evaluate(()=>window.badmintonLibraryToggleFollow({id:"98-900004",name:"Delta Test"}));
 expect(result.ok).toBe(true);
 expect(await order()).toEqual(["98-900003","98-900001","98-900002","98-900004"]);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(stored.players).toEqual([own]);
 expect(stored.friends.map(p=>p.id)).toEqual(await order());
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

test("v222: team order, reset and minus work on primary cards without changing family storage",async({page})=>{
 await page.addInitScript(({own,teamKeys})=>{
  if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[own],friends:[],officialLinks:[],activeProfileId:own.id,chosen:own.id,historyProfilesInitialized:true
  }));
  if(!localStorage.getItem("schmetterlinge-followed-teams-v1"))
   localStorage.setItem("schmetterlinge-followed-teams-v1",JSON.stringify(teamKeys));
 },{own,teamKeys});
 await page.setViewportSize({width:320,height:720});
 await page.goto("/#mannschaft",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await expect(page.locator("#team-manage-details")).toHaveCount(0);
 const order=()=>page.locator('#team-followed [data-team-move][data-direction="-1"]')
  .evaluateAll(buttons=>buttons.map(button=>button.dataset.teamMove));
 await expect(page.locator('#team-followed [data-team-move][data-direction="-1"]')).toHaveCount(3);
 expect(await order()).toEqual(teamKeys);
 const moved=page.locator('[data-team-move="nuliga:999999:2"][data-direction="-1"]');
 await moved.click();
 await expect(moved).toBeFocused();
 expect(await order()).toEqual(["nuliga:999999:3","nuliga:999999:2","nuliga:999999:1"]);
 await moved.click(); // Boundary fallback must retain a visible action.
 await expect(page.locator('[data-team-move="nuliga:999999:2"][data-direction="1"]')).toBeFocused();
 expect(await order()).toEqual(["nuliga:999999:2","nuliga:999999:3","nuliga:999999:1"]);
 await page.locator("#team-order-reset").click();
 await expect(page.locator("#team-order-reset")).toBeFocused();
 expect(await order()).toEqual(["nuliga:999999:1","nuliga:999999:2","nuliga:999999:3"]);
 await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 expect(await order()).toEqual(["nuliga:999999:1","nuliga:999999:2","nuliga:999999:3"]);
 await page.locator('#team-followed [data-team-toggle="nuliga:999999:2"]').click();
 await expect(page.locator('#team-followed [data-team-toggle="nuliga:999999:2"]')).toHaveCount(0);
 expect(await order()).toEqual(["nuliga:999999:1","nuliga:999999:3"]);
 const saved=await page.evaluate(()=>({
  teams:JSON.parse(localStorage.getItem("schmetterlinge-followed-teams-v1")),
  profile:JSON.parse(localStorage.getItem("shuttleboard-v1"))
 }));
 expect(saved.teams).toEqual(["nuliga:999999:1","nuliga:999999:3"]);
 expect(saved.profile.players).toEqual([own]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
});

for(const size of [0,1,5,20]){
 test("v217: "+size+" followed player rows keep local order",async({page})=>{
  const friends=Array.from({length:size},(_,i)=>({
   id:"98-"+String(900100+i).padStart(6,"0"),name:"Synthetischer Spieler "+String(i).padStart(2,"0")
  }));
  await page.addInitScript(({friends})=>{
   if(!localStorage.getItem("shuttleboard-v1"))localStorage.setItem("shuttleboard-v1",JSON.stringify({
    players:[{id:"99-900010",name:"Eigenes Testprofil"}],friends,officialLinks:[],
    activeProfileId:"99-900010",chosen:"99-900010",historyProfilesInitialized:true
   }));
  },{friends});
  await page.setViewportSize({width:size%2?390:320,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
  const rows=page.locator("#friend-list [data-follow-row]");
  await expect(rows).toHaveCount(size);
  await expect(page.locator("#friend-manage-details")).toHaveCount(0);
  if(size>1){
   const id=friends[size-1].id;
   await page.locator('[data-friend-grip="'+id+'"]').focus();
   await page.keyboard.press("ArrowUp");
   await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
   const ids=await rows.evaluateAll(nodes=>nodes.map(el=>el.dataset.followRow));
   expect(ids.at(-2)).toBe(id);
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
   expect(saved.friends.map(p=>p.id)).toEqual(ids);
   expect(saved.players).toHaveLength(1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
 test("v222: "+size+" followed teams keep inline buttons and persisted order",async({page})=>{
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
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
  await expect(page.locator("#team-manage-details")).toHaveCount(0);
  const arrows=page.locator('#team-followed [data-team-move][data-direction="-1"]');
  await expect(arrows).toHaveCount(size);
  if(size>1){
   const id=teams[size-1];
   await page.locator('[data-team-move="'+id+'"][data-direction="-1"]').click();
   await page.reload({waitUntil:"domcontentloaded"});
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
   const ordered=await arrows.evaluateAll(nodes=>nodes.map(el=>el.dataset.teamMove));
   expect(ordered.at(-2)).toBe(id);
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("schmetterlinge-followed-teams-v1")));
   expect(stored).toEqual(ordered);
  }else{
   await expect(page.locator("#team-order-reset")).toBeDisabled();
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
