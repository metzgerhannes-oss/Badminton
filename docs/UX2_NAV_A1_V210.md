# UX2 A1 · vier stabile Hauptziele (v210)

**Stand:** PR-Änderung; technisch veröffentlicht erst nach vollständigen SHA-identischen PR-/Main-/Pages-Gates.

- Mobile Tab-Bar: Start · Spieler · Turniere · Teams. Der zusätzliche Verein-Eintrag bleibt Desktop-only.
- `#live` bleibt als bisheriger Deep Link erreichbar, aber der **rote Heute-Kontextlink** wird ausschließlich bei quellengestützt angesetzter/belegter Begegnung angezeigt. Der Kontextlink liegt **außerhalb** der unteren Hauptnavigation und verändert nie die vier Breiten. Die vorhandene Home-/Turnier-Ereignisvorschau bleibt erhalten.
- `#berichte` ist weiter eine eigene kompatible Route; Spieler und Teams verlinken jetzt direkt dorthin, ohne eine fünfte Tab-Position zu beanspruchen.
- `#historie`, `#verein`, `#spiele` (bewusst versteckte Spielecke-Einstiege), Einstellungen-Deep-Links, Profile und Favoriten bleiben unverändert.
- Keine neue Netzverbindung, keine Supabase-/RLS-/Einladungsänderung, keine Speicherung/Löschung.
- Regression: vier mobile Tabs bei 320/390 px und mit bestätigtem Heute, Heute -> #live -> Start, Kontextberichte, Desktop Verein, Router-Aktivzustand, CSS und offline PWA Release-Cache.
- Folgende UX2-Pakete bleiben eigenständig: IA B (CD Designsystem), C (Spieler-/Turnierwege), D (Desktop-Workspace), E (Gesamtabnahme). Corporate Design unverändert.

Referenzen: Issue #13, docs/PROJEKTBESCHREIBUNG_UX_REDESIGN_2026-10-25.md, F00–F11 Master #176.
