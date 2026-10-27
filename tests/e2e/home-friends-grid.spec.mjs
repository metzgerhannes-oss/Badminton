import {test,expect} from "./invited-member.fixture.mjs";

const OWN={id:"99-900001",name:"Startprofil",club:"Testverein",birthYear:2016};
const FRIENDS=Array.from({length:9},(_,i)=>({
 id:"99-"+String(910000+i),name:"Freund "+String.fromCharCode(65+i),club:"Testverein"
}));
async function seed(page,friends=FRIENDS){
 await page.addInitScript(({own,friends})=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[own],friends,officialLinks:[],activeProfileId:own.id,chosen:own.id,
  historyProfilesInitialized:true
 })),{own:OWN,friends});
}
test("Home previews three friends plus overflow, without horizontal clipping",async ({page})=>{
 await seed(page);
 await page.goto("/#start");
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(3);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toHaveText(/\+6 weitere/);
 await expect(page.locator("#dashboard-friends .friend-quick-name").first()).toHaveText("Freund");
 const layout=await page.locator("#dashboard-friends").evaluate(root=>{
  const cards=[...root.querySelectorAll(".friend-quick")];
  const rows=cards.map(x=>x.getBoundingClientRect());
  const outer=root.getBoundingClientRect(),style=getComputedStyle(root);
  return {
   columns:style.gridTemplateColumns.split(" ").length,
   horizontallyScrollable:root.scrollWidth>root.clientWidth+2,
   inside:rows.every(r=>r.left>=outer.left-1&&r.right<=outer.right+1),
   twoColumnsSameRow:Math.abs(rows[0].top-rows[1].top)<2,
   secondRow:rows[2].top>rows[0].top+10,
   fullWidth:document.documentElement.scrollWidth<=window.innerWidth+2
  };
 });
 expect(layout).toEqual({
  columns:2,horizontallyScrollable:false,inside:true,
  twoColumnsSameRow:true,secondRow:true,fullWidth:true
 });
 await page.locator(".friend-quick-more").click();
 await expect(page).toHaveURL(/#spieler$/);
 await expect(page.locator("#friend-list .friend-follow-item")).toHaveCount(9);
 await expect(page.locator("#dashboard-friends-manage")).toHaveText("Alle anzeigen");
});

test("current followed profile remains visible among Home shortcuts; Home returns to own",async ({page})=>{
 await seed(page);
 await page.goto("/#start");
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await page.evaluate(id=>window.badmintonSelectViewer(id),FRIENDS[8].id);
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(3);
 await expect(page.locator("#dashboard-friends .friend-quick.is-current")).toHaveCount(1);
 await expect(page.locator("#dashboard-friends .friend-quick.is-current")).toHaveAttribute(
  "data-friend-quick",FRIENDS[8].id);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toHaveText(/\+7 weitere/);
 await page.locator("#dashboard-friends [data-is-own='true']").click();
 await expect(page.locator(".focused-profile")).toContainText("Startprofil");
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(3);
 await expect(page.locator("#dashboard-friends .friend-quick.is-current")).toHaveCount(0);
});

test("a single followed player remains directly accessible",async ({page})=>{
 await seed(page,FRIENDS.slice(0,1));
 await page.goto("/#start");
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(1);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toHaveCount(0);
 await page.locator("#dashboard-friends [data-friend-quick]").click();
 await expect(page.locator(".focused-profile")).toContainText("Freund A");
});

test("empty friends offers one search entry point",async ({page})=>{
 await seed(page,[]);
 await page.goto("/#start");
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await expect(page.locator("#dashboard-add-friend")).toBeVisible();
 await expect(page.locator("#dashboard-friends")).toContainText("Noch keine Freunde");
 await expect(page.locator("#dashboard-friends-manage")).toBeHidden();
 await expect(page.locator(".friend-quick-more")).toHaveCount(0);
});


test("a followed player with the same DBV ID as an own profile keeps the Follow link",async ({page})=>{
 const friend={id:OWN.id,name:"Gefolgtes Testprofil",club:"Testverein",
  url:"https://dbv.turnier.de/player/99-900001"};
 await seed(page,[friend]);
 await page.goto("/#start");
 await expect(page.locator("html")).toHaveAttribute("data-app-access","granted");
 await page.locator("#dashboard-friends [data-friend-quick]").click();
 await expect(page.locator("#dashboard-next a.kpi-wide")).toHaveAttribute("href",friend.url);
 const state=await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")));
 expect(state.players).toHaveLength(1);
 expect(state.friends).toHaveLength(1);
 expect(state.activeProfileId).toBe(OWN.id);
});
