# IA-5 / v186 – Navigations-QA der Einstellungen

Stand: 22.10.2026 · #13 · eine gemeinsame Schlussabnahme statt manueller Zwischenabnahmen.

Die fünf bestehenden Einstellungen und „Alle Einstellungen“ wechseln die sichtbare Ansicht sofort, ohne auf das verzögerte iPhone-WebKit-`hashchange` zu warten. Browser-Zurück/-Vorwärts, Lesezeichen, Tastatur und Deep Links bleiben erhalten. Nur bekannte Zielräume sind zulässig. Keine neue Profil-/Freundesverwaltung, kein Datenbankzugriff, keine Berechtigungs- oder Farbänderung.

Automatische Tests: `tests/navigation-ia5-v186.mjs` prüft Quell-/Sicherheitsinvarianten; `tests/e2e/navigation-ia5-v186.spec.mjs` prüft 320/390/1280/1440/1920 Pixel, Chromium/WebKit, verlorene Hashchange-Ereignisse, Touchziele, Browser-Historie, Tastatur sowie unveränderte Familien-/Freundesdaten. Alle Tests bleiben durch die bestehende Supabase-Netzwerksperre isoliert.

Releasebedingung: PR-Tests am aktuellen SHA, danach Merge und Main-CI samt Pages-Deployment am Merge-SHA erfolgreich; keine manuelle Zwischenabnahme. Die reale iPhone-/Desktop-Bedienung wird erst auf der gemeinsamen Schlussabnahme-Todoliste geprüft.
