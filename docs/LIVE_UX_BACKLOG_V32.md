# Backlog-Abgleich: Live-Radar sinnvoll integrieren – v32

Stand: 10.10.2026. Ziel: **Live & Turniertag als klarer Nutzerweg**, statt mehrere gleichrangige Quellen-/Link-/Matchbereiche. Bestehende Daten, Home-Rücksprung und die sechs Hauptreiter bleiben erhalten.

## Verbindlicher Nutzerweg

| Ort | Hauptaufgabe | Hauptaktion | Ausgeblendet/sekundär |
|---|---|---|---|
| **Home** | Eigenes Spielerprofil und Rankings | Wenn ein maximal 2 Minuten alter Quellstand **tatsächlich** eine laufende, aufgerufene oder nächste Begegnung meldet: hervorgehobener Klick auf den Turniertag | Bei keinem Turnier, fehlendem oder altem Cache erscheint kein irreführendes „Live“-Banner und kein ständig leerer Block |
| **Turniere** | Aktueller Turniertag | Direkt am Kopf „Wen möchtest du verfolgen?“ mit eigenen Profilen und gefolgten Freunden. Wechsel bleibt **in der Turnieransicht**. Darunter echte Spiele, Wartestand, Feld, Gegner, Satzstände | Badhub-/externe und eigene offizielle DBV-Einzelnachweise liegen unter **Originalquellen & weitere Ergebnisse** |
| **Turniere → Meine gespeicherten Turniere** | Offizielle Turnierfavoriten pflegen | Ein „+ Turnier“-Knopf, offizielle Turnierlinks bearbeiten, DBV-Kalender öffnen | Kein zweiter Hauptbereich „Meine Turnierlinks“ oberhalb des Live-Radars |
| **Spieler** | Spieler finden/folgen | Spielerbibliothek mit Vereins-/Altersklassenfiltern | Keine Parallelverwaltung von Freunden innerhalb des Live-Radars; nur Link „+ Spieler suchen und folgen“ |
| **Historie** | Vergangene belegte Leistungen und Quellen | Turnierchronik/Karriere/Statistik nach bestehender Logik | Keine Live-Satzstände als historische Siege verbuchen |
| **Home** | Zu mir | Home in Navigation/Logo setzt immer auf **aktives eigenes Spielerprofil** zurück | Wechsel zu befreundeten Spielern in Turniere ändert nicht heimlich dieses Rücksprungverhalten |

## Quelle, Aktualität und Abfragekosten

- Der eigentliche öffentliche Badhub-JSON-Abruf wird **nur auf dem serverseitigen Supabase-Worker** für aktiv betrachtete DBV-IDs durchgeführt (wie bisher; maximal sechs pro Minute). Das Frontend nutzt nur die gemeinsame Snapshot-Tabelle.
- Der Live-Radar fragt nur bei geöffneter Turnieransicht aktiv an. **Auf Home wird höchstens ein bereits vorhandener Cache gelesen, nie ein neuer Beobachtungsauftrag erzeugt.**
- Der Home-Hinweis verwendet denselben Validator wie die Turnieransicht: Maximal 2 Minuten alter Quellstand. Ein Badhub-Turnier allein ohne veröffentlichte Begegnung wird nicht zur „Live“-Benachrichtigung.
- Die zuvor parallel zum Live-Radar auch geschlossen im Hintergrund laufende DBV-REST-Abfrage ist jetzt **nur noch beim Aufklappen der Zusatzbelege aktiv**. Nach dem Schließen darf ein alter Request den Refresh-Button nicht blockieren.
- Badhub kann den eigenen Teamindex als Zahl `0/1` oder Booleschen Wert melden. Beides wird korrekt interpretiert. Ein Feld `next` ohne eindeutig bekannte `queue_position` wird nicht als „Als Nächstes“ ausgegeben.
- Keine erfundenen Turniere, Sieg-/Niederlagenzahlen, Spielzeiten oder Satzstände. Badhub als Quelle und Abgleichzeit werden angezeigt; das Quell- und Weiterverwendungsrecht ist weiterhin einzuhalten.

## Backlog-Status

- **Issue #13 – Frontend und Menülogik:** Teilpaket **Live/Turniertag-Nutzerweg umgesetzt**: direkte Profilauswahl, keine zusätzlichen Hauptreiter, ein Haupt-Refresh, opt-in-DBV-Details. Die umfassende Bereinigung aller weiteren verschachtelten Wege bleibt offen.
- **Issue #8 – Finales App-Design:** Turnieransicht und Home-Hinweis an hellblaues v2-Design und mobile Touch-Ziele angepasst. Praktische iPhone-/Android-Sichtprüfung und breitere UX-Abnahme bleiben offen.
- **Issue #17 – echter Live-Datenfeed:** Die vorhandene, öffentlich abrufbare Badhub-Quelle wird jetzt sinnvoll im Frontend verwendet. Offen bleiben Prüfung an einem echten Turniertag mit Halbzeit-/Satzwechsel, Badhub-/DBV-Abdeckung, Nutzungsrechte und historische Einzelmatchimporte.
- **Issue #6 – Spielstatistik:** Die Korrektur für `0/1`-Seiten im Live-Datenmodell darf **nicht** automatisch zu einer Karriere-Siegquote aus laufenden/beleglosen Spielen führen.

## Qualität / Abnahme

Automatisierte Regression in `tests/live-hub.mjs` für IDs, Reihenfolge und Eindeutigkeit der Bereiche, sechs Navigationsreiter, korrektes Home-Zurück, aktives eigenes/Freundesprofil innerhalb des Turniertags, nur frische Home-Hinweise, bedarfsgesteuerten DBV-Zusatzfeed und Quelle/Satz-/Queue-Regeln.

Offene manuelle Sichtprüfung: iPhone SE (kleiner Bildschirm), ältere Safari-Version/PWA-Cache und ein echter Turniertag mit Einzel/Doppel, Aufruf, Live-Sätzen und Ende. CI ist kein realer Gerätetest.
