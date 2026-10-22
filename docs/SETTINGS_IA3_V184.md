# IA-3: Einstellungen v184 – fünf eindeutige Bereiche

Stand: 22.10.2026 · Umsetzung nach v183-Abnahme; Issue #13.

## Navigation
Die Einstellungen enthalten genau fünf direkt erreichbare Räume, in folgender Reihenfolge:

| Route | Titel | Einmaliger Funktionsort |
|---|---|---|
| `#einstellungen/profile` | Profile & Familie | Eigene Kinder-/Familienprofile, Standardprofil und Profilwechsel |
| `#einstellungen/darstellung` | App & Darstellung | Sprache, Vereinsname, Logo und Farben |
| `#einstellungen/einladungen` | Zugänge & Freigaben | Einladungslinks, servergeprüfte Betreiber-/Spielerberechtigungen, Eigentümeraktivierung, lokale Einladungsübersichten |
| `#einstellungen/daten` | Daten & Datenschutz | Gerätebackup, Wiederherstellung nach Bestätigung, Datenschutzinformationen |
| `#einstellungen/hilfe` | Hilfe & Informationen | Installationsanleitung, Badminton-Wiki, Datenquellen und Belege |

**Außerhalb** der Einstellungen: Freunde folgen/entfolgen/sortieren ausschließlich unter `#spieler`, Mannschaften unter `#mannschaft`. Keine zweite Verwaltungsoberfläche in den Einstellungen.

## Abwärtskompatibilität
- `#einstellungen/spieler` → `#spieler`
- `#einstellungen/mannschaften` → `#mannschaft`
- `#einstellungen/quellen` → `#einstellungen/hilfe`
- Die anderen bereits genutzten Raum-Hashes bleiben identisch.
- Alle vorhandenen Formular-IDs, lokale Speicherkeys, Profildaten, Einladungen, RPCs und Berechtigungsprüfungen bleiben unverändert. Navigation erzeugt keine produktiven Anfragen.

## Prüfgates
1. `node tests/settings-ia3-v184.mjs` (CI obligatorisch).
2. Playwright Chromium und WebKit: fünf Bereiche, alle vorhandenen Formulare, Altlinks, gespeicherte Kinder- und Freundeslisten, Home-Navigation und 320/390/1280/1920 px ohne Überlauf. Nur synthetische Fixtures, Supabase-Sperre.
3. Bestehende Gesamt-CI und Release-/Service-Worker-Prüfungen, anschließend Main-CI und Pages.
4. Reale manuelle iPhone- und Desktop-Abnahme v184 vor IA-4.

## Nicht Bestandteil von IA-3
Kein Umbau der Einladungsberechtigungen, keine neue DBV-Volltextsuche, kein neuer Datenimport, keine Änderung der RLS oder produktiver Daten und keine Änderung des dunkelblauen freigegebenen Layouts.
