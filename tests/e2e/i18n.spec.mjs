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

test("bundled language catalog remains usable during a Cloudflare outage without a CDN request", async ({page}) => {
  let intercepted = 0;
  await page.route("https://schmetterlinge-language-packs.pages.dev/**", route => {
    intercepted += 1;
    return route.abort("failed");
  });
  await page.goto("/welcome.html");
  await page.locator("#welcome-language").selectOption("it");
  await expect(page.locator('label[for="welcome-language"]')).toHaveText("Lingua");
  await expect(page.locator("html")).toHaveAttribute("lang","it");
  expect(intercepted).toBe(0); // Bundled language files are served immediately, even offline.
});


test("Chinese profile-first onboarding is fully localized, including installation", async ({page}) => {
  await page.goto("/welcome.html");
  await page.locator("#welcome-language").selectOption("zh-Hans");
  await expect(page.locator("html")).toHaveAttribute("lang","zh-Hans");
  await expect(page.locator(".welcome-steps")).toContainText("第 1 步");
  await expect(page.locator("#onboard-profile > p").first()).toHaveText(
    "在公开的 DBV 球员名录中搜索。根据俱乐部、出生年份和 DBV 编号选择正确的球员。");
  await expect(page.locator("#onboard-profile")).not.toContainText("Finde deinen Spieler");
  await expect(page.locator("#welcome-search-status")).toHaveText("至少输入两个字符以搜索球员。");
  await page.locator("#welcome-manual-panel summary").click();
  await expect(page.locator("#mode-own")).toContainText("创建球员档案");
  await expect(page.locator("#welcome-manual-panel")).toContainText("关联 DBV 编号后");
  await page.goto("/welcome.html#installation");
  await expect(page.locator("#install-title")).toHaveText("像应用一样打开 Schmetterlinge");
  await expect(page.locator("#onboard-install > p").first()).toContainText("无需通过应用商店安装");
  await expect(page.locator("#install-ios-steps")).toContainText("在 Safari 中打开");
  await page.locator("#install-android").click();
  await expect(page.locator("#install-android-steps")).toContainText("在 Google Chrome 中打开");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.locator("#welcome-language").selectOption("en");
  await expect(page.locator("#onboard-install > p").first()).toContainText("No app store required");
  await expect(page.locator("#install-android-steps")).toContainText("Open the page in Google Chrome");
});

test("Asynchronous search status follows switching from Chinese to French to German", async ({page}) => {
  await page.goto("/welcome.html");
  await page.locator("#welcome-player-search").fill("x");
  await page.locator("#welcome-language").selectOption("zh-Hans");
  await expect(page.locator("#welcome-search-status")).toHaveText("至少输入两个字符以搜索球员。");
  await page.locator("#welcome-language").selectOption("fr");
  await expect(page.locator("#welcome-search-status")).toHaveText(
    "Saisissez au moins deux caractères pour trouver des joueurs.");
  await page.locator("#welcome-language").selectOption("de");
  await expect(page.locator("#welcome-search-status")).toHaveText(
    "Mindestens zwei Zeichen eingeben, um Spieler zu finden.");
});
