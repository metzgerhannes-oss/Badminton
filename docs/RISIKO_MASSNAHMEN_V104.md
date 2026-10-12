# Schmetterlinge – Risiko-Maßnahmen und Betreiberabnahme (12.10.2026)

**Geltungsbereich:** ausschließlich GitHub `metzgerhannes-oss/Badminton` und Supabase `yadexibmjmnjfmfabrug` (Organisation „Badminton“). Das Gartenwelt-Projekt ist ausdrücklich ausgeschlossen. Dieses Dokument protokolliert technische Kontrollen, **ersetzt keine Rechtsberatung und keine geprüfte Datenschutzerklärung**.

## Festgestellte Kontrollen

- Alle 28 bestehenden Tabellen des `public`-Schemas hatten RLS aktiviert; der Supabase Security Advisor meldete keine Befunde. Öffentliche Sportdaten werden bewusst anonyme lesbar gehalten; die privaten Tabellen `user_players`, `user_tournament_links` und `player_publication_grants` sind nicht anonym lesbar.
- Effektive Berechtigungen `TRUNCATE`, `TRIGGER`, `REFERENCES` auf bestehenden öffentlichen Tabellen für `anon`/`authenticated`: jeweils null. Die öffentliche Match-View verwendet `security_invoker=true`.
- **Nicht erledigt:** Default ACL der Eigentümerrolle `supabase_admin` für künftige `public`-Tabellen vergibt noch `arwdDxtm` an `anon` und `authenticated`. Änderungen daran müssen durch eine nachweislich eigentümerberechtigte Administration geschehen. Nicht mit `SET ROLE`, Rechteumgehungen oder einer Testtabelle mit echten Daten experimentieren. Solange offen: keine neuen `supabase_admin`-eigenen Tabellen im exponierten Schema; neu erzeugte Tabellen vor Freigabe explizit `RLS`/Privilegien prüfen.
- Der Badhub-Einzelmatchimport besitzt den service-internen `claim_external_match_import`-RPC: verifizierte ID + tatsächliche Nachfrage, globale Sperre/Leases, pro Spieler zehn Minuten Abstand, 24 neue IDs je 24 Stunden und 36 globale Versuche je 24 Stunden. **Kein echter nutzerbezogener Auth-Nachweis** allein durch Origin-/öffentlichen Key; deshalb Verfügbarkeitsrisiko trotz Limits. Kein Service-Key im Browser.
- Persönliche öffentliche Turnierhinweise (`user_tournament_links.is_shared`) benötigen *restriktive* RLS-Policies für einen Betreiber-/Vereins-/Sorgeberechtigten-geprüften aktiven Grant. Anonyme dürfen weder publizieren noch private Favoriten einsehen. Die Projektion `shared_tournament_hints` enthält keine Auth-User-ID; ein Widerruf löst ihren Neuabgleich aus. Die Freigaben-Tabelle ist zum Prüftag leer. Die Durchsetzung auf echten Nutzergeräten ist vor Pilotbetrieb gesondert abzunehmen.

## P1 · Datenschutz – noch erforderliche Betreiberentscheidungen

1. **Verantwortliche Stelle:** tatsächlichen juristischen Betreiber, ladungsfähige Kontaktangaben und einen nichtöffentlichen Datenschutz-/Rechtekontakt festlegen. Keine Privatadressen oder Beschwerden in öffentlichen GitHub-Issues. In der App erst nach bestätigter Angabe veröffentlichen.
2. **Rechtsgrundlage pro Verarbeitungszweck:** getrennt bewerten: öffentliches DBV-Verzeichnis, Badhub-Belege/Matchpartner, Berichte, nuLiga/Mannschaften, Liveinformationen, Nutzerveröffentlichungen, Geräte-/Serverlogs. Eine öffentliche Quelle ist keine eigenständige Rechtsgrundlage; Kinder-Interessen gesondert abwägen. Art. 6 DSGVO prüfen, bei nicht bei Betroffenen erhobenen Daten Art. 14 beachten; Art. 21-Widerspruch ermöglichen, wo einschlägig.
3. **Rechte an Quellen:** DBV-/Badhub-/nuLiga-Nutzungsbedingungen, robots/Rate-Limits, Datenbankrechte, Einwilligungen oder Lizenzen und automatisierte Abfrage dokumentieren. Keine pauschale Nutzungsfreigabe aus öffentlicher Lesbarkeit ableiten.
4. **Lösch-/Aufbewahrungsmatrix durch Verantwortliche freigeben:** öffentliche Stamm-/Sportdaten (Zweck/Quellenrecht), externe Matchbelege (Nachweis/Korrektur), Live-Caches (kurze Zweckbindung), nachfragegetriebene Importaufträge (keine unbefristete Warteschlange), öffentlich geteilte Turnierhinweise (Widerruf/Veranstaltungsende), private Favoriten (lokaler Gerätebesitz), GitHub-/Supabase-/CDN-Protokolle (anbieterabhängige tatsächliche Fristen). Die technischen *14 Tage Nachfrageaktivität* sind **keine Löschfrist**. Keine willkürlichen Fristen ohne Prüfung behaupten.
5. **Verfahren für Betroffenenrechte:** nichtöffentlicher Eingang, datensparsame Identitäts-/Sorgeberechtigungsprüfung, dokumentierte Eingangsfrist, Quellenabgleich, Entscheidung, gezielte Berichtigung/Sperrung, Nachprüfung nach einem Importzyklus, nötigenfalls Ablehnung mit Begründung. Keine globalen `DELETE FROM players` wegen Fremdschlüssel-`CASCADE` auf gemeinsam genutzten Matchbelegen.
6. **Nutzeroberfläche:** Hinweise zu Anbieter, Zwecken, Quellen, Drittstaatentransfers (sofern einschlägig), tatsächlicher Speicherung, Rechten, Kontakt und Freigabestatus verständlich sichtbar machen. Keine Vollständigkeit der Datenschutzinformation behaupten, solange Entscheidungen fehlen.

**Freigabevorbehalt:** Die Punkte 1–6 müssen der Betreiber bzw. befugte rechtliche Prüfer tatsächlich entscheiden. Die GitHub-Issues #53 und #56 bleiben bis dahin offen.

## P1 · Öffentliche Turnierveröffentlichungen

Vor realer Veröffentlichung durch Dritte prüfen: auf echtem Gerät Anmeldung/Zuordnung, unabhängige Berechtigungsprüfung, Fremdprofil wird abgewiesen, Widerruf entfernt Projektion, private Bookmarks bleiben erhalten, keine falsche Behauptung offizieller Anmeldung, keine Veröffentlichung allein aus Kenntnis einer DBV-ID. Die bestehenden Regeln aus `database/verified-player-publication-v90.sql` bleiben verbindlich. Keine automatischen Grants aus Freitext.

## P2 · Monitoring (ohne neue kostenpflichtige Dienste)

Das **lesende** SQL-Audit `database/operational-health-audit-v104.sql` führt keine DDL, DML, Netzwerkaufrufe oder personenbezogenen Einzelabfragen aus und ist nur für die Supabase-Administration gedacht. Manuell mindestens nach Release bzw. bei Störung prüfen:

- Cron: aktive Jobs, letzte Ausführung, Fehlläufe in 24 Stunden; insbesondere `badminton-live-radar`, Historien- und nuLiga-Jobs. Ein neuer/geplanter Job darf im Beobachtungsfenster noch keinen Durchlauf haben.
- Datenalter: `dbv_calendar_entries.last_seen_at`, fehlgeschlagene externe Matchimporte, abgelaufene Import-Leases, Live-Snapshot-Fehler. Ein leeres Livefenster ist nicht automatisch eine Störung.
- Zugriffsrechte/RLS, Default ACLs, Datenbankgröße als Trend. GitHub Actions Tests, Mobile-QA und Pages-Deployment **pro Release-Commit** separat prüfen; ein älteres grünes CI ersetzt den aktuellen Stand nicht.
- Fehler werden zuerst anhand redigierter Status-/Zeitangaben bearbeitet; keine Kinderprofile, vollständigen Payloads, Zugangsdaten oder Tokens in öffentliche Logs/Issues kopieren.
- Kein kostenpflichtiger Monitoringdienst und keine zusätzlichen Datenbank-Crons erforderlich. Automatische Benachrichtigungen wären ein gesonderter ausdrücklich zu autorisierender Betriebsprozess.

## P2 · Backups / Wiederherstellung

- Offline exportieren: Einstellungen → „Meine Daten sichern“. Gespeichert werden eigene Profile, Freunde und Turnierfavoriten in einer JSON-Datei **auf dem Gerät**; weder die App noch dieses Audit übertragen die Datei in die Cloud.
- Offline wiederherstellen: Datei auswählen, Vorschau kontrollieren, ausdrückliche Ersetzungsbestätigung geben. Beschädigte/doppelte, übergroße und unsichere Links werden abgewiesen. Die vorhandene Testdatei `tests/local-backup.mjs` prüft Export/Import-Roundtrip und die App-Zustandswiederherstellung.
- **Nicht durch den Test bewiesen:** reeller iPhone-Gerätewechsel, Dateiexport auf ein zweites Gerät, Betriebssystem-/Safari-Speicherverlust, Wiederherstellung der produktiven Supabase-Datenbank. Supabase-Free-Plan nicht als garantiertes Managed-Backup ansehen. Datenbank-Sicherungsverfahren mit autorisierten Administratorzugriffen dokumentieren und auf getrennten, datensparsam geschützten Testdaten durchführen; keine Live-Personendaten in ein öffentliches Repository exportieren.

## P2 · Kostenlos / Budget

- Badminton-Organisation bei Supabase am 12.10.2026: **Free**. Gemessene Datenbankgröße am Prüftag etwa **22 MB**; kostenlos heißt nicht unbegrenzt. Projektstatus: `ACTIVE_HEALTHY`.
- GitHub-Repository ist öffentlich; GitHub Actions und Pages bei Änderungen sowie öffentliche Quellenimporte verbrauchen Kontingente. Aktuellen Verbrauch und eventuell eingerichtete Budget-/Spend-Limits ausschließlich in der zugehörigen Betreiberabrechnung verifizieren.
- Cloudflare-Account: Identität wurde ermittelt, aber Cloudflare-Verwaltungsaufrufe lieferten zum Prüftag einen Authentifizierungsfehler. Tarif, Gebühren und Zahlungsmittel **nicht bestätigt**; keine Behauptung „garantiert kostenlos“.
- Keine neuen Dienste oder Paid-Pläne aus dieser Maßnahmenliste aktivieren. Vor Aktivierung neuer Anbieter zuerst echte Konditionen, Limits und Datenschutzfolgen prüfen.

## Operative Abnahme nach Änderungen

- GitHub: zugehörigen Branch/PR, Versionsstand, grünes aktuelles Test-CI und erfolgreiches Pages-Deployment erfassen.
- Supabase: RLS, vorhandene DML-Privilegien und Security Advisor nach jeder DDL-Änderung erneut prüfen. Audit ist lesend; keine Änderungen am Gartenwelt-Projekt.
- Rechte/GDPR/Cloudflare-Account sind **bewusst offen**, solange die dafür notwendigen Eigentümer-/Betreiberbestätigungen fehlen.
