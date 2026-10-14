import {test,expect} from "@playwright/test";
test("Wiki: three topics and anonymous mobile search",async({page})=>{
 await page.goto("/wiki.html");
 await expect(page.getByRole("heading",{name:"Schnell erklärt."})).toBeVisible();
 for(const name of ["Grundregeln","Spielsituationen","Jugend & Turniere"]){
  await expect(page.getByRole("button",{name,exact:true})).toBeVisible();
 }
 await page.getByRole("searchbox").fill("Small Games");
 await expect(page.getByRole("button",{name:/Was sind Small Games/})).toBeVisible();
 await page.getByRole("button",{name:/Was sind Small Games/}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await expect(page.getByRole("link",{name:/Offizielle Quelle/})).toHaveAttribute("href",/bwbv\.de/);
 await page.getByRole("button",{name:"Regel schließen"}).click();
 await expect(page.getByRole("dialog")).toBeHidden();
});
test("Wiki: basic rule, service fault and local search",async({page})=>{
 await page.goto("/wiki.html");
 await page.getByRole("searchbox").fill("Netzberührung");
 await expect(page.getByRole("button",{name:/Ist die Netzberührung ein Fehler/})).toBeVisible();
 await page.getByRole("searchbox").fill("Doppel");
 await expect(page.getByRole("button",{name:/Wer schlägt im Doppel nach eigenem Punkt auf/})).toBeVisible();
 await page.getByRole("searchbox").fill("Ranglistenpunkte");
 await expect(page.getByRole("button",{name:/Wie entstehen Ranglistenpunkte/})).toBeVisible();
});
test("Wiki: all three groups accessible on smallest phone without horizontal overflow",async({page})=>{
 await page.setViewportSize({width:320,height:568});
 await page.goto("/wiki.html");
 for (const group of ["Grundregeln","Spielsituationen","Jugend & Turniere"]) {
  await page.getByRole("button",{name:group,exact:true}).click();
  await expect(page.locator(".wiki-entry").first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  expect(overflow).toBe(false);
 }
 await page.locator(".wiki-entry").first().click();
 await expect(page.locator("#detail-art svg")).toBeVisible();
});

test("Wiki: Small Games and score changes use specific illustrations",async({page})=>{
 await page.goto("/wiki.html");
 await page.getByRole("searchbox").fill("Box");
 await page.getByRole("button",{name:/Was bedeutet Einzel „Box“/}).click();
 await expect(page.locator("#detail-art[data-kind='smallbox'] svg")).toBeVisible();
 await page.getByRole("button",{name:"Regel schließen"}).click();
 await page.getByRole("searchbox").fill("2027");
 await page.getByRole("button",{name:/Gilt ab 2027 überall/}).click();
 await expect(page.locator("#detail-answer")).toContainText("4. Januar 2027");
});
