# DBV-Live: Datenzugang und Inbetriebnahme

**Stand 09.10.2026: Datenadapter integriert, DBV-Liveabruf noch nicht freigegeben.** Eine dokumentierte öffentliche DBV-Turnier-API mit Live-Matches/Feldern wurde nicht bestätigt. Daher gibt es bewusst keinen HTML-Scraper.

## Sofort nutzbar

App → **Turniere** → **+ DBV-Turnier verlinken**. Spieler auswählen und einen Link zu `https://dbv.turnier.de/tournament/...` hinterlegen. Die Startseite öffnet dann den echten offiziellen Live-Spielplan direkt. Dies ist eine Verknüpfung, noch kein automatischer Datenimport.

## Automatische Ergebnisse nach Datenfreigabe

Erforderlich ist eine vom Anbieter oder Veranstalter genehmigte **JSON- oder CSV-Quelle** zur Weiterveröffentlichung von Spielansetzungen, Feldern und Ergebnissen. Betreiber: Visual Reality / Tournament Software, `info@tournamentsoftware.com` bzw. `helpdesk@tournamentsoftware.com`. Für Daten minderjähriger Spieler sollten die Nutzungs- und Datenschutzbedingungen ausdrücklich geklärt sein.

### GitHub-Konfiguration

Repository → **Settings → Secrets and variables → Actions → Variables**:

| Variable | Wert |
| --- | --- |
| `BADMINTON_FEED_URL` | HTTPS-Adresse der freigegebenen Datenquelle |
| `BADMINTON_FEED_AUTHORIZED` | `true` erst nach bestätigten Nutzungsrechten |
| `BADMINTON_FEED_FORMAT` | `json` (Standard) oder `csv` |
| `BADMINTON_PLAYER_IDS` | `05-070879`, ggf. zusätzliche IDs per Komma |
| `BADMINTON_PUBLIC_SOURCE_URL` | Öffentliche Turnierseite, keine vertrauliche Feed-URL |

Optional **Actions → Secrets**: `BADMINTON_FEED_TOKEN` als Bearer-Token. Nie in Client-JavaScript oder öffentliches JSON eintragen.

Workflow: `.github/workflows/pages.yml`. Manuell über Actions → Schmetterlinge Pages → Run workflow auslösen oder auf den planmäßigen Lauf warten. Nach Einrichtung aktualisiert GitHub Actions alle ca. fünf Minuten, der Browser prüft alle 60 Sekunden auf neue Snapshots. Schedules sind nicht sekundengenau. **Near-live statt direkter Punkt-für-Punkt-Übertragung.**

Die Daten werden auf ausdrücklich zugelassene Spieler-IDs gefiltert, um nicht ganze Jugendturniere in das öffentliche GitHub-Repository zu spiegeln. Ohne Spieler-ID-Zuordnung wird ein Match nicht veröffentlicht.

### Normalisiertes JSON

Pflichtfelder: Root `tournaments` (Array), `matches` (Array). `updatedAt` als ISO-8601-Zeitstempel mit UTC-Offset. Jedes Turnier braucht `id`, `name` und vorzugsweise `startDate`, `location`, `url`. Jedes Match braucht `id`, `tournamentId`, `playerIds`, `players`, `status` sowie optional `scheduledAt`, `court`, `discipline`, `score`, `url`.

Statuswerte: `scheduled`, `ready`, `called`, `live`, `finished`, `delayed`, `cancelled`. `called` nur bei bestätigtem Aufruf, nicht automatisch aus der Uhrzeit errechnen. Geplante Spielzeiten nur als ISO-8601 mit Zeitzonenoffset.

### CSV-Export

Spalten (Semikolon oder Komma):

```csv
matchId;tournamentId;tournamentName;tournamentLocation;tournamentDate;discipline;scheduledAt;court;status;players;playerIds;score;url;tournamentUrl
m001;t001;TESTTURNIER;Mössingen;2026-10-09;Jungeneinzel U11;2026-10-09T14:30:00+02:00;4;Geplant;Philipp Metzger | Beispielgegner;05-070879 | 05-123456;;https://dbv.turnier.de/tournament/BEISPIEL;https://dbv.turnier.de/tournament/BEISPIEL
```

**Beispiel ist synthetisch und wird niemals als Live-Daten ausgeliefert.** `|` trennt die Spieler und IDs. Falls ein Veranstalter anders benannte Spalten liefert, wird die Zuordnung anhand eines echten Musters angepasst.

### Technische Grenzen

- Daten mit fehlendem oder altem Aktualisierungszeitpunkt werden als veraltet dargestellt.
- Bei API-Ausfall werden keine neuen Ergebnisse erfunden.
- Direktes DBV-Scraping und Umgehen von Sperren ist nicht implementiert.
- Benachrichtigungen sind nur verfügbar, während die PWA geöffnet ist.
- Änderungen an Spielfeldern/Aufrufen sind ausschließlich mit expliziter Datenlieferung aus dem Turnier nachvollziehbar.

### Konkrete Anfrage an den Betreiber

Für eine nichtkommerzielle Badminton-Familien-App suchen wir einen autorisierten Lesezugriff auf aktuelle DBV-Turnierspielpläne, Felder, Uhrzeitänderungen, Aufrufe und Ergebnisse für ausgewählte Spieler. Gibt es eine dokumentierte Schnittstelle oder einen freigegebenen Export einschließlich Nutzungsrechten zur Weiterveröffentlichung, Limits, Authentifizierung und eventuellen Kosten?
