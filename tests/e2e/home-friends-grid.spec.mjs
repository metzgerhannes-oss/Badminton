import {test,expect} from "./invited-member.fixture.mjs";

const OWN={id:"05-070879",name:"Startprofil",club:"SpVgg. Mössingen",birthYear:2016};
const FRIENDS=["Sarah Storz","Vinzent Ott","Benjamin Belser","Anna Beispiel",
 "Laura Beispiel","Nina Beispiel","Julian Muster","Emma Muster","Theo Muster"]
 .map((name,i)=>({id:"05-"+String(61000+i).padStart(6,"0"),name,club:"SpVgg. Mössingen"}));
async function seed(page,friends=FRIENDS){
 await page.addInitScript(({own,friends})=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
  players:[own],friends,officialLinks:[],activeProfileId:own.id,chosen:own.id,
  historyProfilesInitialized:true
 })),{own:OWN,friends});
}
test("Home previews three friends plus overflow, without horizontal clipping",async ({page})=>{
 await seed(page);
 await page.goto("/#start");
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(3);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toHaveText(/\+6 weitere/);
 await expect(page.locator("#dashboard-friends .friend-quick-name").first()).toHaveText("Sarah");
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
});

test("current followed profile remains visible among Home shortcuts; Home returns to own",async ({page})=>{
 await seed(page);
 await page.goto("/#start");
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
 await expect(page.locator("#dashboard-friends .friend-quick")).toHaveCount(1);
 await expect(page.locator("#dashboard-friends .friend-quick-more")).toHaveCount(0);
 await page.locator("#dashboard-friends [data-friend-quick]").click();
 await expect(page.locator(".focused-profile")).toContainText("Sarah Storz");
});

test("empty friends offers one search entry point",async ({page})=>{
 await seed(page,[]);
 await page.goto("/#start");
 await expect(page.locator("#dashboard-friends .friend-quick-add")).toHaveCount(1);
 await expect(page.locator("#dashboard-friends-manage")).toBeHidden();
 await expect(page.locator(".friend-quick-more")).toHaveCount(0);
});
