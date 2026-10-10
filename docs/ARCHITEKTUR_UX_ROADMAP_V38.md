# Schmetterlinge – Architektur-/UX-Sanierung, verbindlicher Maßnahmenplan

Stand: 10.10.2026 · Basis: GitHub `main` v37 (Vierer-Navigation), P0-Paket v38. Bezug: #8 Design, #13 Frontend, #6 Matchstatistik, #17 Live/Quellen.

## A. Ist-Analyse (gegen Forschungs-/UX-Katalog)

| Ebene | Tatsächliche Umsetzung | Risiko / Verbesserung |
|---|---|---|
| Produktnavigation | **v37 hat bereits vier** Hauptpunkte Home, Turniere, Spieler, Berichte; Einstellungen oben. Historie ist Unterroute von Turniere | **Keine fünfte oder sechste Hauptnavigation einführen.** Historie und Berichte fachlich abgrenzen und Aufgaben in Tests prüfen |
| Startseite | Profil, DBV-Ranglisten, Trophäen, nächste Turniere, Statistik, Freunde; ursprünglich Ranglisten vor dem nächsten Termin | Aufgabenwert / Turniertag zuerst, Quellenkomplexität nur bei Bedarf |
| Profilauswahl | Eigene und gefolgte DBV-Spieler lokal; Home/Logo setzt Freundesansicht auf eigenes Profil zurück | Einheitlicher Profilkontext, kein verdeckter Wechsel eigener Familie beim Anzeigen eines Freundes |
| Spielstatistik | Offizielle `player_match_observations` vs. eindeutige Badhub-Einzelbelege: **niemals aufsummieren**. Externe Quellen können unvollständig sein | Kurze Quellenbezeichnung, Detailerklärung und sichtbarer Importfortschritt ohne technische Warnkarten |
| Live | On-demand für betrachtete IDs; veröffentlichte Quellinfos in Supabase gecacht, auf Home nur bei frischem tatsächlich belegtem Match | Datenschutz, ehrliche Zeitstempel, kein unnötiges Polling oder veraltete Scores |
| Spielerverzeichnis | Supabase-first mit Github-Fallback; 9.246 DBV-Ranglisteneinträge als historischer Stand; v37 standardmäßig **keine** Liste ohne Filter | Vorhandenes gutes Verhalten erhalten; Suche mit Debounce, leere Treffer verständlich |
| Persönlicher Zustand | `localStorage` mit Profilen, Freunden, Turnierlinks; keine echte Familie-Cloud | Gerätewechsel-/Backup-UX, später bewusstes Opt-in für Sync, insbesondere Kinderprofile |
| Architektur Frontend | `app.js` rund 28 KB mit Routing, Profilen, Formularen, Storage und Renderkoordination; mindestens zwölf weitere Skripte kommunizieren durch `window`-Hooks und Events | Schrittweise nach Zuständigkeit modularisieren, keine abrupte Migration der vorhandenen Nutzergeräte |
| CSS | Legacy `styles.css` rund 56 KB plus zunehmend additive `design-v2.css` rund 43 KB | Tokens und Komponentenklassen konsolidieren; heute klar umrissene v38-Overrides statt riskantem Komplettaustausch |
| Offline | Network-first SW, Shell-Precache und Cachebypass für dynamische Daten; PWA-Shell versioniert | Benutzern klar sagen, wenn das Gerät offline meldet. Offline-Modus testen, Daten nicht als aktuell ausgeben |
| Daten-Backend | Supabase/PostgREST mit RLS, pg_cron, Edge Function; quellengekennzeichnete externe Match-Facts getrennt von offiziellen Matches | Adapter-Validierung und Laufüberwachung; Rechte an Drittanbieter-Daten prüfen. Kein unbegrenzter Webcrawler |
| Qualität | Node-/Python-Einheitstests, GitHub Actions/Pages; keine bestätigte automatisierte reale iPhone-End-to-End-Abnahme | E2E, Tastatur-/Screenreader-/Offline-Tests, gestufte Release-Abnahme einrichten |

## B. Prioritäten und Umsetzungsabhängigkeiten

**P0 heißt Release-Qualität für vorhandene Kernaufgaben.** Von unten nach oben arbeiten: korrekte Quelle/State → Navigation → Verständlichkeit → Regressions-/Gerätetest. P1 erst nach P0-Praxisabnahme. P2 nur bei nachgewiesenem Nutzerbedarf.

| ID | Prio | Arbeitspaket | Konkrete Maßnahme | Abnahme | Status |
|---|---|---|---|---|---|
| UX-01 | P0 | Home | Nächster Termin und Live-Hinweis vor Statistik vor vollständigen Ranglisten; Trophäen/Freunde bleiben erhalten | DOM-Reihenfolge und mobile Sichtprüfung | **v38 programmiert** |
| UX-02 | P0 | Statistik | Quelllabel für Badhub vs. DBV, knapper Hinweis, Zusatzbelege nur auf Wunsch | Kein Quellenmix, kein bloßer „Importfehler“-Block | **v38 programmiert** |
| UX-03 | P0 | Fehler | Statistik hat Retry bei vollständigem Quellfehler; Wiederholung nach zurückgekehrtem Netz nur im passenden Kontext | Offline simulieren und Retry auslösen | **v38 programmiert** |
| UX-04 | P0 | Navigation | Vier Tabs erhalten, eindeutiger Home-/Logo-Reset, Seitenüberschrift bei Routing fokussiert, Titel aktualisiert | Tastatur, Deep Link und Browser-Zurück testen | **v38 programmiert** |
| UX-05 | P0 | Barrierefreiheit | Skip-to-content, sichtbare Tastatur-Fokusrahmen, bevorzugte Bewegungsreduzierung, vergrößerte kritische Schriften/Touch-Ziele | Tastatur/VoiceOver manuell zusätzlich erforderlich | **v38 programmiert** |
| UX-06 | P0 | Offline | Nicht-blockierender Offlinehinweis, kein irreführender Live-Stempel; kein Netz-Zwang beim Lesen vorhandener Shell | Flugmodus + Netzwechsel auf iPhone | **v38 programmiert**, Gerätetest offen |
| UX-07 | P0 | Sicherheit/Fachlogik | Regression für Quellenvalidierung, Dubletten, Satzperspektive und Follow-Kontext; Importtexte trennen Quellarten | CI grün und echte Quelle vor Freigabe | Bestehende Tests + v38 erweitert |
| UX-08 | P0 | Mobile Release Gate | iPhone SE/kleiner Safari, großes iPhone und Android: Bottom Nav, Modale, Profile, Turnier/Livetag/Statistik, Offline, Schriftvergrößerung | Screenshots + dokumentierte Akzeptanz pro Gerät | **Offen – praktischer Test** |
| UX-09 | P0 | Datenschutz | Vor weiterer Massensammlung/Weiterveröffentlichung von Badhub-Einzelkarten Datennutzung prüfen | Dokumentierte Rechteentscheidung, klare Quellen | **Offen – kein automatischer Lizenzschluss** |
| UX-10 | P1 | State-Architektur | Aus `app.js`: Routing, Player/Follows, Bookmarks und Persistenz in isolierte Module extrahieren | Gleiche localStorage-Daten ohne Migrationverlust, komplette Regression | Offen |
| UX-11 | P1 | Daten-Client | Einen PostgREST-Client für Fehlerklassifizierung, Abort, Timeout, Status, Pagination | Einheitliche Fehlerzustände, reproduzierbare API-Tests | Offen |
| UX-12 | P1 | CSS-Architektur | Design Tokens (Typografie, Abstände, Kontrast, Touch) und Komponenten konsolidieren, Legacy-CSS schrittweise entfernen | CSS-Override-/Layout-Prüfungen vor Löschungen | Offen |
| UX-13 | P1 | Historie & Berichte | Berichte als Artikel/Hinweise definieren, Turnierhistorie klar als Leistungschronik; wechselseitige Kontexteinträge statt doppelter Suchwege | 2–3 Interaktionen für Kerntasks | Offen |
| UX-14 | P1 | Turniertag | Quelle und Alter unter dem Match, echte Aufruf-/Feld-/Satzpriorität, leere Zustände ohne Alarm | Echter Turniertag inkl. Doppel/Wechsel | Teilweise vorhanden, Praxisabnahme offen |
| UX-15 | P1 | Suche | Bibliothek: Suchbegriff/Filter und Ergebnisse, keine ungefragte Liste; Suchbegriff nach Profilwechsel erhalten | Leerer Zustand, Filter löschen, Favorit aus Suche | Großteils vorhanden, Abnahme offen |
| UX-16 | P1 | Performance | LCP/INP auf echtem Mobilgerät messen, kritischen JS/CSS-Pfad und PWA-SW-Warmstart reduzieren | p75 LCP ≤2,5s, p75 INP ≤200ms als Ziel | Offen |
| UX-17 | P1 | Datenaktualisierung | Letzter erfolgreicher Quellbeleg + nächster Sync je System (Rank, Live, Historie) | Zeitstempel pro Datentyp, keine technische Warnung | Teilweise vorhanden |
| UX-18 | P1 | Datenimport | Historien-Abdeckung offen deklarieren; Fehler/Teilmenge getrennt von „keine Spiele“, Match-Fakt-Validation härten | Matchcount = belegte Daten; Disziplin/Jahr korrekt | Teilweise vorhanden |
| UX-19 | P1 | Familien-Backup | Lokaler Export/Import (mit Bestätigung und Validierung), vor Cloud-Sync | Wiederherstellung auf zweitem Gerät ohne Datenverlust | Offen |
| UX-20 | P1 | Releases | Automatisierte Browser-E2E-Tests (Playwright), UI-Screenshots auf kleinen Displays, CI-Gates | Keine ungeprüften visuellen Regressionen | **Mobiles Browser-Gate als Folgeschritt umgesetzt; reale Geräteabnahme weiterhin offen** |
| UX-21 | P2 | Familiensynchronisierung | Opt-in Auth, Datenisolierung, Konfliktlösung, Widerruf und Löschung | RLS-Integration und zwei echte Geräte | Offen |
| UX-22 | P2 | Trainerblick | Optional mehrere gefolgte Spieler beim Turniertag ohne ständige Profilebene | Zeitplan und Quelle pro Person, gezieltes Polling | Offen |
| UX-23 | P2 | Turnier-Rückblick | Automatisch belegte Einzel- und Doppel-Ergebnisse zusammenfassen, ohne KI-Ergebnisfantasien | Originalbeleg, Datum, Feld, Disziplin | Offen |
| UX-24 | P2 | Hinweise | Opt-in Push für *tatsächlichen* Matchaufruf/Ergebnis, ggf. PWA-Plattformgrenzen | Keine Fehlalarme, Abschaltmöglichkeit | Offen |
| UX-25 | P2 | Kalender/Teilen | ICS-Export, QR-/Spielerlink nur öffentliches Profil und verifizierte Turniere | Keine Offenlegung von Familienbeziehungen | Offen |
| UX-26 | P2 | Kinder-Modus | Größere Texte, vereinfachte Rollenansicht; nicht voreilig ein zweites UI-System | Kinderbasierter Tasktest | Offen |

## C. Architektur-Zielbild

```
UI: Home · Turniere · Spieler · Berichte (+ Einstellungen)
           ↓
Navigation / Profilkontext (ein Route-/State-Controller)
           ↓
DOM-Komponenten: Rangliste | Match-KPI | Live-Radar | Historie | Suche
           ↓
Ein Daten-Client (Fetch/Abort/Retry/Quellenfehler/Typvalidierung)
   ├── Supabase offizielle DBV-Matches / Rank-Verzeichnis (RLS)
   ├── getrennte Badhub-Fakten (Provenienz und belegte Teilmenge)
   ├── Live-Snapshots (Staleness / TTL)
   └── statische öffentliche GitHub-Fallbacks
           ↓
Worker/Cron (bedarfsgesteuert und begrenzt, nie vom Browser ungeprüft)
```

**Keine sofortige Full-Rewrite-Entscheidung.** Bestehende PWA-URLs, Daten, Profile und Spiele müssen auch nach Modulgrenzen konsistent bleiben. Erst Tests und Migrationsvertrag, dann Extraktion.

## D. Mobile UX- und Produktabnahme

Vier wiederholbare Aufgaben auf eigenem Handy und je einer fremden Person je Eltern-/Spielerrolle:

1. „Wann ist mein nächstes Turnier, wo und für wen?“ → Home direkt, keine verschachtelte Suche.
2. „Wo spiele ich heute, gegen wen, läuft mein Match?“ → Turniere, Quellzeit sichtbar; bei fehlendem Live-Feed keine erfundenen Scores.
3. „Wie viele Einzel habe ich gewonnen und sind das alle?“ → Home, Einzel + Jahr, Quelle/Teilbestand verständlich.
4. „Finde Vinzent, folge ihm, wechsle zurück zu meinem Spieler“ → Spielerbibliothek, folgen, Zurück zu Home (eigener Spieler).

Zusätzlich: Browser-Zurück, tief verlinkte Historie, Tastaturfokus, VoiceOver/Zoom, WLAN-Ausfall, PWA-Update, leere Bibliothek, Gerätewechsel.

Produktmetriken **ohne personenbezogenes Tracking der Kinder**: Erfolgsrate je Aufgabe, benötigte Aktionen, Abbrüche, gemeldete Fehler, anonymisierte Ladezeiten. Keine „tägliche Nutzung“ als zwingendes Engagementziel.

## E. Freigaberegeln

- **P0-Release v38**: Alle statischen Regressionen und GitHub Pages grün. Automatische Checks ersetzen **nicht** die praktische mobile Abnahme.
- **P1 nur nach P0-Review**: zuerst State/API-Tests vor Refactoring, dann CSS-/Navigationseingriffe; pro PR klar begrenzte Änderung.
- **P2 nur nach Nutzerfeedback**, Quellenrechten und Datenschutzentscheidung; Opt-in und Datensparsamkeit für Kinder.
