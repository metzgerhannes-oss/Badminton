# IA-4 / v185 – Home, Heute und Kontextnavigation

Stand: 22.10.2026. Folgt auf manuell abgenommenes v184 (IA-3, #13). Ein einzelner, begrenzter UX-PR.

## Entscheidung
- **Home/Logo/Bottom-Navigation**: springt unmittelbar zur eigenen aktiven Familienprofilansicht, unabhängig von der zuletzt betrachteten Freundin / dem gefolgten Spieler und unabhängig davon, ob iOS WebKit `hashchange` verspätet auslöst.
- **Gezielte Auswahl eines gefolgten Spielers**: zeigt dessen Home-Statistik unmittelbar **ohne** den ausgewählten Freund auf das eigene Profil zurückzusetzen. Beides nutzt dieselbe sichtbare Routendarstellung mit unterschiedlicher, ausdrücklich beabsichtigter Profilauswahl.
- **Home- und Kontextlinks** nach Turniere, Heute, Spieler, Mannschaft, Berichte, Verein (Desktop) und Historie: verwenden dieselbe synchrone Navigation wie die untere Hauptnavigation. Der ursprüngliche `#hash` bleibt für Zurück, Lesezeichen und Reload erhalten.
- **Home › Freunde › +** öffnet die **eine** bestehende DBV-Spielersuche unter `#spieler` auch ohne sofortiges `hashchange`; keine zweite Suche und kein neues Einstellungsformular.
- **Heute** bleibt ein dynamischer Zusatz-Tab, sichtbar und rot ausschließlich bei belegtem heute angesetztem Spiel. Der bestehende `#live`-Modus, seine Quellenberechnung und der sichtbare Rückweg zu Turniere bleiben unverändert.
- **Detail-/Resultat-Routen, private Links und Einstellungen** bleiben unberührt; Quellennachweise und Berechtigungsprüfung werden nicht umgangen.

## Umsetzung
- `app.js`: eine gemeinsame, synchron sichtbare Zielnavigation inklusive Historie, mit Flag für explizite Auswahl eines gefolgten Spielers gegenüber Home-Aktion.
- Kontext-Delegation über interne Anker mit **exakt** erlaubten Primärzielen. Keine doppelten Bottom-Nav-Click-Handler, keine Übernahme von Settings-/Resultat-/Privat-/externen Links und kein Aufruf auf neue Backend-Endpunkte.
- Bestehende PWA wird mit Version `v185` und korrespondierendem Offline-Shell-Cache aktualisiert; lokale Storage-Keys, Formulare und Freigabe-Codes bleiben unverändert.

## Technische Abnahme
1. `node tests/navigation-ia4-v185.mjs`: statische Kanonisierung, Sicherheits- und PWA-Invarianten.
2. `tests/e2e/navigation-ia4-v185.spec.mjs`: synthetisch und Supabase-netzisoliert: eigenes/fremdes Profil, Home/Logo, unterdrücktes iPhone-`hashchange`, Home-Historienlink, Heute→Turniere→Home, Home-Freunde-+, 320/390/1280 Pixel und Überlauf.
3. Vor Merge: fünf erfolgreich abgeschlossene PR-Workflow-Gruppen auf dem **exakten** PR-Head einschließlich Chromium/WebKit. Danach fünf Main-/Pages-Gates auf dem exakten Merge-SHA, ohne fälschlich ein ausbleibendes Resultat als Erfolg zu werten.
4. Manuelle v185-Abnahme in bestehender iPhone-PWA und Desktop: alle Links, Zurück, Profilwechsel und keine neue Codeeingabe. Erst nach dieser Freigabe IA-5.

## Nicht enthalten
Keine neue UI-Farbe, kein zusätzlicher Navigations-Tab, keine Änderung am Live-Status, keine massenhaften Datenimporte, keine RLS-/Auth-/Supabase-Schemaänderung und keine produktiven Anfragen durch CI.
