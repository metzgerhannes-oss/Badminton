# Berichte, Spielererwähnungen und Medienquellen

Stand: **10. Oktober 2026**. Erweiterung von [Datenquellen-Priorität](DATENQUELLEN_PRIORITAET.md) und [Supabase-Backend](SUPABASE_BACKEND.md).

## Funktion und Datenherkunft

Im fünften Navigationseintrag **Berichte** sieht man veröffentlichte Artikel über das aktuell ausgewählte Spielerprofil. Die Liste enthält **Originalüberschrift, Erscheinungsdatum (falls bestätigt), Website/Quelle, eigene Kurzeinordnung und Link**. Der Originalartikel verbleibt beim Verlag oder Verein. Es wird weder das urheberrechtlich geschützte Volltextmaterial kopiert noch versucht, Bezahlschranken zu umgehen.

Zwei Modi:
- **Spielererwähnungen**: Der volle Name muss ausdrücklich auf der öffentlich geprüften Quellseite nachgewiesen sein. Artikel werden über `article_player_mentions` der öffentlichen DBV-Spieler-ID zugeordnet.
- **Berichte zum Verein**: Weitere Artikel aus dem gleichen Verein, auch wenn darin die ausgewählte Person nicht genannt wird. Nur aktiv, wenn das Spielerprofil den dazugehörigen Verein besitzt.

## Startbestand

- **17 Quellen** in `data/report-sources.json` und `public.report_sources` – verifizierte Websites und weitere **Recherchekandidaten** sind klar getrennt.
- **15 Artikel** in `data/report-articles.json` und `public.articles`, davon **14 persönlich zugeordnete** und **ein allgemeiner Verbandsbericht**.
- **16 belegte Person-Artikel-Verknüpfungen**: 14 für Philipp (`05-070879`), zwei für Charlotte (`05-071969`).
- Die Berichte stammen bislang insbesondere von **SpVgg Mössingen**, **BWBV** und **Aalener Sportallianz**.
- Die Pressequellen **Schwäbisches Tagblatt, Reutlinger General-Anzeiger, Südwest Presse, SWR, Schwäbische Zeitung, Sportschau** sowie **Stadt Mössingen** sind **nur Suchkandidaten**. Solange ein persönlicher Treffer nicht geprüft ist, gibt es auch keine Personen-Verknüpfung und keinen fiktiven Artikel.

Die jeweils aktuellen Zahlen stammen aus der manuellen Erstbefüllung am 10.10.2026 und sind **keine Aussage über die gesamte Berichterstattung**.

## Stammdaten – Verein

Die Postgres-Tabelle `public.clubs` enthält die verifizierte **Sportvereinigung Mössingen 1904 e.V.** mit Website und Badminton-Abteilungslink. `public.players.club_id` referenziert den Vereins-Datensatz und `players.club` bleibt aus Kompatibilitätsgründen der lesbare Name. Philipp und Charlotte sind mit dem Verein verknüpft.

Im aktuellen Browser-PWA-`app.js` ist `club` Teil jedes eigenen/fremden Spielerprofils, im Bearbeitungsformular und Profilkopf sichtbar. Vorhandene lokale Profile und Turnierfavoriten bleiben erhalten. **Keine automatische Synchronisierung** lokaler Vereinsänderungen zum offiziellen DBV-/Supabase-Stammdatensatz erfolgt ohne ausdrücklichen Abgleich.

## Datenqualität und weitere Recherche

Bei neuem Artikel:
1. Prüfe vollständige Veröffentlichungs-URL, tatsächlichen Titel, Veröffentlichungsdatum oder setze Datum auf NULL, wenn unbestätigt.
2. Prüfe in der **Artikel-Hauptaussage**, nicht nur in „Weitere Beiträge“, die wirkliche Namensnennung. Personenverlinkung nur bei eindeutigem Match.
3. Verknüpfe Artikel, Quelle und ggf. Verein und betroffene Spieler-UUIDs. Artikel-URL ist eindeutig; derselbe Artikel darf mehreren Spielern zugeordnet sein.
4. Aktualisiere SQL-Daten und die beiden wiederholbaren JSON-Register.
5. Keine automatischen Zufallssuchen, Vermutungen aus Ergebnislisten oder unbestätigte Aussagen im Nachrichtenarchiv.

Aktuell wird der Anfangsbestand nicht periodisch importiert. Für eine automatische Aktualisierung ist eine serverseitige, quellenkonforme Discovery-Pipeline mit exakten Titel/URL-Abgleichen und Freigabe für unklare Treffer nötig. Eine Suchmaschine ist nicht gleichbedeutend mit einer frei zugänglichen Artikel-API.

## Datenbank / Schutz

- `report_sources`: Kategorie, Quellenname, Start-/Index-URL, Recherche-/Verifikationsstatus.
- `articles`: geprüfte Überschrift, Quell-URL, bestätigtes Datum oder NULL, eigene Kurzbeschreibung und Vereinsreferenz.
- `article_player_mentions`: eindeutige Zuordnung über Spieler-ID, `explicit_name` und Prüfdatum.
- Alle drei Tabellen haben aktiviertes RLS, öffentliche Rollen nur SELECT. Schreibrechte bleiben vertrauenswürdigen Imports vorbehalten.
- Die Anzeige lädt die geprüften Artikel und Quellen via Supabase-REST mit einem **publishable API key** und filtert anhand der DBV-ID. Persönliche Kinderprofile aus localStorage werden dafür nicht an externe Medien gesendet.

## Offene Punkte

- Kontinuierliche Recherche in lokalen Medien und auf weiteren Vereinsseiten.
- Authentifizierter Elternbereich für die manuelle Aufnahme neuer Artikel und Korrekturen mit Prüfung.
- Optional eine wöchentliche quellengebundene Aktualisierung, getrennt von der bestehenden Ranglistenversorgung.

## Automatischer Quellenabgleich (ab 10.10.2026)

**Täglich um 06:17 UTC** sowie bei Änderungen am Monitor prüft GitHub Actions die Quellen über [report-discovery.yml](../.github/workflows/report-discovery.yml). GitHub kann geplante Läufe verzögern. Manuelle Ausführung: **Actions → Reportquellen automatisch prüfen → Run workflow**.

Der Monitor folgt nur ausdrücklich freigegebenen, öffentlich zugänglichen Artikelübersichten im [Quellenregister](../data/report-sources.json). Start: SpVgg Mössingen/Badminton und BWBV Jugend. Die 15 weiteren registrierten Quellen sind zunächst nicht für den automatischen Abruf freigegeben. robots.txt wird beachtet; Paywalls und Cookie-/Login-Seiten werden nicht umgangen.

**Entdeckung und Freigabe:**

1. [discover-reports.py](../scripts/discover-reports.py) erfasst URL, Titel, optional Veröffentlichungsdatum und eine potenzielle Spieler-ID nur bei einem vollständigen Namensfund im **Artikelkörper**, nicht in der Seitennavigation. Allgemeine Vereinstreffer bleiben ohne Spielerbezug.
2. Bereits veröffentlichte und offene Links werden nach normalisierter URL dedupliziert (einschließlich www und abschließendem Slash).
3. Neue Ergebnisse werden in [report-pending.json](../data/report-pending.json) **nur auf einem Bot-Zweig** abgelegt. Der Workflow legt dazu einen GitHub-Pull-Request für menschliche Prüfung an oder aktualisiert ihn. Kandidaten erscheinen nicht in der App.
4. Die Originalquelle muss vor Veröffentlichung redaktionell geprüft werden. Danach kann man einen Kandidaten im Arbeitszweig so übernehmen:

    python3 scripts/approve-report.py --url "https://beispiel.de/artikel" --players 05-070879 --confirm-original

    Für allgemeine Vereinsberichte ohne Namensnennung:

    python3 scripts/approve-report.py --url "https://beispiel.de/vereinsmeldung" --club-only --confirm-original

5. Nach Merge des freigegebenen [Artikelregisters](../data/report-articles.json) ist der Artikel im PWA-Berichtebereich sichtbar. Der öffentliche JSON-Feed wird URL-basiert mit bisherigen Supabase-Berichten zusammengeführt, ohne Supabase-Service-Key im Browser. Neue geprüfte Berichte sind **zunächst nur im GitHub-Artikelregister** gespeichert, nicht automatisch in Supabase.

Es werden keine vollständigen Presseartikel, geschützten Inhalte oder unbelegten Behauptungen kopiert. Ein automatischer Name-Fund ist noch keine redaktionelle Freigabe.

**GitHub-Berechtigung:** Falls der Bot keine Pull Requests erstellen darf, muss im Repository unter **Settings → Actions → General → Workflow permissions** das Erstellen von PRs durch GitHub Actions zugelassen sein. Der Workflow gibt andernfalls einen Fehler aus.

Der Monitor ist kostenfrei und nutzt keine KI-API. Die Vollständigkeit hängt von öffentlichen Quellen und deren Zugriffsregeln ab. Eine breite Echtzeitüberwachung der kommerziellen Presse ist damit noch nicht eingerichtet.
