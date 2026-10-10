## Supabase-Datenbank (10.10.2026)

Die separate Organisation **Badminton** und das Supabase-Projekt `yadexibmjmnjfmfabrug` sind eingerichtet. Public-DBV-Daten können schreibgeschützt gelesen werden, persönliche Listen sind durch RLS geschützt. Ein initialer Import der 16 kuratierten Platzierungen und vier KW41-Ranglistenwerte wurde durchgeführt. Eine **automatische Live-DBV-Ergebnisübernahme** ist noch nicht eingerichtet; die neue Turnieransicht zeigt nur belegte Importdaten. Vollständiger Stand und technische Hinweise: **[Supabase-Backend](docs/SUPABASE_BACKEND.md)**.

## Verbindliche Quellenhierarchie (09.10.2026)

Die dauerhafte, nach **A–D** priorisierte und maschinenlesbare Referenzliste liegt unter **[`data/source-register.json`](data/source-register.json)**. Lesbare Übersicht und Qualitäts-/Prüfregeln: **[`docs/DATENQUELLEN_PRIORITAET.md`](docs/DATENQUELLEN_PRIORITAET.md)**. Die Liste ist auch unter Einstellungen in der App verlinkt.

**Warum noch keine fünf Einzelpunktwerte?** Der verwendete offizielle `turniere.badminton.de/ranking/download`-Export enthält nur den **amtlichen Gesamtscore** und die Anzahl Turniere; die DBV-Seite `dbv.turnier.de/ranking/ranking.aspx?rid=238` ist laut DBV die zuständige Quelle für spielerbezogene Einzelergebnisse, liefert dem unbeaufsichtigten Abruf am 09.10.2026 aber nur die Cookie-Zustimmungsseite. Badhub dokumentiert Ergebnisse, aber bislang keine nachgewiesenen Einzelwertungen, die in derselben KW zum DBV-Gesamtscore passen. Deshalb kein automatisches „Top 5“-Ausfüllen oder Schätzen aus Ergebnistabellen.

Die Detailansicht zeigt bei nicht nachgewiesenen Einzelwertungen **keine fünf leeren Felder mehr**, sondern eine kurze Erklärung und einen Link zur offiziellen DBV-Spielerrangliste. Bei verfügbaren überprüften Wertungen erscheinen bis zu fünf nach Punktzahl sortierte Turniere, nur wenn deren Summe zum Gesamtwert derselben Kalenderwoche passt.

> **Charlotte im DBV verifiziert (09.10.2026):** Charlotte Metzger, SpVgg Mössingen, Jahrgang 2014, Spieler-ID **`05-071969`**, ist in der [offiziellen DBV-Rangliste](https://turniere.badminton.de/ranking) für DE U13 mit **611 Gesamtpunkten aus zwei Turnieren** erfasst (KW41). Der U13-BW- und Deutschlandrang wird wie bei Philipp aus der vollständigen offiziellen Altersklassentabelle berechnet (nicht aus der Gesamt-Rangspalte!). Das frühere lokale Profil `local-charlotte` wird beim Laden automatisch migriert, samt Startprofilwahl und selbst gespeicherten Turnierlinks. Das verifizierte Einzel-Ergebnis, **5. Platz U13 bei der 4. E-Rangliste Südwürttemberg in Ehingen vom 26.09.2026**, bleibt in der Historie erhalten, zählt aber nicht als Top-4-Trophäe. Im Wochenimport sind nun beide Spieler-IDs hinterlegt.

## Ranglistenpunkte und helleres Vereinsdesign (Oktober 2026)

Die drei Hauptkacheln zeigen jetzt zusätzlich die **offiziellen Gesamtpunkte** der jeweiligen DBV-Disziplin. Stand KW 41/2026, Spieler-ID `05-070879`: HE **2.670**, HD **1.322**, HM **1.469** Punkte. Beim Antippen öffnet sich die Detailkarte mit großem Gesamtscore, BW-/Deutschland-Rang, Vergleich zur Vorwoche und einer Tabelle für die **fünf besten Ranglistenwertungen**.

**Verifizierungsgrenze:** Der DBV bestätigt ausdrücklich, dass die fünf besten Wertungen innerhalb der letzten zwölf Monate zählen (siehe [offizielle DBV-FAQ](https://www.badminton.de/der-dbv/jugend-wettkampf/faq/)). Der herunterladbare aktuelle DBV-Excel-Export enthält allerdings nur `Points/Punkte` als Gesamtscore und `Turniere` als Anzahl, **keine fünf mit Turniernamen und Einzelpunkten verknüpften Wertungen**. Deshalb zeigt das Detailfenster fünf Positionen als *„Einzelwertung nicht verfügbar“*, solange die Einzelwerte nicht unabhängig belegt sind. Sie werden **nicht aus Platzierungen geschätzt**. Das Importformat unterstützt fünf validierte Einzelwertungen; deren Summe muss mit dem offiziellen Gesamtscore übereinstimmen, andernfalls werden sie nicht angezeigt. Der Donnerstag-Import speichert derzeit `topFive: []` und den Status `not-in-public-export`.

Das Design verwendet jetzt ein **helleres abgestuftes Vereinsblau** mit gut lesbaren Kacheln, klarerem Hintergrund und einem größeren, nicht mehr weich ausgeblendeten originalen Schmetterlingslogo (rund 69–76 px). Die KPI-Fläche bleibt vorrangig; es gibt keinen zusätzlichen Begrüßungsbanner und keine Login-Maske.

> **Offizieller Turniernachweis – 35. Bezirksmeisterschaft Südwürttemberg, 11. Juli 2026:** Der [BWBV-Turnierbericht](https://bwbv.de/2026/08/19/bezirksmeisterschaft-bw-suedwuerttemberg-u11-u19-am-11-juli-2026/) verweist auf den [offiziellen DBV-Ergebnisdatensatz](https://dbv.turnier.de/tournament/0477D9EC-DA56-4B16-938D-138CC817E8E2). Die namentlichen Einzelresultate zu Philipp Metzger, DBV-ID `05-070879`, sind in der [Badhub-Übernahme aus dbv.turnier.de](https://badhub.de/spieler/05-070879?saison=2026&src=turnier) enthalten: **1. Platz JE U11**, **3. Platz JD U11 mit Philipp Landhäußer** und **2. Platz MxD U13 mit Anneliese Zhu**. Damit ist die frühere mögliche Doppel-Bronze nicht mehr offen. Die App zeigt getrennte Links zur DBV-Turnierseite und zur namentlichen Ergebnisübernahme. Neu erfasste Gesamtzahl: **9 Top-4-Ergebnisse** (2× Gold, 2× Silber, 3× Bronze, 2× Rang 4), ohne Anspruch auf vollständige Karriereabdeckung.

> **Startseite: Die nächsten drei Turniere (09.10.2026).** Unter den KPI-Kacheln erscheinen bis zu **drei kommende bzw. aktuell im hinterlegten Terminzeitraum liegende Turniere**. Grundlage sind die vom Benutzer unter „Turniere → Turnier anlegen“ selbst gespeicherten offiziellen DBV-Links mit Beginn-Datum, optionalem Enddatum und zugeordnetem Spieler. Es werden nur Einträge für das **aktive eigene Spielerprofil** oder „Alle Spieler“ angezeigt, doppelte Turnier-IDs zusammengefasst. Laufende Termine stehen vor späteren, übrige chronologisch. Jede Zeile öffnet die offizielle Turnierseite direkt. **Ohne gespeichertes Datum ist keine zuverlässige Reihenfolge möglich**; die Startseite fordert dann zum Nachtragen des Termins auf. Freunde sehen weiterhin ihr offizielles Spielerprofil statt fremder lokaler Turnierfavoriten. Die Liste ist ausdrücklich keine automatische DBV-Anmeldungsabfrage.

> **Profilwechsel (10.10.2026):** Auf der Startseite erscheint oben ein kompakter Schalter **„Wechseln“**, **aber nur, wenn mindestens zwei eigene Spielerprofile hinterlegt sind**. Die Liste öffnet sich ohne Umweg über Einstellungen, zeigt das aktive Profil markiert und schaltet die KPI-Ansicht sofort um. Bei nur einem Spielerprofil wird der Schalter komplett ausgeblendet. Ein besuchtes Freundeprofil hat weiterhin ausschließlich **„Zu mir zurück“**. Die Auswahl wird lokal dauerhaft als Startprofil gespeichert; eine Anmeldung ist nicht notwendig.

> **Korrektur 09.10.2026:** Frühere BW- und Deutschlandwerte wurden irrtümlich ausschließlich gegen Geburtsjahr 2016 berechnet. Die App verwendet jetzt **AKL2=U11**, inklusive aller in dieser DBV-Altersklasse gemeldeten Geburtsjahre, für Einzel, Doppel und Mixed sowie den Vorwochenvergleich. Die alte Schema-Version 1 wird vom Dashboard nicht mehr angenommen. **KW40/2026** aus dem offiziellen Excel-Archiv: Philipp HE BW 4/DE 46, HD BW 10/DE 165, HM BW 1/DE 20. Sein Screenshot der neueren Online-Liste nennt HE DE Platz 43 mit 2670 Punkten; das ist ein anderer Datenstand als das KW40-Archiv (2515 Punkte), kein Anlass zur Vermischung. Der Donnerstag-Workflow verarbeitet jeweils die neuesten bereitgestellten Wochenarchive.

## Vereinfachte Startseite: BW-Rang groß, Deutschland darunter

Die Startseite zeigt je Disziplin (Einzel, Doppel, Mixed) **genau eine kompakte Kachel**: **BW-Altersklassenrang groß**, Deutschland-Altersklassenrang darunter und einen Pfeil für die Veränderung des **BW-Rangs zur Vorwoche**. Die Ranglistenwerte kommen aus den offiziellen DBV-Wochenarchiven; BW wird anhand `LVName = BAW-Baden-Württemberg` gefiltert, jeweils nach **derselben DBV-Altersklasse AKL2**, Geschlecht und Disziplin. **U11 umfasst mehrere Geburtsjahrgänge – 2026 beispielsweise 2016 und 2017 –, nicht nur 2016.** Der Vergleich ist eine eigene Kohortenberechnung, keine offizielle separate BW-Rangliste. Die Vergleichsgröße ist beim Antippen sichtbar, etwa beim Mixed mit wenigen gewerteten Spielern.

**Kacheldetails** öffnen auf Fingertipp Punkte, BW-/Deutschland-Vorwoche, Größe der Vergleichsgruppen und Link zum Wochenarchiv. Darunter stehen nur der historische Trophäenschrank, die nächste selbst angelegte Turnierverknüpfung und die kompakte **Freunde-Leiste**. Ein Freund wird dort durch Antippen als aktive **Ansicht**, nicht als eigenes Standardprofil geöffnet; „Zu mir zurück“ führt zum eigenen Profil.

**Kein Login beim Start:** Beim ersten Besuch auf einem neuen Gerät erscheint lediglich eine einmalige, kleine Auswahl des eigenen Spielerprofils bzw. „Anderen Spieler einrichten“ (kein Passwort, keine E-Mail). Auf dem Gerät wird die Auswahl lokal gespeichert; spätere Aufrufe öffnen direkt die persönliche Übersicht. Bestehende lokale Profildaten werden bei Updates nicht zurückgesetzt.

**Grenze bei Freunden:** Ein Name und die DBV-ID auf der Freundesliste genügen für einen Schnellzugriff, noch nicht automatisch für den Import seiner offiziellen Wochenwerte. Wenn seine Rangliste nicht in der freigegebenen statischen Datenauswahl liegt, erscheint eine neutrale Meldung und gegebenenfalls der Link zum offiziellen Profil. Kein Ergebnis wird erfunden. Für echten, geräteübergreifenden automatischen Freundesimport ist später ein kontrollierter Backend-Prozess nötig; das statische Projekt veröffentlicht bewusst nicht die gesamte Kinder-Rangliste.

## Persönliche Startseite, Spielerprofile und Freunde

**Ein aktives Spielerprofil statt Familien-Sammelansicht:** Die Startseite zeigt jeweils nur die Haupt-KPIs des ausgewählten eigenen Spielerprofils. Das persönliche Startprofil lässt sich unter **Einstellungen → Meine Spielerprofile** festlegen. Voreingestellt ist Philipp (DBV-ID `05-070879`); vorhandene lokale Einstellungen und selbst gespeicherte Turnierlinks werden übernommen. Weitere eigene Profile mit Name, optionaler DBV-ID, Geburtsjahr und DBV-Profillink lassen sich anlegen, bearbeiten und entfernen.

Unter **Einstellungen → Freunden folgen** lassen sich Freunde über eine konkrete **DBV-Spieler-ID** hinzufügen, bearbeiten oder wieder entfernen. Mit **„Haupt-KPIs ansehen“** öffnet sich ihre eigene Ansicht. Ein **„Zu mir zurück“**-Knopf bringt den Nutzer zum eigenen Startprofil; Freunde werden nicht zum neuen Standardprofil. Zur Vermeidung falscher Zuordnungen erfolgt die Datenfilterung über DBV-IDs, nicht nur über gleichlautende Namen.

**Wichtige Begrenzung:** Das Projekt ist derzeit eine statische GitHub-Pages-PWA. Es gibt **noch keinen echten Benutzerlogin, keine Cloud-Synchronisierung, keine Freundschaftsanfrage und keine serverseitige Abonnementverwaltung**. Die Bezeichnung „Startprofil“ steht für eine lokale Auswahl, nicht für ein authentifiziertes Nutzerkonto. Die Freundesliste wird nur im Browser gespeichert. Der aktuelle wöchentliche DBV-Ranglistenimport enthält zunächst nur die ausdrücklich freigegebene DBV-ID von Philipp. Daher kann ein hinzugefügter Freund zwar unmittelbar ausgewählt werden; **Ranglisten-KPIs sind für ihn nur sichtbar, wenn seine ID bereits in der öffentlichen App-Datenbasis enthalten ist**. Sonst erscheint „noch nicht verfügbar“ und nach Möglichkeit ein Link zum offiziellen Spielerprofil. Null Auszeichnungen werden bei unvollständiger Freundes-Historie ausdrücklich nicht behauptet. Für eine echte, geräteübergreifende Anmeldung und dynamische Freundesdaten wäre ein separater Auth-/Backend-Dienst erforderlich.

## Startseite: KPI-Dashboard

Die App startet unter [Start](https://metzgerhannes-oss.github.io/Badminton/#start) mit kompakten Kacheln für **DBV-Altersklassenrang im Einzel, Doppel und Mixed**, **Trophäenschrank**, **erfasste Turniere** und **nächstes selbst angelegtes Turnier**. Der Spielerfilter gilt für alle Kacheln.

### DBV-Altersklassenplatz und Vorwochenvergleich

Die öffentlich herunterladbaren wöchentlichen Excel-Archive der [DBV-Rangliste](https://turniere.badminton.de/ranking/history) werden in einem eigenen GitHub-Workflow unter `.github/workflows/ranking.yml` **jeden Donnerstag 15:00 UTC** geprüft (17:00 MESZ / 16:00 MEZ). GitHub-Schedules können verzögert laufen. Das heißt nicht, dass die DBV jeweils donnerstags veröffentlicht. Es werden die letzten beiden tatsächlich vorhandenen Kalenderwochen verwendet.

Die Kacheln zeigen den **Rang innerhalb der offiziellen DBV-Altersklasse (Spalte AKL2, z. B. U11 mit mehreren Geburtsjahren), desselben Geschlechts und derselben Disziplin**, berechnet aus den offiziell veröffentlichten Punkten: Rang = 1 + Anzahl höher bewerteter Spieler derselben Gruppe. Punktegleichstand = gleicher Rang. Das ist ein **berechneter Altersklassenrang**, ausdrücklich **nicht** der bundesweite DBV-Gesamtrang.

Mit zwei echten Kalenderwochenständen zeigt die App `↑` bei besserem Altersklassenrang, `↓` bei schlechterem und `→` bei Gleichstand. Ohne verlässlichen Vergleich wird **kein** Pfeil behauptet. Ein Altersklassenwechsel zum neuen Jahr verhindert irreführende Vorwochenvergleiche; unbekannte Werte bleiben leer.

Philipp hat die DBV-Spieler-ID `05-070879` und Jahrgang **2016 / U11 (2026)**. Charlotte hat jetzt die offiziell verifizierte DBV-Spieler-ID `05-071969`, Jahrgang **2014 / U13 (2026)**; sie ist wie Philipp in der wöchentlichen öffentlichen Rangliste hinterlegt. Nur Ranglisten-Kennzahlen hinterlegter IDs werden in `data/ranking.json` veröffentlicht, nicht die vollständige Ranglistendatei. Bei Quellefehlern bleibt die letzte erfolgreiche Datei bestehen, vor dem ersten erfolgreichen Abruf steht „Noch keine Daten“. Öffentliche Download-Verfügbarkeit garantiert weder eine API noch den rechtlich uneingeschränkten automatischen Betrieb.

# Schmetterlinge · Badminton Jugend Mössingen

Die mobile Web-App für die Familie mit **historischen Turnierergebnissen**, **Trophäenschrank** und **gespeicherten offiziellen DBV-Turnierlinks**.

**App:** https://metzgerhannes-oss.github.io/Badminton/

## Turnier selbst anlegen

Nach der Anmeldung zu einem Badmintonturnier kannst du dessen offizielle URL selbst speichern:

1. Unter **Turniere** auf **+ Turnier anlegen** tippen.
2. Einen Link im Format `https://dbv.turnier.de/tournament/E24DC6EE-152A-454D-B00C-E625B751D7D5` einfügen.
3. **Alle Spieler**, **Philipp** oder **Charlotte** zuordnen.
4. Falls bekannt, **Turniername**, **Beginn** und **Ende** ergänzen. Alle drei Angaben sind optional.
5. Speichern. Die App liest die eindeutige UUID aus der URL und behält den Bookmark lokal.

Ergebnis: Das Turnier erscheint unter **Meine Turnierlinks**, bei eingetragenem Termin gruppiert als **Bevorstehend**, **Turniertag** oder **Vergangen**. Dies beschreibt nur das manuell hinterlegte Datum und **keinen Live-Spielstatus**. Den Turnierlink öffnen, später bearbeiten oder entfernen ist jederzeit möglich. Ohne Namen zeigt die App als Platzhalter „DBV-Turnier“ und die ersten acht Zeichen der UUID.

Der Link ist ein dauerhafter Zuordnungsschlüssel. Sollten später zulässig nutzbare Ergebnissätze importiert werden, lassen sie sich anhand derselben Turnier-ID verknüpfen. **Es werden derzeit keine automatischen Daten aus DBV/Tournament Software abgerufen.**

## Historie und Trophäenschrank

Die Registerkarte **Historie** enthält eine kuratierte Auswahl aus dem öffentlichen Vereins- und Verbandsberichtswesen in `data/history.json`. Die Ergebnisse sind **nicht vollständig**. Es gibt Spieler-, Jahres- und Disziplinfilter, chronologische Turnierkarten, Links zu Originalquellen und separate Platzierungsverläufe.

Der Trophäenschrank zählt Ergebnisse mit Platzierungen **1, 2, 3 und 4**. Einträge mit Platz 5 oder schlechter bleiben ausschließlich in der Chronik. Doppelungen anhand derselben Ergebnis-ID werden nicht doppelt gewertet. Anklickbare Auszeichnungen verlinken ihren Quellbericht. Familienbestätigte, noch nicht unabhängig geprüfte Meisterschaftsdetails sind entsprechend gekennzeichnet; der zuvor nur vermutete dritte Platz im Doppel bei der Bezirksmeisterschaft ist durch die namentliche DBV-Ergebnisübernahme bestätigt und **als Bronzetrophäe** enthalten.

Für Philipp sind derzeit **2× Gold, 2× Silber, 3× Bronze und 2× Platz 4** erfasst. Diese Zahlen stellen **keine vollständige DBV-Karrierestatistik** dar.

## Spieler

Philipp Metzger, Spieler-ID `05-070879`, und Charlotte Metzger (DBV-ID `05-071969`, Jahrgang 2014) sind voreingestellt. Du kannst Spieler lokal hinzufügen und den Familienfilter umschalten. **Spielerfavoriten und gespeicherte Turnierlinks liegen ausschließlich im lokalen Speicher des jeweiligen Browsers.** Sie werden nicht über mehrere Geräte synchronisiert; nach Löschen der Browserdaten gehen sie verloren.

## Bewusste Grenze: keine Live-Funktion

Ohne freigegebene DBV-Datenschnittstelle waren minutengenaue Matchzeiten, echte Aufrufe, Felder und Benachrichtigungen nicht zuverlässig automatisierbar. Die zuvor nur demonstrativen Live-Widgets sowie der geplante periodische Import wurden entfernt. Der offizielle Spielplan bleibt über den gespeicherten Link direkt erreichbar. Dadurch macht die App keine unbelegten Versprechen zum Stand eines Turniers.

## Technisch

- Statische PWA, HTML/CSS/JavaScript; GitHub Pages und GitHub Actions
- Smartphoneoptimiert, installierbar über Safari → Teilen → Zum Home-Bildschirm
- Keine Backend-API, keine DBV-Scraper und kein Tracking
- Servicworker für Offline-Verfügbarkeit der Oberfläche und kuratierter historischer Daten
- Tests: `node tests/validate.mjs && node tests/history.mjs && node tests/trophies.mjs && node tests/bookmarks.mjs`
- Veröffentlichung über `.github/workflows/pages.yml`, bei Änderungen an `main`

## Vereinslogo

Das im Chat am 9. Oktober 2026 freigegebene Original-Schmetterlingslogo der **SpVgg Mössingen Badminton Jugend** ist als optimierte Webgrafik unter `assets/spvgg-schmetterlinge.svg` eingebaut. Ein Test prüft den Hash der Datei gegen die freigegebene Vorlage.
