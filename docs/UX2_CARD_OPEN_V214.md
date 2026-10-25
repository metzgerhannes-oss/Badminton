# UX2 v214 · Ganze Kachel als eindeutige Primärnavigation

Verbindlicher Nutzerauftrag am 25.10.2026 nach Screenshot „Meine Turniere“: Tippen auf Kachelfläche oder Titel muss zum Turnier führen, nicht nur der untere Textlink. Die Mechanik wird bei allen *fachlich navigierbaren* Kachelarten vereinheitlicht.

## Verhaltensvertrag
- Freie Kachelfläche hat genau dieselbe Primäraktion wie der bereits vorhandene Detail-/Quellenlink oder Detail-Button. Keine zusätzlichen API-Aufrufe, neuen Details oder unautorisierten Quellenzugriffe.
- Speichern (+/✓), Bearbeiten, Entfolgen, Entfernen, Teilen, Filter und zweiter Berichtlink bleiben eigenständig. Nicht mehrere Klickaktionen aus einem Tipp.
- Für Karten ohne nachgewiesenes Detailziel (z. B. reine Spond-Importzeile, Leermeldungen, geschützte/lückenhafte Quellbelege) **kein** künstlicher Redirect. Wenn eine Linkadresse nur einen DBV-Übersichtskalender bietet, wird diese nicht als konkrete Veranstaltungsseite umbenannt.
- Das bereits vorhandene semantische `<a>` bzw. `<button>` liefert den Tastatur-/Screenreader-Zugang. CSS `.card-open-primary::after` dehnt dessen Hitfläche auf den gesamten Kartencontainer `.card-open-surface` aus. Alle sekundären Steuerelemente liegen über dieser Hitfläche. Kein gefährliches generisches `article.onclick`, keine verschachtelten interaktiven Elemente, kein neues Tracking, kein Scroll-/Zoom-Zwang.
- Gilt für: gespeicherte Turniere; DBV/BWBV-Kalender-Treffer und dokumentierte Turnierhistorie; vorhandene eigene und gefolgte Spielerprofile; Teamkarten; belegte Matches; Live-Spielerkarten; verlinkte Berichte und Einzelwertungen. Schon vollständig anklickbare Home-Turnierrows und Ranking-Karten bleiben unverändert.
- Original-CD, Marken- und Club-Farben, Browser-Zurück/Weiter, PWA/Daten und bestehende Einladungskontrolle bleiben unverändert.

## Automatische Abnahme
Synthetische Chromium-/WebKit-Browserprüfung bei 320/390/1280px: Tap auf **Titelbereich** der gespeicherten Turnierkachel (nicht auf URL-Text) navigiert zur tatsächlichen primären Linkadresse; unabhängiges „Entfernen“ löst keine fremde Navigation aus; generische Primär-/Sekundäraktionen bleiben getrennt; Tastatur Enter und sichtbarer Fokus, Überlaufkontrolle, bestehende E2E- und Sicherheitsregressionen. Keine echten produktiven Supabase-Anfragen. Nach Merge exakte Main-CI und GitHub Pages success abwarten.

**Sequenzielles Gate:** Zum Erstellungszeitpunkt läuft nur der frühere Draft PR #385 zur kostenlosen Pages-Überwachung; noch kein zweiter offener Code-PR für dieses Paket. Nach vollständiger #385 Main+Pages-Abnahme v214 als nächster PR und erst danach Live-Publish.
