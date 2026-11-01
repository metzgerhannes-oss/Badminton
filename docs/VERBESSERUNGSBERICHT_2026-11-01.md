# Badminton / Schmetterlinge: technischer, visueller und Bedienungs-Audit

**Prüfdatum:** 1. November 2026 · **Gegenstand:** lokaler Stand von `metzgerhannes-oss/Badminton` auf `main`.

**Quellstand:** `453aeb10b346d14ef9494f2fec3f190bc3781364`, Oberfläche **v234**. Der beim Audit gelesene `origin HEAD` stimmt mit diesem Commit überein. Das ist kein Nachweis über den aktuellen GitHub-Pages-Deploymentstand.

**Auftrag:** Die App technisch, visuell und hinsichtlich ihrer Bedienbarkeit prüfen und einen anschließend umsetzbaren Verbesserungsplan erstellen. Sicherheit, Datenschutz, vorhandene Daten und Funktionen dürfen durch die Umsetzung nicht eingeschränkt werden.

**Lieferumfang dieses Audits:** Bericht, reproduzierbare Befunde, Screenshots, Messdaten und Umsetzungskriterien. Der Anwendungscode wurde für diesen Bericht nicht verändert. Die vorgeschlagenen Verbesserungen sind noch nicht implementiert.

**Nachtrag:** Der anschließende lokale Verbesserungsstand v235 ist im [Umsetzungsnachweis](UMSETZUNG_AUDIT_V235_2026-11-01.md) dokumentiert. Dieser Auditbericht bleibt als Vorher-Befund zum oben genannten Commit erhalten.

## 1. Ergebnis und empfohlene Entscheidung

Die bestehende Architektur kann weiterverwendet werden. Vier feste mobile Hauptbereiche, Desktop-Sidebar, getrennte Rollen für eigene und gefolgte Spieler, echte Quellenverweise, private Freigaben, lokale Backups und umfangreiche Regressionstests sind bereits vorhanden. Ein vollständiger Neubau würde unnötig viele funktionierende Verträge gefährden.

Der größte Handlungsbedarf liegt an vier konkreten Stellen:

1. **Speichern muss verlässlich sein:** Bei einem lokalen Schreibfehler bestätigt die App trotzdem den Erfolg. Ein neu angelegtes Profil verschwindet nach dem Neuladen.
2. **Bestandsdaten dürfen nicht still abgeschnitten werden:** Ein 13. eigenes Profil lässt sich anlegen, wird beim nächsten Start aber entfernt. Die Oberfläche und die Wiederherstellung verwenden unterschiedliche Grenzen.
3. **Die tatsächlichen Oberflächenfarben müssen zusammenpassen:** Eigene Profile sind mobil teilweise dunkel auf dunkel, während Desktop-Überschriften in derselben Verwaltung fast weiß auf weiß erscheinen. Frühere Kontrastkorrekturen decken diese Zustände nicht vollständig ab.
4. **Der Turnierbereich braucht eine kompaktere Aufgabenführung:** Im geprüften Zustand ist die mobile Seite etwa 9.822 CSS-Pixel lang. Speichern, Suchen, Kalender, Spond und aktuelle Spiele sind erreichbar, liegen aber unnötig weit auseinander.

**Empfehlung:** Zuerst Datenbeständigkeit und Lesbarkeit korrigieren, dann Bedienwege und Rückmeldungen verbessern. Anschließend die CSS-Kaskade gezielt vereinfachen. Bestehende Fach- und Sicherheitslogik weiterverwenden.

## 2. Was tatsächlich geprüft wurde

### 2.1 Methode und Testumfang

| Bereich | Ausgeführte Prüfung | Aussagekraft |
|---|---|---|
| Repository | Quellcode, `AGENTS.md`, UX-Zielbild vom 25.10., vorhandene UX2-Implementierungsnachweise, Manifeste und CI-Verträge gelesen | Bewertet den heutigen Code statt ausschließlich ältere Pläne |
| Unit-/Vertragstests | Alle 130 Testbefehle aus `.github/workflows/tests.yml` erneut ausgeführt | **130/130 Befehle erfolgreich**; einzelne Befehle enthalten mehrere Assertions/Tests |
| Bestehende Browserregression | Vollständiger Lauf der 335 vorhandenen Chromium-Fälle | **331 erfolgreich, 4 im Repository bereits übersprungen, 0 fehlgeschlagen**; 9,7 Minuten |
| Responsive Darstellung | 320, 390, 768, 1280, 1440 und 1920 CSS-Pixel | 66 dokumentierte Ansichts-/Dialogzustände; kein gemessener horizontaler Dokumentüberlauf |
| Visuelle Sichtung | Screenshots von Start, Spielern, Turnieren, Teams, Historie, Einstellungen, Profilverwaltung und Dialogen; zusätzlich Einladung, Welcome und Wiki | Konkrete Bildbelege für die Befunde; synthetische Namen und Profile |
| Barrierefreiheit | axe-core 4.10.2 über `@axe-core/playwright`, 34 ausgewählte Zustände | Automatische Befunde plus manuelle Sichtung; keine vollständige WCAG-Zertifizierung |
| Bedienung | Navigation, Touchflächen, Textgrößen, Dialoge, Fokusverträge und synthetisches Touch-Ziehen | Bewertet die Bedienmechanik; kein physischer iPhone-Test |
| Robustheit | Erzwungener lokaler Speicherfehler; Anlage des 13. Profils; Neuladen; Touch-Sortierung | Zwei unabhängig reproduzierte Datenbeständigkeitsfehler |
| PWA | Echter lokaler Serviceworker, anschließend Offline-Neuladen bei abgeschalteten API-Mocks | Shell wird geladen, eigenes Testprofil bleibt gespeichert, unbestätigter Zugang bleibt gesperrt |
| Performance | Ressourceninventur und wiederholte lokale Layoutverschiebungsmessung | Laborindizien; keine Feldmessung von INP/LCP oder 75.-Perzentil-Werten |

**Browser:** System-Chromium 154.0.8037.57, gesteuert durch das im Projekt vorhandene Playwright 1.56.1. Die Browser-Sandbox blieb aktiviert. Das ist eine funktionierende lokale Audit-Konfiguration, aber kein Ersatz für den CI-Lauf mit den offiziell zu Playwright gehörenden Browserversionen und WebKit.

Die erste Browserausführung scheiterte vor der App-Prüfung an einem fehlenden optionalen FFmpeg-Recorder. Im externen Audit-Runner wurde ausschließlich die Videoaufzeichnung abgeschaltet. Assertions, Screenshots, Traces, Zugangstests und Netzwerksperren blieben erhalten. Diese Infrastrukturfehler sind keine App-Fehler und werden nicht als fachliche Testergebnisse gezählt.

### 2.2 Sicherheitsgrenzen der Untersuchung

- Die App wurde lokal ausgeliefert. Supabase-Antworten waren synthetisch; nicht simulierte externe Verbindungen wurden blockiert. Es wurden keine produktiven Spielerprofile, Einladungen, Datenbankdaten oder Berechtigungen verändert.
- Die Prüfung umfasst Sicherheitsverträge im Repository und Browserverhalten. Aktuelle Produktions-RLS, tatsächliche Datenbankprivilegien und reale Betreiber-/Quellenrechte wurden nicht neu auditiert.
- WebKit-/Safari-Ausführung und reale iPhone-Haptik wurden nicht geprüft. Die offiziellen Browserdownloads bleiben durch die derzeit aktive Netzwerkregel blockiert.
- Offene PRs und Issues konnten nicht aktuell gelesen werden: Git-Lesezugriff funktionierte, `gh`-GraphQL lieferte `Forbidden`. Im Bericht genannte ältere Issue-Referenzen sind deshalb Anknüpfungspunkte und keine Aussagen über deren aktuellen Status.
- Die öffentliche Pages-URL war aus dieser Umgebung ebenfalls durch den Proxy gesperrt. Produktions-Sicherheitsheader und veröffentlichtes Aussehen sind nicht verifiziert.

### 2.3 „Haptisch“: was der Bericht damit meint

Bewertet wurden Fingerbedienung, Trefferflächen, Scrollwege, erkennbare Zustandswechsel, unmittelbare Rückmeldung, Sortieren und Abbruch-/Zurückwege. Ein Vibrationsmotor oder das Gefühl einer echten iPhone-Tastatur kann hier nicht beurteilt werden. Keine Kernaktion soll in einer späteren Umsetzung von Vibration oder einem bestimmten Eingabegerät abhängig werden.

## 3. Was erhalten bleiben soll

| Bestehende Fähigkeit | Vorgabe für jede Verbesserung |
|---|---|
| Start · Spieler · Turniere · Teams | Vier stabile mobile Ziele beibehalten; „Heute“ bleibt ein belegter Kontextlink |
| Corporate Design | Original-Logo, Marken-/Vereinsidentität und bewusst gewähltes Club-Branding erhalten |
| Eigene Familie und gefolgte Spieler | Gleiche DBV-ID kann beide Rollen haben; keine automatische Vermischung oder Rechteübernahme |
| Profilwechsel und Startprofil | Anzeigen eines gefolgten Spielers darf das eigene Startprofil nicht überschreiben |
| Turnierlinks, DBV-/BWBV-Kalender, Spond | Bestehende Funktionen und Zuordnungen erhalten; Vormerkung bleibt von Anmeldung unterscheidbar |
| Ergebnisse, Ranglisten, Historie, Trophäen | Nur belegte Daten; keine falschen Nullwerte, erfundenen Live-Angaben oder zusammengeworfenen Quellen |
| Teams, Verein, Berichte, Wiki, Spielecke | Weiter erreichbar, einschließlich bestehender Deep Links; keine Funktionsstreichung zur Vereinfachung |
| Private Einladungen und Freigaben | Serverseitige Prüfung, Scope-Trennung, Widerruf und unabhängige Bestätigung bleiben maßgeblich |
| Lokale Daten und Backups | Bestehende Storage-Schlüssel, IDs, Eigentumszuordnungen und Sicherungsformate kompatibel halten |
| PWA, Offline, Updates | Shell und Updateabläufe erhalten; Offline-Fehler dürfen keine Zugangsrechte erzeugen |
| Sprache, Zoom und Barrierefreiheit | Sprachwahl, RTL, Tastatur, Fokus, Vergrößerung und reduzierte Bewegung erhalten |
| Betrieb | Keine zusätzlichen kostenpflichtigen Dienste, Tracker oder unbeschränkten Hintergrundabrufe |

Positiv bestätigt sind unter anderem die funktionierenden vier mobilen Tabs, der fehlende Dokumentüberlauf in den 66 gemessenen Zuständen, die erhaltene lokale Profiltrennung und die tatsächlich ausführbare Touch-Sortierung. Diese Grundlagen sollen verbessert und nicht ersetzt werden.

## 4. Priorisierte Maßnahmenübersicht

**P1:** bestätigter Fehler mit Datenverlustgefahr oder erheblicher Lesbarkeitshürde. **P2:** wichtige Bedienungs-/Qualitätsverbesserung. **P3:** nachgelagerte Absicherung. Der Aufwand ist eine relative Einordnung, keine Terminprognose.

| ID | Prio | Maßnahme | Befundart | Aufwand |
|---|---|---|---|---|
| B01 | P1 | Erfolg erst nach erfolgreichem lokalem Speichern melden | Reproduzierter Funktionsfehler | Mittel |
| B02 | P1 | Einheitliche Grenzen und verlustfreie Bestandsbehandlung | Reproduzierter Funktionsfehler | Mittel |
| B03 | P1 | Eigene Profilkarten und Profilverwaltung lesbar machen | Screenshot + gemessene Farben | Klein–mittel |
| B04 | P1 | Verbliebene Kontrastfehler bei Aktionen, Historie und Links beseitigen | axe + Screenshots | Mittel |
| B05 | P2 | Turniere in kompakte, direkt erreichbare Aufgaben gliedern | Gemessene Seitenlänge + Bedienungsanalyse | Mittel |
| B06 | P2 | Eigene Familie im Spielerbereich auffindbar machen | Bestätigte Lücke zum UX-Zielbild | Mittel |
| B07 | P2 | Touchflächen und kleine Fachtexte vereinheitlichen | Messung + Lesbarkeitsbewertung | Mittel |
| B08 | P2 | Beim Ziehen von Spielern Ziel und Bewegung sichtbar machen | Touch-Reproduktion + Code | Klein–mittel |
| B09 | P2 | Formulare und Entfernen sicherer verständlich machen | Sichtung + Code | Mittel |
| B10 | P2 | Offline-/Fehlerzustände verständlich und wiederholbar machen | Echter Offline-Versuch | Klein–mittel |
| B11 | P2 | Überschriften und Kontextsemantik vervollständigen | Automatischer Best-Practice-Befund | Klein |
| B12 | P2 | CSS-Kaskade und Startstabilität gezielt verbessern | Inventur + Laborbeobachtung | Groß, in kleinen Schritten |
| B13 | P2 | Reale Zustände und Speicherfehler in Regressionen aufnehmen | Nachgewiesene Testlücken | Mittel, Bestandteil aller Pakete |
| B14 | P3 | Sicherheits- und Entwicklungsdokumentation vervollständigen | Code-/Dokumentationsbefund | Mittel |

## 5. Bestätigte Fehler mit Vorrang

### B01 · Speichern bestätigt Erfolg trotz Schreibfehler

**Beleg:** [Storage-Vertrag](/workspace/Badminton/state-storage.js:31), [Profilformular](/workspace/Badminton/app.js:770), [Reproduktionsdaten](/workspace/scratch/badminton-audit-2026-11-01/resilience.json).

**Reproduktion:** In einem isolierten Testbrowser wirft `localStorage.setItem` ausschließlich für `shuttleboard-v1` einen `QuotaExceededError`. Anschließend wird ein zusätzliches eigenes Profil angelegt. Die App schließt den Dialog, zeigt das neue Profil und meldet **„Spielerprofil gespeichert“**. Im gespeicherten Datenbestand stehen weiterhin nur die zwei ursprünglichen Profile. Nach Reload fehlt das neue Profil.

**Ursache:** `SchmetterlingeStorage.save` fängt Schreibfehler mit leerem `catch` ab. Die Aufrufer erfahren nichts vom Fehlschlag und setzen ihren normalen Erfolgsablauf fort. Auch andere Speichern-Aktionen müssen auf denselben Fehlerpfad geprüft werden; deren konkretes Fehlerverhalten wurde hier nicht einzeln reproduziert.

**Umsetzung:** Ein eindeutiges Speichenergebnis zurückgeben. Zustandsänderung und dauerhafte Speicherung gemeinsam behandeln: Bei Fehler keine Erfolgsmeldung, keine stillschweigende Verwerfung der Eingabe und keine irreführende dauerhafte Ansicht. Entweder den vorherigen Zustand wiederherstellen oder die neue Eingabe ausdrücklich als ungespeichert erhalten. Verständliche Meldung mit Wiederholungsmöglichkeit und Zugang zur bestehenden lokalen Sicherung anbieten, soweit der aktuelle Zugangsstatus das erlaubt.

**Abnahme:** Erfolgreiches Speichern übersteht Reload. Bei simuliertem Quoten-/Zugriffsfehler bleiben alte Daten unverändert und neue Eingaben verfügbar; der Dialog meldet den Fehler statt Erfolg. Keine automatische Cloud-Sicherung und kein ungefragtes Löschen anderer Daten.

### B02 · 13. eigenes Profil wird beim Neustart entfernt

**Beleg:** [Wiederherstellung](/workspace/Badminton/state-storage.js:16), [Anlage](/workspace/Badminton/app.js:779), `resilience.json → profileLimit`.

**Reproduktion:** Zwölf synthetische eigene Profile sind gespeichert. Ein 13. wird über das normale Formular angelegt. Die App meldet Erfolg und speichert tatsächlich 13 Einträge. Nach dem Reload stehen wieder zwölf im Speicher; das gerade angelegte Profil ist verschwunden.

**Ursache:** Die Wiederherstellung verwendet `.slice(0,12)`. Die Neuanlage setzt diese Grenze nicht durch. Beim Initialisieren wird der gekürzte Zustand erneut gespeichert. Für Turnierlinks und Freunde existieren vergleichbare Ladegrenzen von 40 beziehungsweise 30; die jeweiligen Anlage-, Import- und Bearbeitungswege müssen gemeinsam abgeglichen werden. Ein entsprechender Überlauf bei Turnieren wurde in diesem Audit nicht separat reproduziert.

**Umsetzung:** Grenzwerte zentral definieren und alle Schreib-/Importwege daran ausrichten. Vorhandene überzählige Daten dürfen beim Einlesen nicht unwiederbringlich abgeschnitten werden. Bestandsdaten müssen erhalten oder verlustfrei zur Wiederherstellung angeboten werden. Eine bloße neue Sperre am Formular würde den bereits vorhandenen Fehlerbestand nicht lösen. Keine bestehenden Grenzen senken; Erweiterungen nur mit abgestimmtem Backup-/Restore-Vertrag.

**Abnahme:** Tests für 0, 1, 12 und 13 eigene Profile, vorhandene Überbestände, Import und mehrfachen Reload. Kein erfolgreich bestätigter Eintrag verschwindet. Verknüpfte Turniere und Startprofil-ID bleiben konsistent. Das System meldet Grenzen vor einer ungesicherten Änderung.

### B03 · Profilverwaltung: dunkel auf dunkel und weiß auf weiß

**Bildbelege:** [Mobil, 390 px](/workspace/scratch/badminton-audit-2026-11-01/screenshots/einstellungen-profile-390.png), [Desktop, 1440 px](/workspace/scratch/badminton-audit-2026-11-01/screenshots/einstellungen-profile-1440.png).

**Mobil:** Die aktive Profilkarte behält einen dunklen Verlauf von `rgb(32,72,108)` nach `rgb(16,37,62)`. Der Profilname erhält zugleich dunkles `rgb(18,57,96)`. Das Startprofil ist dadurch schwer erkennbar. Die Vereinszeile der inaktiven hellen Karte hat nur etwa **1,46:1**, der Text „Aktives Startprofil“ auf der Verwaltungsfläche etwa **1,41:1**. Das Badge „Startprofil“ liegt etwa bei **1,65:1**.

**Desktop:** Der weiße Verwaltungsblock erbt helle Desktop-Überschriften. „Profile und Familie“ und „Meine Spielerprofile“ erreichen nur etwa **1,03:1**; der erklärende Absatz etwa **1,21:1**. Einzelne Bearbeiten-/Entfernen-Aktionen liegen auf dunklen Karten bei etwa **2,70:1**.

**Ursache:** Grundschicht, helle Komponenten, dunkle Desktopregeln und spätere Kontrast-Overrides legen Hintergrund und Schriftfarbe unabhängig voneinander fest. Beispielsweise erzwingt die Grundschicht bei `#current-account-label` eine helle Farbe mit `!important`, obwohl der umgebende Block hell ist.

**Umsetzung:** Profilkarte und Verwaltungsfläche erhalten jeweils ein vollständiges Farbpaarsystem für hell, dunkel und aktiv. Den Aktivzustand zusätzlich mit verständlicher Beschriftung oder Form kennzeichnen. Nutzergewähltes Club-Branding und Original-CD beibehalten. Die Regel an der zuständigen Komponente korrigieren, statt eine weitere globale Ausnahmedatei anzuhängen.

**Abnahme:** Aktive und inaktive Profile mit Vereinsname, Jahrgang, DBV-ID, Aktionen und Status bei 320/390/768/1280/1440/1920 px prüfen. Kleine Texte mindestens 4,5:1; großer Text mindestens 3:1. Verläufe an ihren maßgeblichen Hintergrundstellen prüfen. Profilwahl, Teilen und Entfernen bleiben unverändert funktionsfähig.

### B04 · Weitere Kontrastfehler sind trotz bestehender Kontrasttests vorhanden

**Beleg:** [Automatische Rohbefunde](/workspace/scratch/badminton-audit-2026-11-01/inspection.json), [Schaltflächen](/workspace/Badminton/ui-components.css:189), [Historie, 390 px](/workspace/scratch/badminton-audit-2026-11-01/screenshots/historie-390.png).

| Tatsächlich gerenderter Zustand | Gemessener Kontrast | Konsequenz |
|---|---:|---|
| Weißer Text auf primärem Button `#0c83c8` | ca. 4,12:1 | Unterschreitet 4,5:1 für die verwendeten 13–14-px-Texte |
| „+ Turnier“, mobil | ca. 4,14:1 | Betrifft eine zentrale Aktion |
| Offizieller Link im hellen gespeicherten Turnier | ca. 1,52:1 | Primäres Kartenziel schlecht sichtbar |
| Überschrift des leeren Historienblocks | ca. 1,17:1 | Dunkle Schrift auf altem dunklem Hintergrund |
| Überschrift des Ranglistenhinweises in der Historie | ca. 1,66:1 | Gleiche Kaskadenklasse von Fehler |
| Ranglisten-Fallbacklink auf Desktop | ca. 1,39:1 | Heller Link auf heller Karte |
| Rücklink zur Übersicht in der Desktop-Historie | ca. 1,44:1 | Sichtbarer Rückweg zu kontrastarm |

Weitere Befunde betreffen Kalender-Gruppenbeschriftungen, Quellenhinweise und einzelne Daten-/Hilfelinks. Manche Links sind gegenüber ihrem umgebenden Text nur farblich und mit weniger als 3:1 Unterschied gekennzeichnet. Hier hilft eine durchgängige Unterstreichung, ohne den Link oder die Quelle zu entfernen.

**Umsetzung:** Primäraktionen etwas dunkler aus dem bestehenden Blau ableiten; pro Oberfläche ausdrücklich passende Link-, Status- und Hinweisfarben festlegen. Inline-Links auch ohne Farberkennung unterscheidbar machen. Alle Leer-, Fehler-, Aktiv- und Disabled-Zustände einbeziehen. Deaktivierte Bedienelemente haben eigene WCAG-Ausnahmen; nicht pauschal wie aktiven Text behandeln.

**Abnahme:** Tatsächliche Browserfarben einschließlich Verläufen, Hintergründen und Club-Branding messen. Bestehende Quellen-/Beweislinks, unabhängige Sekundäraktionen und Browsernavigation unverändert erhalten.

## 6. Visuelle Struktur und Bedienwege

### B05 · Der Turnierbereich ist zu lang und vermischt Aufgaben

**Beleg:** [Gesamtscreenshot, 390 px](/workspace/scratch/badminton-audit-2026-11-01/screenshots/turniere-390.png), `inspection.json → turniere`.

Mit einem synthetischen gespeicherten Turnier und den vorhandenen lokalen Kalenderdaten wurden **11.410 px bei 320 px Breite**, **9.822 px bei 390 px** und **9.418 px bei 1440 px** gemessen. Diese Werte gelten für genau diesen Filter-/Datenzustand. Lange Ergebnislisten allein sind noch kein Fehler; problematisch ist die Kombination mit anschließend angeordneten weiteren Aufgaben.

Die bereits vorhandenen Direktaktionen „Meine Turniere“ und „Turnier finden“ sind sinnvoll. Unterhalb der langen Kalenderliste folgen trotzdem unter anderem „Meine Spiele“ und Quellenbereiche. Ein Wechsel zwischen Planung und aktuellem Geschehen verlangt unnötiges Scrollen. Der Befund ist kein Vorschlag, Turnierdaten wegzulassen.

**Umsetzung:** Auf derselben fachlichen Route klar zwischen „Meine Turniere“, „Finden“ und dem belegten Spieltagskontext unterscheiden. Vorhandene Filter, Links und `#live` weiterverwenden. Initial eine begrenzte, nachvollziehbare Treffermenge zeigen und den vorhandenen „Weitere Turniere“-Mechanismus konsequent auch für ergänzende Kalendergruppen prüfen. Gesamtzahl, aktive Filter und Wiederaufnahme der Scrollposition sichtbar halten. Primäraktion `+ Merken` pro Treffer direkt erhalten.

**Abnahme:** Alle heute erreichbaren Ergebnisse bleiben durch Suche/Filter/Mehrladen erreichbar. Kein zweiter Datenbestand, keine zusätzlichen unbeschränkten API-Aufrufe. Kernwege vom sichtbaren Einstieg ohne Durchscrollen der gesamten Liste. Ort, Kategorie und die Unterscheidung Vormerkung/Anmeldung bleiben korrekt.

### B06 · „Spieler“ bietet keine sichtbare Heimat für die eigene Familie

**Beleg:** [Spieleransicht](/workspace/scratch/badminton-audit-2026-11-01/screenshots/spieler-390.png), [versteckte Vorschau](/workspace/Badminton/index.html:538).

Die Spieleransicht zeigt ausschließlich „Gefolgte Spieler“. Die vorhandene eigene Profilvorschau ist ausdrücklich `hidden`; die eigene Familie wird in den Einstellungen verwaltet. Das widerspricht weiterhin dem Zielbild mit zwei klar getrennten Personenbereichen. Frühere Verbesserungen an Suche und Folgen haben dieses Auffindbarkeitsproblem nicht gelöst.

**Umsetzung:** Einen sichtbaren, kompakten Bereich „Meine Familie“ beziehungsweise „Eigene Profile“ anbieten. Für Pflegeaktionen das bestehende Formular bzw. die bestehende Verwaltungsroute öffnen. „Spieler folgen“ daneben als andere Rolle erklären. Keine kopierte zweite Profilverwaltung und keine automatische Umwandlung eines Follow in ein eigenes Profil.

**Abnahme:** Eigenes Profil wechseln, weiteres Familienprofil anlegen und jemandem folgen sind eindeutig unterscheidbar. Die gleiche offizielle Person darf beide Rollen behalten. Home bleibt mit dem gewählten eigenen Startprofil verbunden. Zusätzliche UI-Nähe erteilt keine privaten Zugriffsrechte.

### B07 · Touchflächen und kleine Texte sind uneinheitlich

**Messbeispiele:** Dialog-Schließen **42 × 42 px**; Home-Links „Komplette Statistik“ und „Alle anzeigen“ etwa **36 px** hoch; Ranglisten-/Quellenlinks teilweise **12–17 px** Textzeilenhöhe. Die vier Haupttabs erfüllen dagegen bereits die angestrebten großen Trefferflächen.

Mehrere fachliche Informationen liegen bei 10–11 px: Statistikbeschriftungen, Quellenstatus, Profilmetadaten und Datenstand. Kleine Version-/Markenzusätze sind weniger kritisch als eine schwer lesbare Ergebnis- oder Quelleninformation.

**Umsetzung:** Für eigenständige Touchaktionen mindestens 44 × 44 CSS-Pixel als Projektziel durchsetzen, auch bei kleinen sichtbaren Icons. Fachlich wichtige Sekundärtexte vorzugsweise auf 14–16 px anheben und mit sinnvoller Zeilenhöhe versehen. Lange Namen, größere Systemschrift und mehrzeilige Texte einplanen. Platz über Hierarchie und Offenlegung gewinnen, nicht durch immer kleinere Schrift.

**Einordnung:** 44 px ist hier ein freiwilliges Qualitätsziel. WCAG 2.2 AA verlangt nicht pauschal 44 px; dort gelten unter anderem 24-px-Anforderungen und Ausnahmen. Inline-Links und Checkboxen dürfen nicht nur nach der sichtbaren Text-/Boxgröße beurteilt werden: anklickbare Labels und erweiterte Kartenflächen zählen mit.

**Abnahme:** Reale Trefferfläche messen, nicht nur Icongröße. Keine Überschneidung mit benachbarten Aktionen; kein Autozoom bei Formulareingaben; keine abgeschnittenen Inhalte bei 200 % Text-/Seitenvergrößerung.

### B08 · Sortieren funktioniert, zeigt aber während des Ziehens kein klares Ziel

**Beleg:** `resilience.json → touchSorting`, [Pointer-Verarbeitung](/workspace/Badminton/app.js:279), [Screenshot während der Bewegung](/workspace/scratch/badminton-audit-2026-11-01/screenshots/sortieren-waehrend-touch-390.png).

Ein echter über Chromium injizierter Touchablauf verschiebt den dritten synthetischen Spieler erfolgreich an die erste Position. Während der Bewegung bleiben Griff und Zeile jedoch optisch an ihrer alten Position. Im geprüften Zustand gab es keinen Transform, keinen Einfügeindikator und keine spezielle Zieh-Klasse; die neue Reihenfolge erscheint erst beim Loslassen.

**Umsetzung:** Die aktive Zeile kennzeichnen, einen eindeutigen Einfügeplatz anzeigen und den erfolgreichen Abschluss kurz bestätigen. Bei Abbruch die alte Reihenfolge behalten. Zusätzlich zur bestehenden Tastaturbedienung eine gut auffindbare reine Tippmöglichkeit zum Verschieben anbieten. Keine Pflicht zu Drag-and-drop und keine Abhängigkeit von Vibration. Reduzierte Bewegung respektieren.

**Abnahme:** Touch, Maus, Pfeiltasten und Tippalternative erzeugen dieselbe Reihenfolge. Scrollen außerhalb des Griffes bleibt möglich. `pointercancel`, gefilterte Listen, Randpositionen und Reload sind abgedeckt. Personenrollen und Freigaben bleiben unverändert.

### B09 · Formulare und Entfernen benötigen klarere Prioritäten und Folgen

**Beleg:** [Manuelles Profilformular bei 320 px](/workspace/scratch/badminton-audit-2026-11-01/screenshots/profil-dialog-manuell-320.png), [Profilentfernung](/workspace/Badminton/app.js:163), [Turnierentfernung](/workspace/Badminton/app.js:127).

Das Profilformular kombiniert Suche, Datenschutz-/Rechtehinweis und mehrere manuelle Felder in einem langen Dialog. Der bestätigende Speichern-Button ist im schmalen Zustand erst nach internem Scrollen erreichbar. Die vorhandene Erreichbarkeit ist durch Browserprüfungen abgesichert; der Vorschlag betrifft eine bessere Aufgabenführung, nicht einen nachgewiesenen vollständigen Bedienungsausfall.

Beim Entfernen eines eigenen Profils fragt die App nur nach dem Profil. Der Code entfernt zusätzlich dessen zugeordnete Turnierlinks. Diese Folge gehört in die Bestätigung. Beim Entfernen eines Turnierlinks fehlt das bereits für Entfolgen vorhandene Rückgängig-Muster.

**Umsetzung:** Suche, Auswahlprüfung und manuelle Ergänzung klarer staffeln. Seltene optionale Felder zurückstellen, aber erreichbar halten. Eine gut erreichbare Aktionszeile prüfen; sie darf weder Bildschirmtastatur noch Formularfelder verdecken. Beim Profilentfernen Zahl und Art der mitbetroffenen lokalen Vormerkungen nennen. Turnierentfernen gegebenenfalls reversibel machen, unter Beachtung bestehender Freigabe-/Widerrufssperren.

**Abnahme:** Eingaben bleiben bei Fehler erhalten. Escape, Abbrechen, Fokus-Rückkehr und Scroll funktionieren. Kein automatisches privates Teilen, keine zweite Codeeingabe und keine Abschwächung der Berechtigungsbestätigung. Rückgängig darf eine widerrufene Serverberechtigung niemals wiederherstellen.

## 7. Technische Qualität, Sicherheit und Barrierefreiheit

### B10 · Offline-Fehler zeigt internen Text statt verständlicher Hilfe

**Beleg:** [PWA-Protokoll](/workspace/scratch/badminton-audit-2026-11-01/pwa-performance.json), [Offline-Screenshot](/workspace/scratch/badminton-audit-2026-11-01/screenshots/pwa-offline-zugang-390.png), [Zugangslogik](/workspace/Badminton/app-access.js).

Nach Installation des echten lokalen Serviceworkers wurde offline neu geladen. Der HTML-Aufbau kam aus der Shell; die gespeicherte synthetische Profil-ID blieb unverändert. Ohne mögliche Serverbestätigung blieb die private App korrekt gesperrt. Die sichtbare Fehlermeldung lautete jedoch nur **„Failed to fetch“**.

**Umsetzung:** Bekannte technische Fehler in verständliche deutsche Zustände übersetzen: offline, Zeitüberschreitung, ungültige Einladung, widerrufener Zugang und vorübergehend nicht erreichbare Quelle. Eine gezielte Aktion „Erneut prüfen“ anbieten. Bestehende Datenbeständigkeit erklären, ohne nicht verfügbare Offline-Funktionen zu versprechen. Hinweise auf eine fehlende Quelle nicht als „noch keine Spiele“ formulieren.

**Abnahme:** Unbestätigter oder widerrufener Zugang bleibt gesperrt. Keine automatische Gastfreischaltung und keine Nutzung alter lokaler IDs als Autorisierung. Bei wieder verfügbarer Verbindung lässt sich die Prüfung wiederholen, ohne Nutzerdaten oder Einladungen unnötig neu anzulegen.

### B11 · Überschriftenstruktur ist bei Routenwechseln unvollständig

axe meldete in 17 geprüften Zuständen `page-has-heading-one`: Auf den entsprechenden aktiven Seiten ist nur eine `h2`-/`h3`-Struktur sichtbar. Außerdem wurde einmal eine verschachtelte ergänzende Landmarke im Turnier-Desktopkontext beanstandet.

**Einordnung:** „Keine sichtbare h1“ ist hier ein Best-Practice-Befund und allein kein Beweis eines WCAG-AA-Verstoßes. Bestehende Routentitel, Fokusübergänge und Navigation funktionieren. Eine semantisch klare Hauptüberschrift verbessert dennoch Orientierung und Screenreader-Nutzung.

**Umsetzung:** Pro aktiver Hauptansicht eine nachvollziehbare Überschriftenhierarchie festlegen; ergänzende Kontexte passend als Abschnitt oder Top-Level-Landmarke auszeichnen. Bereits vorhandene Fokusführung auf den neuen Seitentitel erhalten. Keine visuelle Umgestaltung durch ungeprüfte globale `h1`-Regeln auslösen.

**Abnahme:** Tastaturreihenfolge, Skip-Link, Escape/Fokus-Rückkehr, Dokumenttitel und `aria-current` bleiben konsistent. Abschließend auf echtem VoiceOver prüfen. Den sichtbaren Tastaturfokus nicht aus optischen Gründen entfernen.

### B12 · CSS-Kaskade und Startaufbau verursachen vermeidbare Unsicherheit

**Inventur:** `index.html` bindet **25 Stylesheets** mit zusammen etwa **253 kB** und **46 Skripte** mit zusammen etwa **457 kB** direkt ein, jeweils unkomprimierte Quelldateigröße. Dazu kommen Module, Bilder, Daten und weitere Imports. In den CSS-Dateien im Repository-Hauptverzeichnis wurden **313 `!important`-Vorkommen** gezählt. Das ist kein automatischer Performancefehler, erklärt aber die schwer vorhersagbaren Oberflächenkombinationen.

Ein Home-Aufruf im ersten Inspektionslauf erzeugte 141 Resource-Einträge und etwa 1,08 MB dekodierte Antwortdaten. Die Zahl enthält auch lokal simulierte API-Vorgänge und ist kein gemessener Produktions-Traffic.

**Layoutstabilität:** Wiederholte lokale Startmessungen zeigten stark vom Ablauf abhängige Verschiebungen. In einem Lauf lagen mobile Werte bei etwa 0,013/0,489/0,489 und Desktopwerte bei etwa 0,007. In der korrigierten zweiten Serie lagen die drei mobilen Werte jeweils bei etwa 0,013 und die drei Desktopwerte jeweils bei etwa 0,148. Betroffen waren unter anderem nachträglich befüllte Statistik-/Trophäenbereiche. Diese kurzen Laborserien mit Mocks und gleichzeitig laufender Testsuite sind kein Feld-CLS und kein Produktions-Perzentil. Sie begründen eine gezielte Untersuchung statt eines pauschalen Geschwindigkeitsurteils.

**Umsetzung:** Zuerst die Farbpaare aus B03/B04 an ihren Eigentümer-Komponenten korrigieren. Danach schrittweise Tokens für Oberfläche, Text, Status, Fokus und Aktionen konsolidieren. Doppelte Altregeln nur bei nachgewiesener Gleichwertigkeit entfernen. Für asynchrone Kernkarten sinnvolle Platzhalterhöhe reservieren. Selten benötigte Skripte erst nach Profiling verzögert laden; Offline-Verfügbarkeit, Spielecke und bestehende Routen erhalten. Keine pauschale neue Buildplattform einführen, bevor ein konkreter Nutzen nachgewiesen ist.

**Abnahme:** Vorher/nachher dieselben Zustände screenshotten und messen. Keine schlechtere Start-/Navigationszeit; keine sichtbaren Sprünge durch unnötiges Entfernen und Neuanlegen von Karten. Produktionsnahe Web-Vitals anschließend getrennt erheben. Keine neuen Tracker oder unbeschränkten Vorabrufe.

### B13 · Die vorhandenen Tests erfassen die neuen Befunde noch nicht

Die 130 Unit-Testbefehle und die 331 ausgeführten bestehenden Browserfälle bestehen. Trotzdem sind die beiden Speicherfehler reproduzierbar und Kontrastfehler sichtbar. Das ist kein Widerspruch: Viele Tests prüfen bereits wertvolle, aber ausgewählte Verträge – beispielsweise einzelne Platzhalterfarben, bestimmte Karten oder eingefügte Beispielblöcke. Nicht jede tatsächliche aktive/inaktive Profilkarte, Leeransicht oder Primäraktion wird vollständig gemessen.

Die ergänzende axe-Prüfung meldete **24 von 34 Zuständen** mit mindestens einem Befund. Darunter waren Kontrastmeldungen in 15 Zuständen sowie Linkunterscheidbarkeit und semantische Best-Practice-Befunde. Die 91 gemeldeten Kontrast-Elementvorkommen enthalten Wiederholungen über mehrere Ansichten und sind keine 91 unabhängigen Fehler. Verläufe verursachen außerdem `incomplete`-Ergebnisse und benötigen zusätzliche Bewertung.

**Umsetzung:** Mit jeder Korrektur einen Test ergänzen, der den konkreten bisherigen Fehler auslöst: Schreibfehler/Reload, 13 Profile, aktive und inaktive Karte, tatsächlicher leerer Historienblock, echte primäre Buttons und Offline-Zugang. axe gezielt auf repräsentative Seiten/Dialoge anwenden; Verläufe gesondert prüfen. Vor Änderungen mit allen 335 Fällen vergleichen. Sicherheits-/Storage-/Routingänderungen weiterhin mit voller und nicht lediglich verkürzter Browserregression prüfen.

**Abnahme:** Die neuen Reproduktionen schlagen am alten Stand fachlich fehl und am korrigierten Stand erfolgreich an. Keine Entfernung von Assertions, kein großzügigerer Sollwert allein zum Bestehen. Produktive Supabase-Verbindungen bleiben in Tests blockiert. Ein fehlender Browser oder eine übersprungene Suite zählt nicht als Erfolg.

### B14 · Sicherheits- und Entwicklungsgrundlagen gezielt vervollständigen

Im überprüften `index.html` ist keine CSP-Meta-Policy deklariert. Über HTTP gesetzte Produktionsheader konnten nicht gelesen werden. Deshalb ist dies **kein belegter fehlender Produktionsschutz** und kein nachgewiesener XSS-Befund.

**Sicherheitsvorschlag:** Eine geeignete Content Security Policy untersuchen. Erforderliche Supabase-, Bild-/Club-Branding-, Blob-/Daten-, Worker- und bestehende statische Script-/Style-Verwendungen vollständig inventarisieren. Report-Only zunächst über einen geeigneten lokalen Testserver bzw. eine unterstützte Header-Konfiguration prüfen; `Content-Security-Policy-Report-Only` lässt sich nicht ersatzweise per Meta-Tag betreiben. Erst nach Funktionsnachweis eine zum tatsächlichen Hosting passende Durchsetzung wählen. Keine großzügigen Wildcards oder `unsafe-eval` als bequeme Fehlerbehebung einführen.

**Entwicklungsgrundlagen:** CI erwartet Node 22; die Cloud wurde mit Node 24.19.0 geprüft. Ein Root-`package-lock.json` fehlt. README-Abschnitte nennen teils frühere Funktionsstände, voreingestellte Familienprofile oder einen nicht mehr vorhandenen Pages-Workflowpfad. Einen kurzen aktuellen Einstieg vor die historische Dokumentation setzen; Toolchain und reproduzierbare Abhängigkeitsinstallation in einer späteren bewussten Codeänderung festlegen.

**Abnahme:** Alle aktuellen Funktionen arbeiten unter einer eventuellen CSP weiterhin. Keine Tokens in Logs/Backups, kein Wechsel zu einem anderen Supabase-Projekt, keine Aufweichung von RLS oder Suche-/Importlimits. Produktionsrechte bei Bedarf gesondert und lesend prüfen; Browser-Sicherheitsverträge sind kein Ersatz dafür. Aktuelle Issues/PRs vor Umsetzung erneut abgleichen, sobald der Lesezugriff möglich ist.

## 8. Empfohlenes Zielbild nach der Umsetzung

**Start:** Aktives eigenes Profil, nächste relevante Termine und gut lesbare Leistungsübersicht. Keine zusätzliche Warntextwand; Datenstand und Quellen direkt erreichbar. Der bestehende positive Home-Look und das CD bleiben erhalten.

**Spieler:** Ein eigener Familienbereich und ein klar getrennter Follow-Bereich. Kurze Wege zu Wechseln, Hinzufügen, Folgen und Sortieren; weiterhin nur ein Pflegeformular je Aufgabe.

**Turniere:** Gespeicherte Turniere und Suche als unmittelbare Aufgaben. Aktuelle Spiele als belegter Kontext mit direktem Einstieg. Kompakte erste Treffermenge, vollständige Ergebnisse auf Abruf, gleichbleibende Ort-/Kategorie-/Quellenangaben.

**Teams:** Bestehende lokale Reihenfolge und direkte Aktionen beibehalten. Auswahl/Detail und Quellen klar kennzeichnen. Desktopfläche nutzen, ohne eine zweite Fachlogik zu erzeugen.

**Formulare und Einstellungen:** Ausreichende Trefferflächen, lesbare Farben, eindeutige Hauptaktion, verständliche Fehler. Datenbeständigkeit sichtbar verlässlich; irreversible Folgen vor dem Bestätigen erkennbar.

**Desktop:** Navy-Identität, Sidebar und vorhandene Listen-/Detailansätze weiterverwenden. Helle Karten erhalten konsequent dunkle Schrift. Dichte über gute Spaltenaufteilung gewinnen, nicht durch unlesbar kleine Texte.

## 9. Umsetzung in kontrollierten Paketen

| Reihenfolge | Inhalt | Fertig, wenn … |
|---|---|---|
| 1. Datenbeständigkeit | B01/B02; gemeinsame Speicherrückmeldung; verlustfreier Umgang mit Überbeständen | Quotenfehler und 13-Profil-Reproduktion abgesichert, Backup-/Restore-/Rollentests unverändert erfolgreich |
| 2. Lesbarkeit | B03/B04 und wichtigste Text-/Touchkorrekturen aus B07 | Kontrast der tatsächlichen Profile, Leerzustände und Aktionen in Mobile/Desktop nachgewiesen |
| 3. Bedienwege | B05/B06/B08/B09/B10/B11 | Planen, Familie, Folgen, Sortieren und Fehlerbehebung klar erreichbar; jede vorhandene Funktion erhalten |
| 4. Technische Konsolidierung | B12; B14 soweit sinnvoll | Keine CSS-Doppelreparaturen, stabilerer Start; jede Optimierung mit Vorher-/Nachher-Nachweis |
| 5. Gesamtabnahme | B13 über alle Pakete, volle Browser-/Sicherheits-/PWA-Regressionsprüfung | Identischer finaler Commit geprüft; anschließend eine reale Geräte-Schlussabnahme |

Keine parallelen widersprüchlichen UI-Umbauten. Vor Beginn eines Pakets bestehende PRs und Issues erneut abgleichen. App-Version und Offline-Cache bei einem späteren tatsächlichen Release gemeinsam aktualisieren. Erst erfolgreiche SHA-identische Main-/Pages-Gates erlauben eine Aussage über Veröffentlichung. Dieser Bericht selbst benötigt keinen App-Versionssprung.

## 10. Verbindliche Abnahmekriterien ohne Funktionsverlust

- Eigene Profile, Follow-Rollen, Turnierzuordnungen, Startprofil, Reihenfolgen und Backups überstehen Änderung, Reload und Update unverändert.
- Keine Erfolgsmeldung bei gescheitertem Speichern; keine stille Datenkürzung.
- Alle bisherigen Routen, Wiki-/Spielecke-Einstiege, Team-/Vereinsansichten, Quellen und Freigabeaktionen bleiben erreichbar.
- Kein doppeltes Auslösen von Kartenprimäraktion und verschachtelter Sekundäraktion.
- Kontext „Heute“ nur mit Beleg; Kalender-Vormerkungen weiterhin keine Anmeldung; fehlende Daten weiterhin keine erfundene Nullbilanz.
- Normale Texte mindestens 4,5:1, großer Text mindestens 3:1, relevante nichttextliche UI mindestens 3:1 unter Berücksichtigung der jeweiligen WCAG-Ausnahmen.
- Eigenständige Touchaktionen möglichst mindestens 44 × 44 CSS-Pixel; Zoom, Tastatur und reduzierte Bewegung bleiben nutzbar.
- Keine horizontalen Dokumentüberläufe bei den sechs Prüfbreiten. Ein ausdrücklich scrollbarer breiter Datenbereich muss als solcher erkennbar und bedienbar bleiben.
- Einladungen, Scope-Grenzen, unabhängige Verifikation, abgelaufene/widerrufene Sitzungen und Offline-Zugangsverweigerung bleiben serverseitig korrekt.
- Keine produktiven Supabase-Abfragen in gewöhnlichen Tests, keine neuen Tracking-/Kostenpflichtdienste, keine erhöhten Import-/Suchkontingente als UI-Reparatur.

## 11. Einmalige reale Geräte-Schlussabnahme

Diese Liste folgt nach der automatisierten Umsetzung und wird nicht als bereits erledigt dargestellt.

- [ ] Kleines iPhone und aktuelles iPhone: vier Tabs mit einer Hand treffen, Profil wechseln, zurück navigieren, scrollen, sortieren und Entfolgen rückgängig machen.
- [ ] Mit geöffneter Bildschirmtastatur eigenes Profil und Turnier anlegen; Schließen, Speichern und Fehlermeldungen erreichen; keine ungewollten Zoomsprünge.
- [ ] Safari-Einladung → Homescreen-PWA: Einladung und bestehende Profile korrekt übernehmen; keinen zweiten Code verlangen, soweit der vorhandene Übergabevertrag das vorsieht.
- [ ] Offline-Neustart und Rückkehr ins Netz: verständliche Meldung, Daten unverändert, Zugang niemals durch Offlinezustand erweitert.
- [ ] Größere Schrift und VoiceOver: Überschriften, Rollen, Status, Dialoge und Fokus-Rückkehr verständlich; keine verdeckte Hauptaktion.
- [ ] Desktop mit Tastatur bei 1280/1440/1920 px: Sidebar, Datenlisten, Detailauswahl und Fokus vollständig nutzbar.
- [ ] Original-Logo, bewusste Vereinsfarben, Quellenunterscheidung und alle bisherigen Funktionen im finalen Release vergleichen.

## 12. Prüfprotokoll und Artefakte

**Unit-/Vertragstests:** 130 von 130 Befehlen erfolgreich; [Ergebnisse](/workspace/scratch/badminton-audit-2026-11-01/unit-results.json), [vollständiges Protokoll](/workspace/scratch/badminton-audit-2026-11-01/unit.log).

**Bestehende Chromium-Browserregression:** **331 erfolgreich, 4 übersprungen, 0 fehlgeschlagen, 0 flaky**, Laufzeit etwa **9,7 Minuten**. Die vier Fälle sind bereits im Repository mit `test.skip` markiert; für den Audit wurde kein Test deaktiviert. Sie betreffen einen vereinsbestätigten Sieg, belegte Turnierplatzierungen gefolgter Spieler, ältere Ranglistenturniere und Vereinsberichte mit Gegnern/Sätzen (`tests/e2e/mobile.spec.mjs`, Zeilen 173, 216, 240 und 258). Diese Szenarien gelten dadurch nicht als geprüft. Vor der Umsetzung ihren Status bzw. eine mögliche aktuelle Ersatzabdeckung gezielt klären. [Maschinenlesbares Ergebnis](/workspace/scratch/badminton-audit-2026-11-01/e2e-results.json).

**Ergänzende Diagnose:** 66 dokumentierte Zustände, 34 axe-Prüfungen; kein horizontaler Dokumentüberlauf und keine erfassten JavaScript-`pageerror`-Ereignisse im ergänzenden Inspektionslauf. Zwei Datenbeständigkeitsfehler reproduziert. Automatische Barrierefreiheitsbefunde bleiben offen; ein grüner bestehender Testlauf beseitigt diese Befunde nicht.

| Artefakt | Inhalt |
|---|---|
| [Browserlog](/workspace/scratch/badminton-audit-2026-11-01/e2e.log) | Aktueller vollständiger Regressionslauf |
| [Audit-Runner](/workspace/scratch/badminton-audit-2026-11-01/playwright.audit.config.mjs) | Systembrowser, zwei Worker, unveränderte Netzwerksperre und Assertions |
| [Inspektionsdaten](/workspace/scratch/badminton-audit-2026-11-01/inspection.json) | Maße, tatsächliche Farben aus axe, Überschriften, Ressourcen und Befunde |
| [Screenshotverzeichnis](/workspace/scratch/badminton-audit-2026-11-01/screenshots) | Alle 66 Zustände und ergänzende Reproduktionen |
| [Robustheits-Reproduktion](/workspace/scratch/badminton-audit-2026-11-01/resilience.mjs) | Speicherfehler, 13 Profile und Touch-Ziehen |
| [Robustheitsdaten](/workspace/scratch/badminton-audit-2026-11-01/resilience.json) | Konkreter Vorher-/Nachher-Bestand und angezeigte Erfolgsmeldung |
| [PWA-/Layoutmessung](/workspace/scratch/badminton-audit-2026-11-01/pwa-performance.json) | Wiederholte lokale Messungen und echter Offline-Shell-Aufruf |

Die Rohartefakte liegen bewusst außerhalb des App-Checkouts. Sie enthalten synthetische Testdaten und sind keine neuen Produktionsdaten. Die Datei `pwa-initial-mock-still-active.json` ist ein verworfener Vorversuch mit noch aktiven API-Mocks im Offlinezustand; für die Offlineaussagen gilt ausschließlich `pwa-performance.json`. Die Messserie des Vorversuchs wird nur zur Einordnung der schwankenden Layoutbeobachtungen genannt.

**Reproduktion des bestehenden Browserlaufs:**

```bash
cd /workspace/Badminton
./node_modules/.bin/playwright test \
  --config /workspace/scratch/badminton-audit-2026-11-01/playwright.audit.config.mjs
```

**Noch nicht nachgewiesen:** regulärer CI-/WebKit-Lauf für den finalen Verbesserungsstand, echte iPhone-/VoiceOver-Abnahme, aktueller Produktions-RLS-/Header-/Quellenrechte-Audit und ein neu veröffentlichter Pages-Stand. Diese Punkte sind ausdrücklich von den erfolgreich lokal ausgeführten Prüfungen getrennt.
