import {test,expect} from "./invited-member.fixture.mjs";

// #332: The canonical follow editor was rendered with white text on white
// cards on desktop. Synthetic DOM, computed browser colors, no live Supabase.
function contrast(foreground,background){
 const channels=value=>String(value).match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{
  const s=v/255;
  return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;
 });
 const lum=value=>channels(value).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
 const [a,b]=[lum(foreground),lum(background)].sort((x,y)=>y-x);
 return (a+0.05)/(b+0.05);
}
for(const [view,hash,details,list] of [
 ["Mannschaften","#mannschaft","team-manage-details","team-settings-list"]
]){
 for(const width of [390,1280,1440,1920]){
  test(`#332: ${view} sorting has readable text and buttons at ${width}px`,async({page})=>{
   // This checks existing users' sort controls, not the empty first-run dialog.
   // Keep synthetic family data local; the fixture blocks all real Supabase.
   await page.addInitScript(()=>{
    localStorage.setItem("shuttleboard-v1",JSON.stringify({
     players:[{id:"99-700001",name:"Lokales Testprofil",birthYear:2014}],
     activeProfileId:"99-700001",chosen:"99-700001",
     friends:[{id:"98-700002",name:"Gefolgter Testspieler"}],
     officialLinks:[],historyProfilesInitialized:true
    }));
   });
   await page.setViewportSize({width,height:900});
   await page.goto("/"+hash,{waitUntil:"domcontentloaded"});
   await expect(page.locator("#app-access-gate")).toBeHidden();
   await expect(page.locator("#"+details)).toBeVisible();
   await page.locator("#"+details+" summary").click();
   const root=page.locator("#"+list);
   await root.evaluate(node=>{
    node.innerHTML='<article class="follow-manage-item">'+
      '<div class="follow-manage-label"><strong>SpVgg Mössingen Testmannschaft I</strong>'+
      '<small>Landesliga · 2026/27</small></div>'+
      '<div class="follow-manage-actions"><button type="button">↑</button>'+
      '<button type="button">↓</button>'+
      '<button type="button">Entfolgen</button></div></article>';
   });
   const colors=await root.locator(".follow-manage-item").evaluate(card=>{
    const style=e=>getComputedStyle(e);
    const label=card.querySelector("strong");
    const secondary=card.querySelector("small");
    const action=card.querySelector("button");
    const buttonBounds=action.getBoundingClientRect();
    return {
     card:style(card).backgroundColor,
     name:style(label).color,
     meta:style(secondary).color,
     button:style(action).color,
     buttonBackground:style(action).backgroundColor,
     nameSize:parseFloat(style(label).fontSize),
     metaSize:parseFloat(style(secondary).fontSize),
     buttonWidth:buttonBounds.width,
     buttonHeight:buttonBounds.height,
     overflow:document.documentElement.scrollWidth-innerWidth
    };
   });
   expect(contrast(colors.name,colors.card),"name contrast").toBeGreaterThanOrEqual(4.5);
   expect(contrast(colors.meta,colors.card),"metadata contrast").toBeGreaterThanOrEqual(4.5);
   expect(contrast(colors.button,colors.buttonBackground),"button contrast").toBeGreaterThanOrEqual(4.5);
   expect(colors.buttonHeight).toBeGreaterThanOrEqual(44);
   expect(colors.buttonWidth).toBeGreaterThanOrEqual(44);
   expect(colors.overflow).toBeLessThanOrEqual(2);
   if(width>=1080){
    expect(colors.nameSize).toBeGreaterThanOrEqual(15);
    expect(colors.metaSize).toBeGreaterThanOrEqual(13);
   }
  });
 }
}

for(const width of [320,390,1280,1440]){
 test("#332/v217: inline player sort and unfollow buttons are legible "+width+"px",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("shuttleboard-v1",JSON.stringify({
   players:[{id:"99-700001",name:"Eigenes Testprofil"}],
   friends:[{id:"98-700002",name:"Gefolgter Testspieler",club:"Testverein"}],
   activeProfileId:"99-700001",chosen:"99-700001",officialLinks:[],historyProfilesInitialized:true
  })));
  await page.setViewportSize({width,height:844});
  await page.goto("/#spieler",{waitUntil:"domcontentloaded"});
  const row=page.locator('#friend-list [data-follow-row="98-700002"]');
  await expect(row).toBeVisible();
  const value=await row.evaluate(root=>{
   const grip=root.querySelector("[data-friend-grip]");
   const minus=root.querySelector("[data-unfollow-inline]");
   const style=e=>getComputedStyle(e),bounds=e=>e.getBoundingClientRect();
   return {
    controls:[grip,minus].map(el=>({
     color:style(el).color,background:style(el).backgroundColor,
     width:bounds(el).width,height:bounds(el).height
    })),
    overflow:document.documentElement.scrollWidth-innerWidth
   };
  });
  for(const control of value.controls){
   expect(control.width).toBeGreaterThanOrEqual(44);
   expect(control.height).toBeGreaterThanOrEqual(44);
   expect(contrast(control.color,control.background)).toBeGreaterThanOrEqual(4.5);
  }
  expect(value.overflow).toBeLessThanOrEqual(2);
 });
}
