# v79 – eigener LIVE-Reiter am Turniertag

Stand: 11. Oktober 2026.

## Produktverhalten

- Normaler Tag: unveränderte vier Hauptreiter `Home · Turniere · Spieler · Berichte`.
- Turniertag: zusätzlich ein farblich hervorgehobener Reiter `LIVE` zwischen Turniere und Spieler (fünf mobile 44px+-Ziele ab 320px Breite).
- Auslöser A: Mindestens ein gespeichertes lokales Turnier mit gültigem Start-/Enddatum umfasst den heutigen **Kalendertag in Europe/Berlin** und ist einem eigenen Spieler oder allen Spielern zugeordnet. Auch andere eigene Profile als das gerade ausgewählte zählen. Gefolgte Spieler erhalten keine fremden privaten Turnierlinks.
- Auslöser B: Für den aktuell betrachteten DBV-Spieler liegt eine frische, validierte öffentliche Badhub-Turniermeldung im vorhandenen Supabase-Snapshot vor. Der Home-Teaser und der bereits bestehende Live-Radar melden das per lokalem UI-Event; kein weiteres Badhub-Polling wird aktiviert.
- Bei verstrichenem Turnierdatum und ohne bestätigte aktuelle Quelle wird der Reiter automatisch ausgeblendet. Die lokale Datumsprüfung erfolgt einmal pro Minute, ohne Netzwerkabruf.
- `#live` ist ein eigener Navigationszustand, aber dieselbe Live-Radar-Komponente und dasselbe Supabase-Cache-Reading wie bisher. Bei `#live` werden gespeicherte Turnierlinks ausgeblendet und über den übersetzten Rückweg `Turniere` erreicht. `#turniere` bleibt als bisheriger Einstieg und Deep-Link kompatibel.
- Home-Live-Vorschau führt direkt zu `#live`. Die Profilwahl auf dem LIVE-Reiter bleibt auf `#live` und zeigt eigene und gefolgte DBV-Spieler.
- Direkte `#live`-Links sind lesbar, selbst wenn der Nav-Reiter mangels bestätigtem Turniertag ausgeblendet wird (Fallback über Turniere). Es wird weder ein Spielstand simuliert noch eine Quellenfrische zugesichert.

## Daten- und Datenschutzgrenzen

Keine neuen Tabellen, Beobachterlisten, Accounts oder automatischen Anbieterabfragen. Es werden nur bestehende öffentliche DBV-IDs im vorhandenen Live-Worker benutzt. Ein gespeicherter Turniertermin beweist **nicht**, dass ein Match gerade läuft: Der Radar benennt fehlende oder veraltete Live-Daten weiterhin ausdrücklich.

## Abnahme

- `tests/tournament-bookmarks.mjs`: lokale Berlin-Datumsgrenzen, eigene gegen fremde Spieler, mehrtägiges Turnier.
- `tests/router.mjs`: LIVE-Route als eigener Navigationszustand, aktive Tab-Markierung, Fallback bei unsichtbarem LIVE-Reiter.
- `tests/e2e/matchday-live-tab.spec.mjs`: fünf Tabs auf iPhone SE bei Termin, Direktnavigation, Profilwechsel, Rückweg und vier Tabs nach Ablauf.
- Vorbestehende Browser-Tests prüfen weiter den normalen vierteiligen Standardzustand und das bisherige Turnier-Radar.

Eine reale Abnahme mit laufender Begegnung und tatsächlicher Anbieter-Aktualisierung steht gesondert aus.
