# v90 · Nachweisbare Berechtigung für Turnierfreigaben

**Status:** Schutzmigration für Badminton, getrennt vom Gartenwelt-Projekt. Spieler-ID im öffentlichen DBV-Verzeichnis bedeutet **nicht**, dass irgendein Gerät befugt ist, öffentliche Turnierhinweise für diesen Spieler zu veröffentlichen.

## Sicherheitsmodell
- `public.player_publication_grants` bindet exakt **Supabase Auth UUID + öffentliche DBV-Spieler-ID** nach unabhängiger Prüfung durch Elternteil, erwachsenen Spieler oder Verein.
- Nur die vertrauenswürdige Admin-/Betreiberrolle darf eine Berechtigung ausstellen oder entziehen. `anon` und `authenticated` haben **keine INSERT/UPDATE/DELETE-Rechte** für Grants; Betroffene dürfen ihre **eigene Freigabe** einsehen (RLS und begrenzte SELECT-Spalten).
- Die vorhandene private Tabelle `user_tournament_links` bleibt eigentümergebunden. Die beiden zusätzlichen **restriktiven** RLS-Policies blockieren `is_shared=true`, wenn für genau den aktuellen Benutzer und genau die betreffende DBV-ID keine aktuelle Bestätigung vorliegt.
- Die öffentlich lesbare Tabelle `shared_tournament_hints` bleibt eine separate Projektion ohne Auth-Benutzer-ID oder private Familienlisten. Die Projektionsfunktion akzeptiert ausschließlich noch gültige Grants; **Entzug** aktualisiert die veröffentlichte Projektion sofort. Lokale Lesezeichen werden nicht gelöscht.
- Öffentlich geteilte Turniere bleiben als **Nutzerhinweise, nicht offizielle Turniermeldungen oder Teilnahmen**, gekennzeichnet. Ein Grant bestätigt nur die Verwaltungsberechtigung, nicht die Turniermeldung.
- Das Frontend fragt vor einer Veröffentlichung nur nach dem eigenen Grant und erklärt einen fehlenden Nachweis. Keine Service-Keys im Browser. Es zeigt bei Bedarf die gerätegebundene Supabase Auth-ID für eine **private** Zuordnungsanfrage.
- Die richtige Projekt-ID ist `yadexibmjmnjfmfabrug`; `JohannasGartenwelt` niemals verändern. Migration: `database/verified-player-publication-v90.sql`.

## Einrichtung / Betreiberfreigabe

**Nicht automatisch ausstellen, nicht aus Nutzer-Freitext oder DBV-ID allein ableiten.** Unabhängig prüfen, ob eine sorgeberechtigte Person, ein verantwortlicher Verein oder ein volljähriger Spieler tatsächlich für das Profil entscheiden darf. Die Prüfung erfolgt über einen privaten, bekannten Kontaktweg. Keine personenbezogenen Dokumente in öffentliche GitHub-Issues oder im Sportdatenbestand hochladen.

Die App zeigt beim ersten Freigabeversuch die gerätegebundene Auth-UUID; diese ist ein **Zuordnungsbezeichner, kein Beweis**. Erst nach echtem Nachweis aus einer vertrauenswürdigen Stelle mit einem privilegierten Supabase-Zugang ausstellen:

```sql
-- Beispieleintrag: Platzhalter ersetzen, NICHT ohne unabhängigen Nachweis ausführen.
INSERT INTO public.player_publication_grants
 (user_id, player_dbv_id, verification_method, reviewed_by)
VALUES ('<geprüfte-auth-uuid>'::uuid,'<geprüfte-dbv-id>',
        'guardian_review','club-or-operator-review')
ON CONFLICT (user_id,player_dbv_id)
 DO UPDATE SET verification_method=EXCLUDED.verification_method,
 reviewed_by=EXCLUDED.reviewed_by, verified_at=now(), revoked_at=NULL;
```

Für nachträglichen **Widerruf** (kein lokales Lesezeichen löschen):

```sql
UPDATE public.player_publication_grants
 SET revoked_at=now()
WHERE user_id='<die-auth-uuid>'::uuid AND player_dbv_id='<die-dbv-id>';
```

Durch den v90-Trigger verschwindet der Hinweis, sofern kein anderer berechtigter Veröffentlicher dasselbe Turnier hinterlegt hat. Die Berechtigungsfreigabe kann auch nach Verlust des Geräts adminseitig widerrufen werden; reine anonyme Geräteaccounts sind **nicht zuverlässig auf ein neues Gerät übertragbar**.

## Abnahme
1. `auth.users` und `player_publication_grants` sind nicht frei beschreibbar; positive und negative RLS-Prüfungen gegen den echten Backend-Rollenpfad.
2. Ohne Grant: kein öffentlicher POST, keine öffentliche Projektion, lokale Bookmarks unverändert.
3. Mit verifizierter Berechtigung: gezielte Freigabe und zweites Followergerät lesen dieselbe Projektion; kein falscher offizieller Match-/Teilnahmestatus.
4. Widerruf: externe Projektion verschwindet sofort; `anon` kann weiter ausschließlich lesen.
5. Mobile Chrome/WebKit; Offline, Reload, Sessionverlust, fremde DBV-ID und Spielerwechsel.
6. Vor realem Pilot: **Supabase Auth anlegen/freischalten**, Konten zuordnen und wirkliche Zwei-Geräte- und iPhone-Tests dokumentieren. Eine simulierte Browserantwort ist kein erfolgreicher Produktivtest.
