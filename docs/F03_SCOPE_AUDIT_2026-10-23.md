# F03 – Berechtigungs- und Such-RPC-Abgleich (23.10.2026)

## Umfang und Beleglage

Codebasis: `main` vor diesem PR, SHA `5ee7a0940978ab07909df791d04a840060e8dca3`.
Dieses Audit bewertet **eingecheckte Verträge und ausschließlich synthetische Browser-Fixtures**.
Es ist **kein** unabhängiger Readback der produktiv installierten SQL-Funktionen,
kein echter Geräte-/VoiceOver-Test und keine externe Quellenrechtefreigabe.

- `app-access.js`: Eine angenommene Spielerfreigabe wird beim App-Start
  serverseitig über `private_player_access_read` geprüft; der begrenzte
  Player-Shell-Zugang setzt `badmintonAppAccess.allowed` **nicht** auf `true`.
- `scripts/private-match-source.mjs`: Nur ein lokal gebundener Einladungsbeleg
  kann den scoped `private_player_archive_read`-Pfad anstoßen. Der Server muss
  auf **jeder** Seite Spieler, Empfänger, Aussteller-Grant, Scope und Widerruf
  prüfen. Lokales Folgen oder ein DBV-ID-String ist kein Grant.
- `scripts/private-trophy-source.mjs`: Die Annahme-ID ist der einzige
  Spielerlink-Pfad zu `private_player_trophies_read`; ein fehlender oder
  widerrufener Grant liefert keinen berechtigten Trophy-Snapshot.
- `database/private_rpc_invoker_hardening_v127_1.sql` prüft im privaten
  Trophy-Handler `accepted_by=auth.uid()`, `scope_version=2`,
  `granted_sections` mit `trophies`, aktiven Grant und Widerruf.
  Ein öffentliches `SECURITY INVOKER`-RPC delegiert an diesen privaten Handler.
- `database/private_player_accept_once_v116.sql`: sieben Tage gelten
  für die **Annahme**, nicht als automatisches Ende einer angenommenen Freigabe.
  Widerruf, Sitzungsbindung und aktiver Aussteller-Grant bleiben erforderlich.
  Die tatsächliche Produktionsinstallation muss separat abgeglichen werden.

## Neu hinzugefügter Browser-Vertrag

`tests/e2e/f03-v2-scope-contract.spec.mjs` prüft mit rein fiktiven Daten:
gültige angenommene v2-Freigabe für genau einen Spieler (Match/Trophäe),
keine globale App-Mitgliedschaft, fremde Spieler-ID, v1 ohne v2-Umfang,
serverseitigen Widerruf und einen Browser ohne übertragene Auth-Sitzung.
Die Antwort des simulierten Servers wird explizit je Fall begrenzt:
ein bestandener Mock-Test **beweist nicht**, dass produktives RLS genauso
konfiguriert ist. Keine echte Supabase-Anfrage; Proxy, Service-Worker-Sperre
und isoliertes Route-Fallback bleiben verbindlich.

## #327 – öffentliche DBV-Suche: offener Missbrauchsschutz

`database/targeted_dbv_identity_search_v133.sql` definiert
`public.search_dbv_player_identity(text,text,text,text)` als
`SECURITY DEFINER` mit leerem `search_path` und bewusstem
`EXECUTE` für `anon`/`authenticated`. Die SQL-Validierung erzwingt
mindestens drei zulässige Zeichen, die Rückgabe ist auf zwölf Zeilen und
fünf Identitätsfelder begrenzt. `verified_at` und
`last_ranking_week` sind Pflichtfilter. Es gibt in **dieser
Funktionsdefinition** aber **keine nachweisbare serverseitige
Anfragefrequenz- oder Kontingentbegrenzung**. Clientseitiges Debouncing,
Zeichenminimum und Trefferlimit verhindern automatisierte Enumeration
nicht zuverlässig. Die reale Funktionsdefinition, Eigentümerrolle,
Ausführungsrechte, Schutzschichten und eventuelle Infrastruktur-Quoten
sind vor einer fachlichen Freigabe read-only im Badminton-Projekt zu
verifizieren. Keine anonyme Sperre ohne Prüfung des legitimen
registrierungsfreien Such- und Profilanlagepfads.

## Noch offene Gates

- Positiver/negativer **serverseitiger** Scope-/RLS-/EXECUTE-Readback
  (nur autorisiert, Badminton-Projekt, ohne Datenänderung).
- Nachweis oder Einführung eines wirksamen verhältnismäßigen
  serverseitigen Suchquoten-/Abuse-Limits (#327), ohne neue Pflichtanmeldung.
- Echte iPhone-Safari↔PWA-/Desktop-/VoiceOver-Abnahme erst gemeinsam in F11.
- F02/#56 Betreiber-, Datenschutz- und Quellenrechte bleiben extern offen.
