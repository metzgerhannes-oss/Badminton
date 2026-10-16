# Teststandard Schmetterlinge – Supabase Free-Plan (ab v159)

## Verbindliche Regeln

1. **Jeder normale CI-Test läuft offline.** Node-/Python-Unit-Tests benutzen
   synthetische Fixtures und injizierte `fetch`-Mocks; Playwright benutzt
   `tests/e2e/supabase-isolated.fixture.mjs`. Kein Test darf aus Bequemlichkeit
   die produktive Supabase-URL abfragen.
2. **Browser-QA hat zwei Sperren.** Der Kontext fängt Supabase Data REST,
   Auth, Edge Functions und Storage mit lokalen Antworten ab; der Playwright-
   Proxy verweigert ausnahmslos andere externe Verbindungen. Nur der
   lokale Test-Webserver auf 127.0.0.1 ist erreichbar. Service Worker sind aus.
3. **CI prüft die Sperren, nicht nur die Fachfunktion.** Der statische Test
   `node tests/browser-qa-supabase-isolation.mjs` läuft in beiden Test-
   Workflows. `tests/e2e/supabase-network-contract.spec.mjs` prüft die
   vier API-Familien mit einem expliziten Mock-Marker in Chromium und WebKit.
   Neue Browser-Specs müssen den isolierten Fixture-Import benutzen.
4. **Produktive Prüfungen sind getrennt.** Nur manuell gestartete,
   begrenzte Live-Smokes dürfen Supabase abfragen und werden als eigene
   Ausführung kenntlich gemacht. Ein `push` oder Pull Request löst keine
   Live-Importbestandsinventur aus. Ein produktiver Smoke bleibt
   ausschließlich lesend, sofern nicht explizit ein Import freigegeben
   wurde. Keine massenhaften Logins, keine Schleifen mit HTTP 401.
5. **Planmäßige Datenimporte bleiben Produktionsbetrieb.** Vorhandene
   getaktete Quellenimporte sind *keine* Browsertests und dürfen weiterhin
   gezielt nach neuen Ergebnissen suchen. Quoten und Deduplizierung gehören
   zu deren separater Betriebsprüfung; Tests starten diese Jobs nicht.
6. **Fachliche Freigabe ist nicht gleich API-Verfügbarkeit.** Für Spieler,
   Altersklassen, Mannschaften, Berichte und Trophäen prüft eine Abnahme
   Quellbeleg, vorhandene Datensätze, Filterzuordnung und angezeigte Werte.
   `200 OK` und grüne Mocks beweisen keine Vollständigkeit realer Daten.
7. **Datenbankschema getrennt prüfen.** Neue SQL-/RPC-Änderungen:
   Migration nachweisen, RLS/Berechtigungen und erwartete Datenform
   prüfen; nur gezielte, lesende Produktionsabfragen für die Abnahme,
   keine wiederholten Browser-Volltests gegen die echte DB.
8. **Free-Plan-Überwachung.** Wöchentliche Verbrauchskontrolle auf
   tatsächliches Logs Ingest, Datenbankgröße, Egress und Ausführungen;
   nach auffälligen Releases Vorher-/Nachher-Vergleich. Eine einmalig
   grüne CI ersetzt keinen Verbrauchsnachweis.

## Testschichten und Zulassung

| Schicht | Ziel | Produktive Supabase-Anfragen |
|---|---|---|
| Unit/Parser/Import-Logik | Datenqualität, Deduplizierung, Rückgabeverträge | **0** |
| Playwright Chromium/WebKit | Navigation, Mobillayout, Einladung, Datenansichten | **0** |
| SQL-/RPC-Abnahme | Berechtigungen, Migrationen, realer Datenbestand | Nur kleine, gezielte Leseabfragen |
| Manueller Release-Smoke | Erreichbarkeit/Autorisierungsgrenzen | Explizit ausgelöst und begrenzt |
| Planmäßiger Import | Reale Datenerfassung | Operativ erlaubt, unabhängig von QA |

**Release-Blocker:** ungeklärte produktive Requests aus CI, fehlerhafte
Spieler- oder Ergebniszuordnung, falsch dargestellte Daten oder ein
fehlgeschlagener Berechtigungstest. Nicht behaupten, dass alle
Ergebnisse vollständig importiert wurden, solange Quellabdeckung
nicht belegt ist.

Hintergrund: v156 / PR #256 dokumentiert vor der Abschottung
~101.773 API-Requests/24 h und ~56.091 HTTP-401-Antworten.
Die Wirkung der Maßnahmen ist anhand späterer tatsächlicher
Supabase-Verbrauchswerte zu verifizieren.
