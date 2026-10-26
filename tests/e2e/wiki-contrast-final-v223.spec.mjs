import {test,expect} from "./supabase-isolated.fixture.mjs";

// Anonymous, local-only Wiki. The shared fixture blocks productive Supabase and third-party requests.
// Contrast is measured from computed browser styles, not from the CSS declaration alone.
function luminance(color){
 const value=String(color).trim();
 let rgb;
 if(/^#[0-9a-f]{6}$/i.test(value))rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
 else {
  const parts=value.match(/[0-9.]+/g);
  if(!parts||parts.length<3)throw Error("Unexpected color: "+value);
  rgb=parts.slice(0,3).map(Number);
 }
 return rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
  .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function contrast(foreground,background){
 const a=luminance(foreground),b=luminance(background);
 return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

for(const width of [320,390,1280]){
 test("Wiki v223: real small text passes AA in catalogue and dialog at "+width+"px",async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto("/wiki.html");
  await expect(page.locator(".wiki-entry")).toHaveCount(61);
  const pale=await page.evaluate(()=>{
   const css=selector=>{
    const el=document.querySelector(selector);
    if(!el)throw Error("Wiki selector missing: "+selector);
    return getComputedStyle(el).color;
   };
   return {
    eyebrow:css(".intro .eyebrow"),
    introduction:css(".intro p"),
    count:css(".result-head span"),
    category:css(".entry-copy small"),
    title:css(".entry-copy strong"),
    footer:css(".wiki-footer"),
    brand:css(".wiki-brand small")
   };
  });
  // The brightest stop of the actual pale-blue page gradient is the strictest background.
  for(const key of ["eyebrow","introduction","count","footer","brand"])
   expect(contrast(pale[key],"#e6f4ff"),key+" on pale background").toBeGreaterThanOrEqual(4.5);
  for(const key of ["category","title"])
   expect(contrast(pale[key],"#ffffff"),key+" on white card").toBeGreaterThanOrEqual(4.5);
  await page.locator(".wiki-entry").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const detail=await page.evaluate(()=>{
   const css=selector=>getComputedStyle(document.querySelector(selector)).color;
   return {
    category:css(".detail-top"),
    scope:css(".detail-bottom"),
    position:css("#wiki-card-position"),
    source:css("#detail-source")
   };
  });
  for(const [key,color] of Object.entries(detail))
   expect(contrast(color,"#ffffff"),key+" on white dialog").toBeGreaterThanOrEqual(4.5);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
 });
}
