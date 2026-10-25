# v215 · P1 #386: lokaler Austragungsort ohne unsicheren DBV-Abgleich

- Das private Turnierformular speichert einen optionalen Austragungsort/Hallenadresse (max. 120 Zeichen) in der bereits vorhandenen lokalen Bookmark-Struktur. Vorhandene Einträge behalten ihre UUID, Profilbindung, Datumswerte und Freigaben; beim Bearbeiten wird der Ort wieder geladen.
- Fehlt ein lokaler Ort, steht in „Meine Turniere“ nun korrekt „Austragungsort nicht erfasst“. „Noch nicht veröffentlicht“ wäre ohne geprüfte offizielle Quelle eine unbewiesene Aussage.
- „Turnierbeginn“ wird explizit vom Meldeschluss unterschieden. Weder Datum noch Kategorie noch Ort werden allein anhand ähnlicher Orts-/Titeltexte automatisch geändert.
- Synthetische Offline-Tests decken zwei verschiedene E-/D-Turnier-UUIDs, Ortsänderung, Reload und 320/390/1280px ab. Kein externer Fetch, keine DB-/RLS-Migration, keine personenbezogenen Echtdaten.
- **Weiter offen in #386:** Automatische, autorisierte UUID-genaue Anreicherung von Quelle, offizieller Hallenadresse und Turnierdatum einschließlich möglicher Abweichungsbestätigung. Kalender-IDs ohne verifizierten UUID-Join werden nicht mit individuellen Turnierlinks vermischt. Quellenrechte #56 / Live-Zugriff #17 bleiben erforderlich.
