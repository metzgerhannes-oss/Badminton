import {test,expect} from "./invited-member.fixture.mjs";

// Synthetic data only; the fixture denies production Supabase requests.
// Use computed CSS and the known lightest stop of each gradient.
const seed={players:[{id:"99-900001",name:"Kind Muster",club:"Testverein"}],
 friends:[{id:"98-900002",name:"Gefolgter Spieler",club:"Testverein"}],
 activeProfileId:"99-900001",chosen:"99-900001",officialLinks:[],
 historyProfilesInitialized:true};
const hex=color=>{
 const text=String(color);
 if(/^#[0-9a-f]{6}$/i.test(text))
  return [1,3,5].map(i=>parseInt(text.slice(i,i+2),16)/255);
 const parts=text.match(/[\d.]+/g)?.slice(0,3).map(Number);
 if(!parts||parts.length!==3)throw Error("Unexpected RGB "+color);
 return parts.map(x=>Math.round(x)/255);
};
const lum=color=>hex(color).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
 .reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{
 const x=lum(a),y=lum(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
};
test.beforeEach(async({page})=>{
 await page.addInitScript(value=>localStorage.setItem("shuttleboard-v1",JSON.stringify(value)),seed);
});
for(const width of [320,375,390,420,768,1079,1080,1280,1440,1920]){
 test("Surface-aware Home: tournament title, metadata, status and player at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  // Don't fabricate a published tournament: only style a synthetic DOM row.
  const colors=await page.locator("#dashboard-next").evaluate(root=>{
   root.innerHTML='<section class="upcoming-tournaments-section">'+
    '<a class="upcoming-tournament-row" href="#turniere">'+
    '<span class="upcoming-tournament-date">22</span>'+
    '<span class="upcoming-tournament-info"><strong>U11-U19 Testturnier</strong>'+
    '<small>22. Nov · Testspieler</small>'+
    '<small class="upcoming-tournament-venue">Austragungsort: Teststadt</small>'+
    '<span class="upcoming-tournament-label">Vorgemerkt · keine Anmeldung</span></span></a></section>';
   const c=selector=>getComputedStyle(root.querySelector(selector)).color;
   return {
    title:c(".upcoming-tournament-info strong"),
    owner:c(".upcoming-tournament-info small"),
    venue:c(".upcoming-tournament-venue"),
    status:c(".upcoming-tournament-label"),
    date:c(".upcoming-tournament-date"),
    dateBg:getComputedStyle(root.querySelector(".upcoming-tournament-date")).backgroundColor,
    panelBg:getComputedStyle(root.querySelector(".upcoming-tournaments-section")).background,
    titleSize:parseFloat(getComputedStyle(root.querySelector(".upcoming-tournament-info strong")).fontSize),
    metaSize:parseFloat(getComputedStyle(root.querySelector(".upcoming-tournament-info small")).fontSize),
    overflow:document.documentElement.scrollWidth-innerWidth
   };
  });
  // At small widths the physical iPhone shows WHITE cards. Desktop has navy
  // cards. The old test assumed navy at every width and missed the P0 bug!
  const light=width<1080;
  if(light)
   expect(colors.panelBg,"iPhone must have a pale tournament card").toMatch(/rgb\(255, 255, 255\)|#fff/);
  else
   expect(colors.panelBg,"desktop must have a dark tournament card").toMatch(/rgb\(18, 46, 80\)|#122e50|rgb\(38, 87, 120\)/);
  const against=light?"#ffffff":"#265778";
  for(const key of ["title","owner","venue","status"])
   expect(ratio(colors[key],against),key+" must read on "+(light?"white mobile":"navy desktop")).toBeGreaterThanOrEqual(4.5);
  if(light){
   expect(colors.titleSize,"mobile tournament names").toBeGreaterThanOrEqual(14);
   expect(colors.metaSize,"mobile tournament details").toBeGreaterThanOrEqual(12);
  }
  expect(ratio(colors.date,colors.dateBg),"date badge").toBeGreaterThanOrEqual(4.5);
  expect(colors.overflow).toBeLessThanOrEqual(2);
  const profile=await page.locator("#focused-profile").evaluate(root=>{
   let node=root.querySelector(".focus-profile-meta");
   if(!node){
    const parent=root.querySelector(".focus-profile-copy");
    if(!parent)return null;
    node=document.createElement("span");
    node.className="focus-profile-meta";
    node.textContent="Kind · Testverein";
    parent.append(node);
   }
   return {color:getComputedStyle(node).color,
    size:parseFloat(getComputedStyle(node).fontSize),
    bg:getComputedStyle(root).background};
  });
  expect(profile?.color).toBeTruthy();
  // The screenshot's own-player header is pale on iPhone, but desktop can
  // intentionally use the navy club theme; test the correct actual surface.
  if(light){
   expect(profile.bg,"iPhone profile surface").toMatch(/rgb\(255, 255, 255\)|#fff/);
   expect(ratio(profile.color,"#ffffff"),"iPhone player metadata on white").toBeGreaterThanOrEqual(4.5);
   expect(profile.size,"mobile player details").toBeGreaterThanOrEqual(12);
  }else{
   expect(ratio(profile.color,"#2b5c82"),"desktop player metadata on navy").toBeGreaterThanOrEqual(4.5);
  }
 });
}
for(const width of [1080,1280,1440,1920]){
 test("Pale desktop friends: readable header and links at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/#start",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#view-start")).toBeVisible();
  const colors=await page.locator(".dashboard-friends-section").evaluate(section=>{
   const manage=section.querySelector(".dashboard-friends-manage");
   manage.hidden=false;
   const add=document.createElement("a");
   add.className="friend-quick-add";
   add.textContent="Spieler hinzufügen";
   section.querySelector("#dashboard-friends").append(add);
   const c=s=>getComputedStyle(section.querySelector(s)).color;
   return {
    bg:getComputedStyle(section).backgroundColor,
    heading:c("h2"),
    manage:c(".dashboard-friends-manage"),
    add:c(".friend-quick-add")
   };
  });
  for(const key of ["heading","manage","add"])
   expect(ratio(colors[key],colors.bg),key+" contrast on pale panel").toBeGreaterThanOrEqual(4.5);
 });
}
for(const width of [320,390,1280]){
 test("Pale followed-player cards: readable name and metadata at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  const card=page.locator("#friend-list .friend-follow-item").first();
  await expect(card).toBeVisible();
  const colors=await card.evaluate(node=>({
   bg:getComputedStyle(node).backgroundColor,
   name:getComputedStyle(node.querySelector(".friend-details strong")).color,
   meta:getComputedStyle(node.querySelector(".friend-details small")).color,
   overflow:document.documentElement.scrollWidth-innerWidth
  }));
  expect(ratio(colors.name,colors.bg),"player name").toBeGreaterThanOrEqual(4.5);
  expect(ratio(colors.meta,colors.bg),"player metadata").toBeGreaterThanOrEqual(4.5);
  expect(colors.overflow).toBeLessThanOrEqual(2);
 });
}
