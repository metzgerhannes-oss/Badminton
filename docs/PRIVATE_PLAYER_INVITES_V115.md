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
