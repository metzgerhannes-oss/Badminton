# Schmetterlinge – private Spieler-Einladung v115

Stand 13.10.2026 · Supabase-Projekt ausschließlich `yadexibmjmnjfmfabrug`.

## Berechtigung und Nutzerweg

Die App und der allgemeine DBV-Turnierkalender bleiben ohne Konto erreichbar. Für einen eigenen Spieler kann in **Einstellungen → Eigenes Profil → Profil privat teilen** nach einem ausdrücklich ausgelösten Klick ein 256-Bit-Token angefordert werden.

Der Server prüft zusätzlich zur technischen Supabase-Auth-Sitzung einen **unabhängig bestätigten, nicht widerrufenen** Eintrag in `player_publication_grants` für **genau diesen Spieler**. Ein bloß selbst angegebenes DBV-Profil, eine Gast-/Anonymous-Auth-Sitzung oder eine empfangene Einladung genügen nicht, um weitere Spieler freizugeben. Die zugrunde liegende Veröffentlichungsberechtigung wird nur als bereits extern geprüfter Nachweis wiederverwendet; sie wird weder erzeugt noch automatisch erteilt.

**Wichtig:** Stand der Produktivdatenbank bei Entwicklung: 0 bestätigte Verwaltungsgrants, 0 Auth-Nutzer. Die UI kann einen Antrag technisch versuchen, der Server lehnt mangels unabhängig bestätigter Berechtigung ab. Die notwendigen Rechte dürfen nicht künstlich an unbekannte DBV-IDs vergeben werden. Zuerst ein überprüfbares Verfahren zur Legitimation des ersten Eltern-/Vereinsverwalters schaffen; danach benötigen eingeladene Leser **keinen** Login.

Nach erfolgreicher Freigabe wird ein kryptografisch zufälliger Link `private-player.html#token=<64 hex>` erzeugt. Token werden auf dem Server nur gehasht (`sha256`) gespeichert und **vor der ersten Netzabfrage** aus dem Browser-URL-Fragment entfernt. Der Empfänger liest mit genau diesem Token über `public.private_player_invite_read` **ein** Spielerprofil (DBV-ID/Name/Verein/Altersklasse) und maximal 30 jüngste belegte Matchkarten. Gegner- und Partnernamen sind **nicht** Bestandteil des freigegebenen JSON. Der Empfänger braucht kein Konto und kann keine Spieler suchen oder Rechte vergeben.

## Ablauf und Schutz

- Link maximal sieben Tage gültig, durch Ersteller widerrufbar; Widerruf/Frist sowie Wegfall der ursprünglichen Verwaltungsberechtigung werden bei **jedem** Lesen erneut geprüft.
- Pro Eigentümer höchstens fünf gleichzeitig gültige und zehn neu erzeugte Links in 24 Stunden; Quoten-Zählung serialisiert via Transaktionssperre.
- `private_content.player_access_invites` liegt in nicht via PostgREST exponiertem Schema, RLS aktiv, **kein** direkter SELECT/INSERT/UPDATE-Zugriff für `anon`/`authenticated`.
- Privilegierte Funktionen nur in `private_content` mit `search_path=''`, öffentliche RPC-Fassaden laufen `SECURITY INVOKER`. Es gibt **keine Freigabe der gesamten Spieler-/Matchtabellen**.
- Tokens in URL-Fragment, `no-referrer`, keine personenbezogenen Tokens oder Profile in GitHub-Actions-Logs. Andere Personen können Kopien oder Links weitergeben; Widerruf verhindert nur weitere Serverabrufe.
- Auch bei erfolgreicher Einladung bleiben Familien-Follows, private Spond-Termine, lokale Profile und Turnierfavoriten auf dem jeweiligen Gerät.
- Ohne neue kostenpflichtige Dienste, manuelle Erstellung einzelner Empfängerkonten, Tracking oder IP-Fingerprints.

## Abnahme und Einschränkungen

1. GitHub Node-/Browser-CI: synthetische Tests, sichere Darstellung, keine direkten Browser-Tabellenrechte.
2. Live-SQL: Ohne `auth.uid()` schlägt Erstellen fehl. Lesen mit zufälligem ungültigem Token gibt `null`; Browserrollen bekommen keine Tabellenrechte. Kontrollierte Wiederholung nach Echtdaten-Verifikationsprozess nötig.
3. Echtes iPhone A/B: Einladungslink kopieren, Leser ohne Anmeldung, Ablauf, Widerruf, falsches Token und Wiederöffnen. **Noch nicht real abgenommen.**
4. Soweit vom Projekt nicht aktiviert, muss anonyme Auth als optionaler technischer Dienst freigegeben werden. Keine Pflicht für Lesende.
5. DSGVO-Betreiberkontakt, Rechtsgrundlagen/Quellenrechte und Löschfristen (#53/#56) bleiben gesondert offen. Alte öffentliche Git-Historie/Cache-Kopien werden durch diesen neuen Link nicht gelöscht.

**Keine Behauptung eines funktionierenden ersten Privatteilens ohne bestätigten Verwalter.** Der Server verweigert korrekt alle unautorisierten Erstellungsversuche.

## v116 – Einladungsannahme einmalig, Zugriff bis zum Widerruf

**Neue verbindliche Semantik:** Die sieben Tage ab Erstellung sind ausschließlich eine **Annahmefrist**. Nach einer einmaligen Annahme bleibt der Zugang für diese technische Supabase-Auth-Identität erhalten, auch nach Ablauf der Annahmefrist. Ein zweites Gerät kann denselben Link nach der Annahme nicht mehr einlösen; dazu muss eine separate Einladung ausgestellt werden.

- Der Empfänger drückt ausdrücklich **Einladung annehmen**. Erst dann wird bei Bedarf eine technisch anonyme Supabase-Auth-Sitzung ohne E-Mail/Passwort erstellt. **Ohne diesen Klick kein Konto, keine personenbezogenen Daten**.
- Die 256-Bit-Linkkennung wird nur zum **einmaligen serverseitigen Annehmen** genutzt. Die Datenbank bindet `accepted_by=auth.uid()` atomar an die konkrete Einladungs-ID; weitere Annahmeversuche, auch vor Ablauf, scheitern.
- Danach liest nur die akzeptierte Sitzung mit der **nicht-geheimen Einladung-ID** über `private_player_access_read(uuid)`. Der Server überprüft bei **jedem** Abruf die Auth-UID, den Widerruf der Einladung und die weiterhin bestehende überprüfte Verwaltungsberechtigung des Erstellers. **Keine** `expires_at`-Prüfung nach der Annahme. Ohne authentifizierte Sitzung kein Zugriff, auch nicht mit der ID allein.
- Der Ersteller kann **jede alte angenommene Einladung auch nach Ablauf ihrer siebentägigen Annahmefrist** widerrufen. Mehrere Einladungen bleiben im lokalen Verwaltungsverzeichnis erhalten. Auf dem Empfängergerät können mehrere angenommene Zugänge gespeichert/ausgewählt werden, ohne Token zu speichern.
- Der alte reine Token-Lese-RPC `private_player_invite_read(text)` wird serverseitig gesperrt; davor vorhandene PWA-Versionen können keine personenbezogenen Daten mehr ohne Annahme abrufen.
- Widerruf gilt für den **nächsten Serverabruf**; bereits gesehene oder extern kopierte Daten können nicht gelöscht werden. Auf Seitenrückkehr wird neu geprüft. Kein kostenpflichtiger Dienst oder Pflichtregistrierung zur allgemeinen Appnutzung.
- Wird die anonyme Auth-Sitzung durch Geräteverlust, Löschung von Website-Daten oder Abmeldung gelöscht, lässt sich der Zugriff **nicht durch bloße Kenntnis der alten Einladung** wiederherstellen. Es wird eine neue Einladung oder ein späteres optionales Wiederherstellungsverfahren benötigt.

Die v116-SQL-Migration ist separat unter `database/private_player_accept_once_v116.sql` dokumentiert und ändert keine Freigabe der Personen-Tabellen für Browserrollen. V115 war zunächst eine siebentägige Bearer-Lesefreigabe; nach v116 ist dies **nicht mehr** das Zugriffsschema. Echte iPhone-A/B- und Erstverwalter-Abnahme bleiben offen (#173).
