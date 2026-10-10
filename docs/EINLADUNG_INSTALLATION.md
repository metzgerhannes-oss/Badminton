# Einladungslink, Willkommensseite und Installation

Stand: 10.10.2026. Statische GitHub-Pages-PWA Schmetterlinge ohne Benutzerkonten.

## Einladen

Unter Einstellungen → Familie & Freunde einladen → Einladungslink teilen oder Link kopieren:

https://metzgerhannes-oss.github.io/Badminton/welcome.html

Der Link ist für alle nutzbar; er enthält keine persönlichen Informationen, keine DBV-ID und keinen Zugriff auf die Profile der versendenden Person. Er ist kein Login und erzeugt keine Cloud-Freundschaft.

## Neues Profil

1. Willkommensseite öffnen.
2. Eigenes Spielerprofil anlegen (Name, Jahrgang und Verein) oder die DBV-Spieler-ID bzw. einen offiziellen DBV-Profil-Link angeben.
3. Zusätzlich einen Namen angeben und Profil speichern.
4. iPhone-/Android-Anleitung lesen und die App öffnen.

Eine offizielle DBV-URL mit player-profile/UUID enthält nicht die numerische DBV-ID. Diese wird daher nicht erraten. Verifizierte Ranglisten erscheinen nur, wenn die ID separat verfügbar und importiert ist.

Der neue Spieler wird ausschließlich lokal auf dem Gerät gespeichert. Frühere Profile, Freunde, Turnierfavoriten und Startprofil bleiben erhalten; doppelte DBV-IDs werden abgewiesen. Auf einem frischen Gerät werden keine fremden Spieler automatisch als eigene Profile angelegt.

## Kostenlos auf den Home-Bildschirm

iPhone/iPad: In Safari öffnen. Über Teilen (ggf. Seitenmenü … → Teilen) → Zu Home-Bildschirm hinzufügen → ggf. Als Web-App öffnen → Hinzufügen. Apple: https://support.apple.com/guide/iphone/iphea86e5236/ios

Android: In Google Chrome öffnen. Menü ⋮ → App installieren oder Zum Startbildschirm hinzufügen → bestätigen. Google: https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid

Direktzugang für bestehende Nutzer zur Anleitung: https://metzgerhannes-oss.github.io/Badminton/welcome.html#installation

Es handelt sich um eine Progressive Web App, keinen klassischen App-Store-Download. Das Home-Screen-Symbol öffnet die bisherige App-Startseite; gespeicherte Profile werden nicht zwischen Geräten synchronisiert.

## Implementierung

- welcome.html, welcome.css, welcome.js: mobile Willkommens- und Einrichtungsseite
- scripts/invitation.mjs: strenge DBV-Validierung, verlustfreies Zusammenführen bestehender Profildaten
- invite.js: systemeigenes Teilen, Link kopieren mit Fallback
- index.html: Einstellungsbereich für Einladungen und Installationshilfe
- sw.js: PWA-Cache inkl. neuer Dateien
- tests/invitation.mjs: Validierungs- und Persistenztests
