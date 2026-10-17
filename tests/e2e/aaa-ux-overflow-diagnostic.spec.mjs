import {test,expect} from "./invited-member.fixture.mjs";
test("diagnose narrow WebKit overflow without exposing personal data",async({page})=>{
 await page.setViewportSize({width:320,height:720});
 await page.goto("/#turniere",{waitUntil:"domcontentloaded"});
 await expect(page.locator("#view-turniere")).toBeVisible();
 const info=await page.evaluate(()=>{
  const max=innerWidth;
  const overflow=document.documentElement.scrollWidth-max;
  const nodes=[...document.querySelectorAll("body *")].filter(el=>{
   const rect=el.getBoundingClientRect(),cs=getComputedStyle(el);
   return cs.display!=="none"&&cs.visibility!=="hidden"&&rect.width>0&&rect.right>max+2;
  }).slice(0,18).map(el=>{
   const r=el.getBoundingClientRect();
   return {tag:el.tagName,id:el.id,cls:String(el.className).slice(0,90),
    left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
  });
  return {max,overflow,nodes};
 });
 console.log("U6_WEBKIT_OVERFLOW_DIAGNOSTIC",JSON.stringify(info));
 expect(info.overflow,JSON.stringify(info.nodes)).toBeLessThanOrEqual(2);
});
