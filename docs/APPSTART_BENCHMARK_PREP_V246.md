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


## Gemessene Baseline – GitHub Actions 07.11.2026

Run: [Appstart-Baseline #42350456338](https://github.com/metzgerhannes-oss/Badminton/actions/runs/42350456338), Commit `e48fb1b3eb386fa532970a711ae03fbbbb7c3796`. Beide Browserjobs erfolgreich. Ubuntu-GitHub-Runner, Playwright-Container `mcr.microsoft.com/playwright:v1.56.1-noble`, Node 22, lokaler Python-Webserver, Browser-Profile aus `playwright.config.mjs`; 5 unabhängige Kontexte (kalt), jeweils eine neue Navigation im selben Kontext (warm). Die zweite Navigation wurde ausdrücklich mit `page.reload()` erzwungen (kein bloßer Hashwechsel). Mediane aus fünf tatsächlichen Tests je Zustand/Browser:

| Metrik | Chromium mobil kalt | Chromium mobil warm | WebKit mobil kalt | WebKit mobil warm |
|---|---:|---:|---:|---:|
| Erstes interaktives Frame nach synthetischer Serverfreigabe, ms | 213,7 | 187,0 | 477,0 | 350,0 |
| App-Zugangsfreigabe, ms | 193,2 | 171,4 | 261,0 | 310,0 |
| DOMContentLoaded, ms | 191,4 | 189,4 | 342,0 | 309,0 |
| FCP, ms | 144 | 128 | 355 | 337 |
| LCP, ms | 148 | 140 | nicht verfügbar | nicht verfügbar |
| Initiale Ressourcen, Anzahl | 121 | 121 | 127 | 127 |
| Summe gemeldete Transfergrößen, Bytes | 1.184.871 | 1.184.871 | 1.185.951 | 1.185.951 |

**Interpretation:** Dies ist eine reproduzierbare, aber bewusst isolierte _Labor-Baseline_ für den internen Browser-Aufbau. Sie belegt weder einen realen Cloudflare-Access-Start noch die Wartezeit auf den echten Supabase-/DBV-Dienst, einen iPhone-Start, ein mobiles Netz oder eine installierte PWA. Ein positiver synthetischer Auth-Status wird sofort geliefert; die 800-ms-Startintro-Verzögerung ist im Test wegen `reducedMotion: reduce` teilweise deaktiviert. Die Warm-/Kalt-Transfergrößen sind hier identisch, da der lokale Python-Server ohne optimierte Cache-Control-Header ausliefert. Diese Messwerte dürfen NICHT als tatsächliche Nutzerstartzeit oder erfüllte 1,5-/3,0-s-Produktionsziele bezeichnet werden.

**Nächste AP1-Prüfung:** App-Start mit zugelassenem Cloudflare-Access-Rückweg und erstem sichtbaren Appinhalt unter realistischen Netzbedingungen separat und datenschutzkonform messen; installierte PWA und WebKit unabhängig prüfen. Für AP2–AP6 sind Messungen derselben Labor-Konfiguration als Vorher-/Nachher-Vergleich geeignet.
