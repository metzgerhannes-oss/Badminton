# Appstart – vorbereitender Browserbenchmark nach v246

Ausgang: privat veröffentlichtes v246, Produktionsbranch `fix/p0-417-private-member-reads-20261027`, Issue #451. Dieser Branch **ändert keine produktive Oberfläche** und kann nicht als erfolgreiche Performance-Optimierung gelten.

## Reproduzieren

```sh
npm ci
npx playwright install chromium webkit
npx playwright test --config benchmarks/playwright.config.mjs
```

Der Benchmark startet den lokalen HTTP-Server aus der existierenden Playwright-Konfiguration. Je Browserprojekt (mobiles Chromium, mobiles WebKit) misst er **5 isolierte Kalt-Navigationen** und **5 erneute Navigationen im selben Kontext**. Er erfasst bedienbaren Zustand nach synthetisch bestätigter Mitgliedschaft, Zugangsfreigabe, DOMContentLoaded, FCP/LCP sofern unterstützt, Ressourcenzahl, Transfergrößen und Long Tasks sofern verfügbar. JSON-Attachments und eine kurze Median-Zeile werden an den Testreport gehängt. **Keine Zielzeit wird künstlich erzwungen.**

Alle Supabase-Zugriffe werden abgefangen; ein simulierter `app_access_status` antwortet positiv, andere Endpunkte mit 401. Ausgehende Anfragen zu weiteren Domains werden blockiert. Es werden weder echte Konten, Access-Tokens, Geräteprofile noch API-Daten genutzt.

**Grenzen:** Kein echter Cloudflare-Login, keine installierte PWA, kein physisches iPhone. Die Messwerte sind CI-/Laborwerte und dürfen nicht als solche ausgegeben werden. Ein separater sicherer PWA- und Produktionsnachweis ist AP1/AP6 von Issue #451.

## Nächster Schritt

Baseline mindestens auf Chromium und WebKit durchführen und mit dokumentierter Umgebung am selben Runner vor/nach Optimierungen vergleichen. Erst anschließend AP2–AP6 bearbeiten und die private Release-Abnahme nach der eigenständigen, belegten Alle-Freunde-Funktion beginnen. Keine vorgezogene Veröffentlichung.
