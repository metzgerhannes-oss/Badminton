import {test,expect} from "./invited-member.fixture.mjs";

// Regression for the actual iPhone defect: dark active card inherited dark
// text; pale inactive card inherited pale club copy. Synthetic local profiles.
const seed={players:[
 {id:"99-100001",name:"Testprofil Eins",club:"Testverein A",birthYear:2016},
 {id:"99-100002",name:"Testprofil Zwei",club:"Testverein B",birthYear:2014}
],friends:[],activeProfileId:"99-100001",chosen:"99-100001",
 officialLinks:[],historyProfilesInitialized:true};
const srgb=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const lum=c=>{
 const rgb=String(c).match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(n=>srgb(Number(n)/255));
 if(!rgb||rgb.length!==3)throw Error("Unparsable color "+c);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
};
const ratio=(a,b)=>{
 const [lo,hi]=[lum(a),lum(b)].sort((a,b)=>a-b);
 return (hi+.05)/(lo+.05);
};
for(const width of [320,390,768,1280]){
 test("P0 player cards "+width+"px: active navy and inactive pale text meet AA",async({page})=>{
  await page.addInitScript(data=>localStorage.setItem("shuttleboard-v1",JSON.stringify(data)),seed);
  await page.setViewportSize({width,height:844});
  await page.goto("/#einstellungen/profile",{waitUntil:"domcontentloaded"});
  await expect(page.locator("#app-access-gate")).toBeHidden();
  await expect(page.locator("#profile-list .own-profile")).toHaveCount(2);
  await expect(page.locator("#settings-room-profile")).toBeVisible();
  const samples=await page.locator("#profile-list .own-profile").evaluateAll(cards=>cards.map(card=>{
   const style=getComputedStyle(card);
   const gradient=(style.backgroundImage.match(/rgba?\([^)]+\)/g)||[])
    .filter(x=>!x.includes("0, 0, 0, 0"));
   const surfaces=gradient.length?gradient:[style.backgroundColor];
   const selectors=[
    [".profile-main h3","name"],
    [".profile-main p","DBV and year"],
    [".profile-club","club"],
    ["[data-edit-own]","edit"],
    ["[data-remove-profile]","remove"],
    ["[data-share-player]","share"]
   ];
   if(card.classList.contains("profile-active"))
    selectors.push([".active-profile-chip","active badge"]);
   return {active:card.classList.contains("profile-active"),
    surfaces,
    fields:selectors.map(([selector,name])=>{
     const el=card.querySelector(selector);
     if(!el)throw Error("Missing "+selector);
     const cs=getComputedStyle(el);
     return {name,color:cs.color,
      backgrounds:cs.backgroundColor==="rgba(0, 0, 0, 0)"?
       surfaces:[cs.backgroundColor],height:el.getBoundingClientRect().height};
    })};
  }));
  expect(samples.map(x=>x.active)).toEqual([true,false]);
  for(const card of samples)for(const field of card.fields){
   for(const background of field.backgrounds){
    expect(ratio(field.color,background),
      (card.active?"active":"inactive")+" "+field.name+" "+width+"px on "+background)
     .toBeGreaterThanOrEqual(4.5);
   }
   if(["edit","remove","share"].includes(field.name))
    expect(field.height,field.name+" touch target height").toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(2);
 });
}
