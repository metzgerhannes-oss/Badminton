# P0 Quellen-Audit – SpVgg Mössingen, 15.10.2026

## Reproduziert (reine Abrufe über GitHub Actions)

- Charlottes bisherige persönliche Badhub-Quellen antworten unter `src=turnier` und `src=liga` jeweils **HTTP 404** (GitHub-Actions-Quellenprobe #38777925879).
- Beide Vereinsberichte zu Ehingen (26.09.) und Friedrichshafen (03./04.10.) sind **HTTP 200** und verlinken auf veröffentlichte DBV-Turnierseiten.
- Die daraus verlinkten DBV-URLs antworteten bei den begrenzten GET-Proben im Runner für Hauptseite, `/matches` und `/draws` durchweg **HTTP 404**. Dies ist eine Aussage zur Erreichbarkeit *aus dem Runner*, nicht zur generellen Sichtbarkeit für Menschen.
- Die alternative öffentliche Badhub-Turnierübersicht zu Friedrichshafen (Quellen-ID `4986`) ist mit **HTTP 200** erreichbar und enthält einen Namenseintrag, aber **0** der vom Einzelmatchimport verwendeten `sp-match-item`- und `sp-set-score`-Nachweise. Sie liefert folglich **keine** belastbaren Einzelresultate.
- Der App-Datenbankzugriff `get_project`, `list_tables` und `execute_sql` auf das **richtige** Badminton-Supabase-Projekt wurde vom verbundenen Zugang mit `You do not have permission to perform this action` abgelehnt.
- Der ergänzte separate read-only Gruppencheck gegen die bestehenden REST-Tabellen erhält **HTTP 401**, siehe GitHub Actions #38777548689. Daher konnte **keine** aktuelle 13-Profil-SQL-Auswertung durchgeführt werden.

## Fachlicher Zustand

Quelle → Einzelmatchbeleg → kanonischer Datensatz → berechtigte App-Ansicht ist für Charlotte unterbrochen. Die nachgewiesenen Platzierungen und der im Vereinsbericht erwähnte Sieg sind keine Ersatz-Matchkarten: Gegner, Siegzuordnung zum konkret abgeschlossenen Spiel und Sätze fehlen. Keine Schätzung, keine Änderung vorhandener Match- oder Trophäenzahlen. Der 13-Spieler-Gesamtbestand war zuletzt am 14.10. mit **839 Matchbelegen für nur 3 von 13 Profilen** dokumentiert; **kein** erneuter Live-Abgleich möglich.

## Nächster eng begrenzter P0-Schritt

1. Berechtigten **read-only** Zugriff auf das Projekt wiederherstellen, ohne RLS/Public-Zugriffe zu erweitern. Das vorhandene Aggregataudit muss die 13 Profilstatuswerte und gespeicherten Matchbelege vergleichen.
2. Echte offizielle Einzelmatchauslosung für die beiden belegten Turniere in einem lesbaren Format erhalten (offizieller Export oder dokumentierte freigegebene Quelle). Erst den konkreten Aufbau prüfen; danach einen engen Quellenadapter implementieren.
3. Gespeicherte Einzelspiele auf Identität, Matchart, Sieger, gültige Satzstände, Freilos und Dubletten prüfen. Nur echte Belege übernehmen; alle 13 Vereinsprofile danach gegen Quelle, Datenbank und App-Ausgabe testen.
4. V1 nicht als fachlich vollständig abnehmen, bevor die echten Daten und der Leseweg nachgewiesen sind. Keine neue Funktion, kein Redesign, kein Security-Ausbau.

Die Skripte dieser isolierten Untersuchung sind ausschließlich diagnostisch. Sie sind **keine** Implementierung eines vollständigen Matchimports und nicht zur Freigabe vorgesehen.

## Nachtrag 15.10.2026: ChatGPT-Supabase-Zugriff wiederhergestellt

Der frühere Befund „keine Berechtigung“ war ein Fehler der Kontoauswahl, **kein dauerhafter Badminton-Projektfehler**. Unter ChatGPT sind zwei verbundene Supabase-Konten erreichbar: **„Supabase“** enthält nur Johannas Gartenwelt, **„Backup“** enthält das korrekte Projekt `yadexibmjmnjfmfabrug`. Alle Datenbankabfragen müssen explizit die Badminton-Verbindung wählen.

Direkt geprüft: 13 registrierte Vereinsprofile, 839 externe Matchkarten nur bei 3 Profilen, 85 Turnierplatzierungen, 60 davon Top 4. Charlotte: 2 Platzierungen, 0 Einzelmatchkarten, Importstatus `awaiting_source`. Die Datenbank ist erreichbar und es fehlen tatsächlich Quellkarten – der bisherige 401-Fehler im anonymen CI-Audit war keine Aussage über den direkten Supabase-Connector.

**Weiterer P0 Datenfehler**: In den 839 Karten stecken widersprüchliche K.-o.-Rundenzuordnungen; die 703/74/62 Rohkartenzahlen dürfen nicht pauschal als korrekte Karriere-Spielanzahl veröffentlicht werden. Vorläufiger konservativer Quarantänefilter für unverifizierte Turniergruppen in separatem PR #246. Keine automatischen Zahlenkorrekturen und keine Quellkarten gelöscht.
