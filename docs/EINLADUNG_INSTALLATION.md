# Schmetterlinge: Einladungen teilen und auf iPhone installieren

Stand: 24.10.2026 · v201 · Issue #304. Die Hinweise entsprechen den tatsächlich sichtbaren Bedienelementen. Sie ändern weder Einladungsberechtigungen noch bestehende Profile.

## App-Zugang teilen (nur Betreiber)

1. Öffne **Einstellungen → App-Zugänge einladen**.
2. Wähle **„Einladung erstellen & teilen“**.
3. Teile den erzeugten Link über die geöffnete Auswahl.

Alternativ: **„Einladungslink kopieren“** wählen und den Link in eine Nachricht einfügen. Ein Link kann innerhalb von 30 Tagen angenommen werden; bestehende Berechtigungen bleiben bis zum Widerruf erhalten. Eine App-Einladung gewährt nicht automatisch Rechte, fremde Spielerprofile zu bearbeiten.

## Einladung erhalten

1. Öffne den erhaltenen Einladungslink.
2. Folge der Anleitung für die bestehende oder neue App-Installation.
3. Öffne **Schmetterlinge**.

Ein erfolgreicher Zugang bleibt beim späteren Start erhalten. Kein erneuter Code und keine Pflichtregistrierung. Berechtigungen werden weiterhin serverseitig überprüft und können widerrufen werden.

## iPhone: Schmetterlinge ist schon installiert

1. Öffne den Einladungslink in Safari.
2. Wähle **„Einladung sichern“**.
3. Öffne **Schmetterlinge** über das bereits vorhandene App-Symbol.
4. Nur falls der Zugang noch nicht aktiv ist: Wähle **„Einladung aus Zwischenablage übernehmen“**.

**Keine Neuinstallation** nötig. Der Hinweis bezieht sich auf den tatsächlichen Button der Zugangsseite in `index.html`.

## iPhone: Schmetterlinge zum ersten Mal installieren

1. Öffne den Einladungslink in **Safari**.
2. Wähle **„Einladung sichern“**.
3. Öffne in Safari **„Teilen“**.
4. Wähle **„Zum Home-Bildschirm hinzufügen“**.
5. Aktiviere **„Als Web-App öffnen“**, falls angeboten.
6. Wähle **„Hinzufügen“**.
7. Öffne **Schmetterlinge** über das neue App-Symbol.

Die Einladung wird beim Öffnen geprüft. Wurde der Link nicht vom iPhone übernommen, lässt sich die gespeicherte Einladung einmalig über **„Einladung aus Zwischenablage übernehmen“** annehmen. Nur ein tatsächlicher Berechtigungsnachweis schaltet Daten frei.

## Android und Browser

In Chrome nach Öffnen des Einladungslinks **Menü → App installieren** oder **Zum Startbildschirm hinzufügen** wählen, sofern angeboten. Die Alternative **„Stattdessen nur im Browser verwenden“** nutzt den Browser ohne App-Installation.

## Schutz und technische Regression

- `install-invite.html`: keine PWA-Manifest-Umleitung auf den allgemeinen Start ohne Einladung.
- `index.html` / `invite.js`: exakt beschriftete Teilen-, Kopieren- und Empfangsaktionen.
- `tests/ios-invite-install.mjs` und `tests/e2e/ios-invite-install.spec.mjs`: synthetisch, keine produktiven Supabase-Anfragen, keine echte Einladungsannahme in CI.
- Profil-/Favoritendaten und lokale Berechtigungen bleiben unverändert. Bei erfolgreicher Einladung entsteht kein neues Konto und keine zweite Codepflicht.
- F02 #56: Betreiber-, Datenschutz- und Quellenrechte-Freigabe ist nicht durch diese Anleitung erledigt; reale iPhone-/VoiceOver-Abnahme in F11.

