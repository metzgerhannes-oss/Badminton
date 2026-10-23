import {test,expect} from "./invited-member.fixture.mjs";
// Synthetic on-device profile. Inherited fixture hard-blocks all unmocked Supabase requests.
const seed={players:[{id:"99-900001",name:"Synthetisches Kind",club:"Testverein"}],
 friends:[{id:"99-900002",name:"Synthetischer Freund"}],
 activeProfileId:"99-900001",chosen:"99-900001",officialLinks:[],historyProfilesInitialized:true};
const srgb=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const luminance=c=>{
 const rgb=String(c).match(/[\d.]+/g)?.slice(0,3).map(v=>srgb(Number(v)/255));
 if(!rgb||rgb.length!==3)throw Error("Expected opaque RGB color: "+c);
 return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
};
const ratio=(a,b)=>{
 const [lo,hi]=[luminance(a),luminance(b)].sort((x,y)=>x-y);
 return (hi+.05)/(lo+.05);
};
async function contrastOf(page,selector,{pseudo=null,parent=null}={}){
 return page.locator(selector).first().evaluate((el,{pseudo,parent})=>{
  const text=getComputedStyle(el,pseudo).color;
  const background=parent?getComputedStyle(el.closest(parent)).backgroundColor:
   getComputedStyle(el).backgroundColor;
  return {text,background};
 },{pseudo,parent});
}
test.beforeEach(async({page})=>{
 await page.addInitScript(value=>localStorage.setItem("shuttleboard-v1",JSON.stringify(value)),seed);
});
for(const width of [320,390,768,1280,1440,1920]){
 test("v189 "+width+"px: non-Home settings, own/friend dialog text and placeholders meet AA",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await expect(page.locator("#settings-room-hub")).toBeVisible();
  const room=await page.locator(".settings-room-link").first().evaluate(el=>{
   const text=getComputedStyle(el.querySelector(".settings-room-copy small")).color;
   const bg=getComputedStyle(el).backgroundColor;
   return {text,bg};
  });
  expect(ratio(room.text,room.bg)).toBeGreaterThanOrEqual(4.5);
  await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
  await page.locator("#add-player").click();
  await expect(page.locator("#player-dialog")).toBeVisible();
  const search=await page.locator("#own-player-search").evaluate(el=>({
   text:getComputedStyle(el,"::placeholder").color,bg:getComputedStyle(el).backgroundColor,
   size:Number.parseFloat(getComputedStyle(el).fontSize)
  }));
  expect(ratio(search.text,search.bg)).toBeGreaterThanOrEqual(4.5);
  expect(search.size).toBeGreaterThanOrEqual(16);
  await page.locator("#own-player-manual-fallback > summary").click();
  const form=await page.locator('#player-form input[name="name"]').evaluate(el=>({
   text:getComputedStyle(el,"::placeholder").color,bg:getComputedStyle(el).backgroundColor,
   size:Number.parseFloat(getComputedStyle(el).fontSize)
  }));
  expect(ratio(form.text,form.bg)).toBeGreaterThanOrEqual(4.5);
  expect(form.size).toBeGreaterThanOrEqual(16);
  await page.locator("#cancel-dialog").click();
  await page.evaluate(()=>window.openFriendForm());
  await expect(page.locator("#friend-dialog")).toBeVisible();
  const friend=await page.locator('#friend-form input[name="name"]').evaluate(el=>({
   text:getComputedStyle(el,"::placeholder").color,bg:getComputedStyle(el).backgroundColor
  }));
  expect(ratio(friend.text,friend.bg)).toBeGreaterThanOrEqual(4.5);
  await page.locator("#cancel-friend").click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("shuttleboard-v1")).players.length)).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
for(const width of [320,390,1280]){
 test("v189 "+width+"px: public Wiki and welcome page remain readable with full-size inputs",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/wiki.html",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#wiki-search")).toBeVisible();
  const input=await page.locator("#wiki-search").evaluate(el=>({
   text:getComputedStyle(el,"::placeholder").color,bg:getComputedStyle(el).backgroundColor,
   size:Number.parseFloat(getComputedStyle(el).fontSize)
  }));
  expect(ratio(input.text,input.bg)).toBeGreaterThanOrEqual(4.5);
  expect(input.size).toBeGreaterThanOrEqual(16);
  await page.goto("/welcome.html?from=app",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#welcome-player-search")).toBeVisible();
  const message=await page.locator("#welcome-search-status").evaluate(el=>({
   text:getComputedStyle(el).color,bg:getComputedStyle(el.closest(".welcome-search")).backgroundColor
  }));
  expect(ratio(message.text,message.bg)).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
test("v189: Home module palette stays under existing visual rules",async({page})=>{
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-start")).toBeVisible();
 await expect(page.locator(".focused-profile")).toBeVisible();
 const v=await page.locator(".focused-profile").evaluate(el=>{
  const style=getComputedStyle(el);
  return {background:style.backgroundImage,radius:style.borderTopLeftRadius};
 });
 expect(v.background).toContain("linear-gradient");
 expect(v.radius).toBe("16px");
});
