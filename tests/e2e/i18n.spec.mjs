import {test, expect} from "@playwright/test";

test("language switch works on invitation page and persists across reload", async ({page}) => {
  await page.goto("/welcome.html");
  const chooser=page.locator("#welcome-language");
  await chooser.selectOption("tr");
  await expect(page.locator("#welcome-search-heading")).toHaveText("Oyuncu ara");
  await expect(page.locator("html")).toHaveAttribute("lang","tr");
  await page.reload();
  await expect(chooser).toHaveValue("tr");
  await expect(page.locator("#welcome-search-heading")).toHaveText("Oyuncu ara");
});

test("Arabic uses right-to-left, and German restores left-to-right", async ({page}) => {
  await page.goto("/welcome.html");
  await page.locator("#welcome-language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir","rtl");
  await expect(page.locator("#welcome-search-heading")).toHaveText("ابحث عن لاعبين");
  await page.locator("#welcome-language").selectOption("de");
  await expect(page.locator("html")).toHaveAttribute("dir","ltr");
  await expect(page.locator("#welcome-search-heading")).toHaveText("Spieler suchen");
});

test("app and welcome page share the same setting without touching player storage", async ({page}) => {
  await page.goto("/welcome.html");
  await page.locator("#welcome-language").selectOption("pl");
  await expect(page.locator("#welcome-search-heading")).toHaveText("Szukaj zawodników");
  await page.goto("/#einstellungen");
  await expect(page.locator("#app-language")).toHaveValue("pl");
  await expect(page.locator("#heading-einstellungen")).toHaveText("Ustawienia");
  const original = await page.evaluate(() => Object.keys(localStorage).filter(k=>k.includes("schmetterlinge")));
  expect(original).toContain("schmetterlinge.uiLanguage");
});

test("all eleven locales load and translate the selector heading", async ({page}) => {
  await page.goto("/welcome.html");
  const cases = [
    ["de","Sprache"],["en","Language"],["fr","Langue"],["uk","Мова"],
    ["ru","Язык"],["zh-Hans","语言"],["tr","Dil"],["ar","اللغة"],
    ["it","Lingua"],["es","Idioma"],["pl","Język"]
  ];
  for (const [lang,label] of cases) {
    await page.locator("#welcome-language").selectOption(lang);
    await expect(page.locator('label[for="welcome-language"]')).toHaveText(label);
    await expect(page.locator("html")).toHaveAttribute("lang",lang);
  }
});

test("Cloudflare CDN outage falls back to bundled offline-ready catalog", async ({page}) => {
  let intercepted = 0;
  await page.route("https://schmetterlinge-language-packs.pages.dev/**", route => {
    intercepted += 1;
    return route.abort("failed");
  });
  await page.goto("/welcome.html");
  await page.locator("#welcome-language").selectOption("it");
  await expect(page.locator('label[for="welcome-language"]')).toHaveText("Lingua");
  await expect(page.locator("html")).toHaveAttribute("lang","it");
  expect(intercepted).toBeGreaterThan(0);
});
