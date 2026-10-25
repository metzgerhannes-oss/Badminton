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

for(const width of [390,1280]){
 test("v189 "+width+"px: card headings and helper copy contrast with actual CSS backgrounds",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#einstellungen",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#settings-room-hub")).toBeVisible();
  // Synthetic, static DOM only: no user profiles or live reports requested.
  const samples=await page.evaluate(()=>{
   const cards=[
    ["#view-einstellungen","settings-card"],
    ["#view-berichte","report-card"],
    ["#view-spieler","profile-card"],
    ...(innerWidth>=1080?[["#view-historie","ranking-tile"]]:[])
   ];
   return cards.map(([host,card])=>{
    const el=document.createElement("article");
    el.className=card;
    const heading=document.createElement("h3");
    heading.textContent="Kontrastprüfung";
    const note=document.createElement("p");
    note.className="muted";
    note.textContent="Synthetischer Hilfetext";
    el.append(heading,note);
    const parent=document.querySelector(host);
    if(!parent)throw Error("Missing fixture host "+host);
    parent.append(el);
    const background=getComputedStyle(el).backgroundColor;
    return {card,background,heading:getComputedStyle(heading).color,
      note:getComputedStyle(note).color};
   });
  });
  for(const sample of samples){
   expect(ratio(sample.heading,sample.background),sample.card+" heading").toBeGreaterThanOrEqual(4.5);
   expect(ratio(sample.note,sample.background),sample.card+" helper text").toBeGreaterThanOrEqual(4.5);
  }
 });
}

/* UX2 B1: assert final computed colors (not CSS token declarations), including
   navigation at 320px and optional local club accent. No external requests. */
for(const width of [320,390]){
 test("v211 "+width+"px: four main tab labels meet AA and stay readable",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const nav=await page.locator(".bottom-nav").evaluate(root=>{
   const background=getComputedStyle(root).backgroundColor;
   const anchors=[...root.querySelectorAll('a[data-page]:not(.desktop-club-nav)')];
   return {background,items:anchors.map(link=>{
    const style=getComputedStyle(link),small=getComputedStyle(link.querySelector("small"));
    return {name:link.dataset.page,color:small.color,size:parseFloat(small.fontSize),
     height:link.getBoundingClientRect().height,linkColor:style.color};
   })};
  });
  expect(nav.items.map(x=>x.name)).toEqual(["start","spieler","turniere","mannschaft"]);
  for(const item of nav.items){
   expect(ratio(item.color,nav.background),item.name+" "+width+"px effective label contrast").toBeGreaterThanOrEqual(4.5);
   expect(item.size,item.name+" "+width+"px label size").toBeGreaterThanOrEqual(12);
   expect(item.height,item.name+" "+width+"px touch height").toBeGreaterThanOrEqual(44);
  }
  await page.locator('.bottom-nav a[data-page="spieler"]').click();
  await expect(page.locator("#view-spieler")).toBeVisible();
  await expect(page.locator('.bottom-nav a[data-page="spieler"]')).toHaveAttribute("aria-current","page");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
test("v211: source link ink meets AA on actual light report card",async({page})=>{
 await page.goto("/#berichte",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-berichte")).toBeVisible();
 const sample=await page.locator("#view-berichte").evaluate(root=>{
  const card=document.createElement("article");
  card.className="report-card";
  const foot=document.createElement("div");
  foot.className="report-card-footer";
  const link=document.createElement("a");
  link.href="#berichte";link.textContent="Synthetischer Bericht";
  foot.append(link);card.append(foot);root.append(card);
  return {color:getComputedStyle(link).color,background:getComputedStyle(card).backgroundColor};
 });
 expect(ratio(sample.color,sample.background),"Report link on actual card").toBeGreaterThanOrEqual(4.5);
});
test("v211: local club accent remains authoritative on selected mobile tab",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto("/#start",{waitUntil:"domcontentloaded"});
 const actual=await page.locator('.bottom-nav a[data-page="start"]').evaluate(el=>{
  document.documentElement.classList.add("club-themed");
  document.documentElement.style.setProperty("--club-accent","#164b78");
  document.documentElement.style.setProperty("--club-contrast","#ffffff");
  return {color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor};
 });
 expect(ratio(actual.color,actual.background),"Branded selected tab").toBeGreaterThanOrEqual(4.5);
});
