# Umsetzung des Technik-, Visual- und Bedienungs-Audits · v235

Stand: 1. November 2026. Grundlage ist der [Auditbericht](VERBESSERUNGSBERICHT_2026-11-01.md) zum Commit `453aeb10b346d14ef9494f2fec3f190bc3781364`.

Die Änderungen liegen im lokalen Checkout. **v235 ist ein vorbereiteter Quellstand, kein Nachweis einer Veröffentlichung auf GitHub Pages.** Das andere Repository JohannasGartenwelt wurde nicht verändert.

## Ergebnis für Nutzer

- Die App bestätigt eine Änderung erst nach erfolgreichem lokalem Speichern. Bei Speicherfehlern bleiben die bisherigen Daten und die Formulareingaben erhalten; es wird keine öffentliche Meldung oder Freigabe angestoßen.
- Vorhandene Überbestände werden beim Start nicht mehr auf zwölf Profile, 30 Follows oder 40 Turnierlinks abgeschnitten. Neuanlagen halten die bestehenden vorgesehenen Grenzen ein; vorhandene Einträge bleiben bearbeitbar und sicherbar.
- Aktive und inaktive Profilkarten, Verwaltungsflächen, Historien-Leerzustände, primäre Aktionen und Quellenlinks erhalten passende Schrift-/Hintergrundpaare für Smartphone und Desktop.
- Im Spielerbereich führt „Meine Familie“ zu den bestehenden eigenen Profilen und ihrer bisherigen Verwaltung. Der Follow-Bereich bleibt davon getrennt.
- Der Kalender zeigt zunächst zwölf importierte Treffer und lädt jeweils zwölf weitere nach. Die gesamte passende Treffermenge bleibt erreichbar. Spielplan und Ergebnisse sind über einen direkten Kontextlink erreichbar.
- Beim Sortieren werden die bewegte Zeile und der Zielplatz sichtbar. Alternativ lässt sich die Reihenfolge ohne Ziehen per Schaltflächen oder wie bisher mit der Tastatur ändern.
- Turnierlinks lassen sich nach Entfernen lokal rückgängig machen. Das stellt keine widerrufenen Serverrechte wieder her und veröffentlicht nichts erneut. Die vorhandene Sperre für aktive private Einladungen bleibt erhalten.
- Das Entfernen eines eigenen Profils nennt jetzt auch mitbetroffene lokale Turnierlinks. Dialog-Schließen hat eine größere Trefferfläche; Fehler bleiben im aktiven Formular sichtbar.
- Bei Offline-/Netzwerkfehlern erscheint verständliche Hilfe mit „Zugang erneut prüfen“. Fehlende Serverbestätigung öffnet die private App weiterhin nicht.
- Der verifizierte App-Inhalt wird erst nach abgeschlossener lokaler Initialisierung eingeblendet. Die Authentifizierung läuft weiterhin parallel; Sportdaten müssen dafür nicht vollständig geladen sein.

## Abgleich mit den Befunden

| Befund | Umsetzung und Grenze |
|---|---|
| B01 · Speichern | Speicherergebnis, Rücknahme ungesicherter Zustandsänderungen, erhaltene Eingaben, persistente Fehlermeldung und keine vorzeitigen Folgeereignisse |
| B02 · Bestandsgrenzen | Verlustfreies Laden, keine automatische Neu-Speicherung beim Start, Grenze vor Neuanlage in App und Welcome; Bearbeitung und Wiederherstellung älterer Überbestände |
| B03 · Profilfarben | Explizite Paletten für aktive dunkle und inaktive helle Karten sowie die helle Verwaltungsfläche innerhalb des Navy-Desktops |
| B04 · Weitere Kontraste | Primärbuttons, Turnier-/Kalenderlinks, Historienhinweise, Daten-/Quellenlinks und ergänzende Desktopflächen korrigiert |
| B05 · Turnierwege | Zwölfer-Seiten, bestehende Filter/Vormerkungen unverändert, direkter Spielplan-Einstieg; kein Verwerfen von Treffern |
| B06 · Familie | Sichtbarer eigener Personenbereich mit Nutzung derselben Profile und Verwaltungsroute; keine zweite Pflegeoberfläche |
| B07 · Touch/Schrift | Wichtige Aktionen und Dialog-Schließen vergrößert; Profilmetadaten und Statistikhinweise lesbarer. Kein pauschales Vergrößern dekorativer Versionstexte oder Umbauen jedes Inline-Links |
| B08 · Sortieren | Zieh-/Zielmarkierung, Positionsstatus, reine Tippalternative, Tastatur und Fokus-Rückkehr |
| B09 · Formulare/Entfernen | Fehlermeldungen im Dialog, erreichbares Schließen, verständliche Löschfolgen, lokales Rückgängig für Turnierlinks. Keine neue Formularschrittfolge oder versteckten Pflichtfelder |
| B10 · Offline | Fehlerübersetzung und erneute serverseitige Prüfung; keine Offline-Freischaltung |
| B11 · Semantik | Logische Überschriftenebenen per ARIA bei bewahrten bestehenden Styling-/Fokusankern; eindeutig benannter Desktop-Kontext und Dialognamen |
| B12 · CSS/Start | Gezielte Korrektur der vorhandenen Komponenten und des DOMContentLoaded-Rennens; Platz für Statistik reserviert. Kein vollständiger CSS-Neubau und kein ungeprüftes Lazy Loading |
| B13 · Regression | Neue Browserfälle und erweiterte Unit-/Backup-Verträge für die konkret gefundenen Fehler; bestehende Sicherheitsprüfungen bleiben aktiv |
| B14 · Entwicklungs-/Sicherheitsgrundlagen | Lockfile mit Integritätswerten, `.nvmrc` für Node 22, lokale Artefakte in `.gitignore`, aktueller README-Einstieg und begrenzte CSP für Basis-URLs/Objekte. Keine Behauptung einer vollständigen Script-/Netzwerk-CSP oder eines Produktionsrechte-Audits |

## Daten- und Sicherheitsverträge

`shuttleboard-v1`, bestehende IDs, Bookmark-Eigentumszuordnungen und der Unterschied zwischen Startprofil und betrachtetem Follow bleiben bestehen. Das Speicherschema wird nicht um neue Berechtigungsinformationen erweitert.

Ein fehlgeschlagener Schreibzugriff wird nicht mehr verschluckt. Der zuletzt bestätigte lokale Zustand wird im Arbeitsspeicher wiederhergestellt, ohne den alten gespeicherten Wert zu löschen. Bearbeitungsdialoge behalten ihre Felder und den Bearbeitungskontext für einen erneuten Versuch.

Der Start liest vorhandene Daten, ohne sie sofort zurückzuschreiben. Gültige ältere Überbestände bleiben erhalten. Für Backups gelten gesonderte Wiederherstellungsgrenzen von 100 eigenen Profilen, 300 Follows und 400 Links bei unverändertem 200.000-Zeichen-Größenlimit. Typ-, URL-, Duplikat-, Datums- und Eigentumsprüfungen bleiben aktiv; normale Neuanlagen werden dadurch nicht erweitert. Alte gültige Sicherungen bleiben lesbar.

Die neue CSP beschränkt ausschließlich `base-uri` auf die eigene Herkunft und deaktiviert eingebettete Objekte. Sie ändert weder Script-Ausführung noch die bestehenden Netz-/Bildziele. Eine umfassende CSP benötigt weiterhin einen separaten Funktions-/Hostingnachweis.

Es gibt keine Änderungen an SQL, RLS, Supabase-Projektzuordnung, Import-/Suchkontingenten, Quellenschutz oder serverseitiger Verifikation. Tests verwenden weiterhin synthetische Antworten und blockieren produktive Supabase-Verbindungen.

## Nachweise

### Vorher/nachher

| Ansicht | Vorher | Nachher |
|---|---|---|
| Profile auf dem Smartphone | [v234](/workspace/scratch/badminton-audit-2026-11-01/screenshots/einstellungen-profile-390.png) | [v235](/workspace/scratch/badminton-improvements-2026-11-01/validated/screenshots/einstellungen-profile-390.png) |
| Profile auf Desktop | [v234](/workspace/scratch/badminton-audit-2026-11-01/screenshots/einstellungen-profile-1440.png) | [v235](/workspace/scratch/badminton-improvements-2026-11-01/validated/screenshots/einstellungen-profile-1440.png) |
| Spieler und eigene Familie | [v234](/workspace/scratch/badminton-audit-2026-11-01/screenshots/spieler-390.png) | [v235](/workspace/scratch/badminton-improvements-2026-11-01/validated/screenshots/spieler-390.png) |
| Turnierbereich | [v234](/workspace/scratch/badminton-audit-2026-11-01/screenshots/turniere-390.png) | [v235](/workspace/scratch/badminton-improvements-2026-11-01/validated/screenshots/turniere-390.png) |

Im identischen synthetischen Kalenderzustand reduzierte sich die Dokumenthöhe bei 390 px Breite von etwa 9.822 auf etwa 4.968 px. Bei 320 px waren es vorher etwa 11.410 und anschließend etwa 5.839 px. Die genaue Höhe ist daten-, schrift- und filterabhängig; sie ist kein allgemeiner fester Seitenwert. Nachladen bleibt Teil der vollständigen Ergebniserreichbarkeit.

Der Laborvergleich zum Start prüfte drei Aufrufe bei 390 px und drei bei 1440 px. Nach der Korrektur des lokalen Initialisierungsrennens wurden in dieser kurzen Serie keine Layoutverschiebungen gemeldet. Das ist kein Produktions-CLS oder Feld-Perzentil. Die rohe Messung und ihre Quellen stehen im PWA-Protokoll.

Ein echter lokaler v235-Serviceworker wurde installiert. Beim Offline-Neuladen kamen die HTML-Shell und das lokale Testprofil wieder; die private App blieb ohne Serverbestätigung gesperrt. Die Fehlermeldung erklärt den Offlinezustand und den erhaltenen Profilbestand.

### Tests

- **130/130 Unit-/Sicherheits-Testbefehle bestanden**, einschließlich der erweiterten Bestands-, Schreibfehler- und Backup-Prüfungen.
- **348 eindeutige Browserfälle bearbeitet: 344 letztlich bestanden, vier bestehende Skip-Fälle nicht ausgeführt.** Der breite abschließende Lauf lieferte zunächst 343 erfolgreiche Fälle und einen Fehler im neuen Turnier-Undo-Test. Der damit gefundene Rückmeldungswettlauf wurde korrigiert; anschließend bestanden alle **22 gezielt wiederholten Fälle** zu Speichern, Undo, Ziehen, Kontrasten, öffentlichem Teilen und Einladungssperren. Das ist ein zusammengeführter Prüfstand und wird nicht als vollständig grüner einzelner CI-Lauf dargestellt.
- **66 Ansichten bei sechs Breiten**, kein horizontaler Dokumentüberlauf und keine erfassten JavaScript-`pageerror`-Ereignisse im visuellen Nachtest.
- **34 axe-Prüfzustände ohne gemeldete Violations**, gegenüber 24 Zuständen mit Befunden vor der Umsetzung. Automatische axe-Ergebnisse und die zusätzlichen Farbpaartests ersetzen keine vollständige WCAG-/Screenreader-Abnahme; unvollständig automatisch bewertbare Fälle bleiben gesondert zu beurteilen.
- **Lokale PWA-/Offline-Prüfung bestanden:** v235-Cache, erhaltenes Testprofil, weiterhin gesperrte private App ohne Serverbestätigung und verständliche Offline-Meldung.
- **Reproduzierbare Installation geprüft:** `npm ci --offline --ignore-scripts` in einem separaten Prüfverzeichnis installiert die festgelegte Playwright-Version 1.56.1 aus dem Integritäts-Cache. App-Version und Serviceworker-Cache sind konsistent.

Lokaler Browser: System-Chromium 154 mit aktivierter Browser-Sandbox und projektseitigem Playwright 1.56.1. Die unten verlinkte maschinenlesbare Zusammenfassung bewahrt sowohl den breiten Lauf als auch den erfolgreichen Nachtest.

Die vier schon vor dieser Arbeit mit `test.skip` markierten Altfälle werden nicht als erfolgreiche Prüfungen ausgegeben. Für diese Umsetzung wurde kein vorhandener Test deaktiviert. Der bisherige Kalender-Test wurde an die beabsichtigte Seiteneinteilung angepasst: Er lädt alle Seiten nach und verlangt anschließend weiterhin die exakte vollständige Treffermenge. Der Home-Kontrasttest vergleicht die Profilmetadaten mit der tatsächlichen hellen Desktopfläche statt einer früher irrtümlich angenommenen dunklen Fläche.

### Artefakte

- [Abschließende Browserregression](/workspace/scratch/badminton-improvements-2026-11-01/final-regression.log)
- [Maschinenlesbare Browserergebnisse](/workspace/scratch/badminton-improvements-2026-11-01/final-regression.json)
- [Erfolgreicher Nachtest der 22 betroffenen Fälle](/workspace/scratch/badminton-improvements-2026-11-01/recheck.json)
- [Zusammengeführter Prüfstand mit ursprünglichem Fehlerverlauf](/workspace/scratch/badminton-improvements-2026-11-01/validation-summary.json)
- [Unit- und Sicherheitsprüfungen](/workspace/scratch/badminton-improvements-2026-11-01/unit-final.json)
- [Visueller Nachtest und axe-Befunde](/workspace/scratch/badminton-improvements-2026-11-01/validated/inspection.json)
- [Neue Screenshots](/workspace/scratch/badminton-improvements-2026-11-01/validated/screenshots)
- [PWA-/Startmessung mit bestätigter Initialisierungsreihenfolge](/workspace/scratch/badminton-improvements-2026-11-01/ready-check/pwa-performance.json)

Rohdaten und Testartefakte liegen außerhalb des Repositories bzw. werden ignoriert. Das Original-Logo und produktive Daten wurden nicht geändert.

## Veröffentlichung und verbleibende Abnahme

Ein aktueller Abgleich offener PRs über GitHub GraphQL scheiterte erneut mit `Forbidden`. Die Änderungen wurden deshalb nicht ohne PR-/Main-/Pages-Gates direkt nach Main gepusht. Der lokale Quellstand ist von einem erfolgreichen Deployment klar zu unterscheiden.

Weiter offen sind WebKit/Safari unter der regulären CI-Konfiguration, die einmalige reale iPhone-/VoiceOver-/Desktop-Schlussabnahme aus dem Auditbericht und gegebenenfalls ein separater aktueller Produktionsrechte-/Header-Audit. Die offiziellen Playwright-Browserdownloads sind in dieser Cloud weiterhin nicht freigegeben. Kein erfolgreicher lokaler Chromium-Test ersetzt diese Nachweise.
