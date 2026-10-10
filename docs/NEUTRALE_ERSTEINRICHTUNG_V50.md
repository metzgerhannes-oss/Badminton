# Schmetterlinge v50 – Neutrale Ersteinrichtung

Stand: 10.10.2026. Setzt Variante B fort, ohne Cloud-Accounts und ohne Änderungen an zentralen Datenbanken.

## Ziel
Neue Installationen sollen niemals automatisch private Profile anderer Familien erhalten. Eigene Namen, Geburtsjahre und Vereinsangaben sind keine neutralen Testdaten für die öffentlich ausgelieferte App.

## Verhalten
- `app.js` initialisiert neue Geräte mit `players=[]`, leeren Favoriten und ohne aktives Familienprofil.
- Der Erststartdialog erklärt, dass noch kein Profil eingerichtet wurde. Nur explizites Hinzufügen über das vorhandene Formular legt ein lokales Profil an.
- Speichert die App ein eigenes Profil, erscheint danach Home mit diesem Profil. Der bestehende `shuttleboard-v1`-Speicherkey und Export-/Importvertrag werden beibehalten.
- Bereits gespeicherte Profile bleiben beim Update unverändert. Eine explizite **Legacy-ID-Migration** für eine bereits vorhandene Gerätezeile behält Zuordnungen und Turnierfavoriten, legt aber keine zweite Person an und ergänzt weder Geburtsjahr noch Verein.
- Bei beschädigtem oder fehlendem lokalen Speicher bleibt die App beim neutralen Einrichtungsdialog; niemand wird durch Fallback automatisch angelegt.
- Bestehende öffentliche Quellen und nachgewiesene Turnierergebnisse sind von der Änderung nicht betroffen; der persönliche Familienkontext bleibt lokal.

## Sicherheit / Abnahme
- Unit-Tests prüfen bestehende Spielerwechsel und Legacy-Migration aus bekannten Speicherständen, den neutralen Zustand und Storage-Ausfälle.
- Eine Browser-E2E prüft Erststart, Profilanlage, Reload und Formularabbruch.
- Reale iPhone-/VoiceOver-Abnahme bleibt weiterhin separat erforderlich.

## Weitere Aufgaben
- Aufbewahrungsdauer und Löschregeln für Supabase-Caches, Beanstandungsprozess und vollständige öffentliche Datenschutzerklärung stehen weiterhin aus.
- Öffentliche Vereins- und Turnierberichte können Namen veröffentlichter Sportler enthalten; die Änderung entfernt nur automatische private **Startprofile** aus dem auslieferbaren App-JavaScript. Sie anonymisiert nicht die öffentliche Sportdatenbibliothek.
