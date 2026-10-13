# Erste Eigentümeraktivierung für Schmetterlinge (v117)

**Projekt:** nur Supabase Badminton `yadexibmjmnjfmfabrug`, GitHub `metzgerhannes-oss/Badminton`.

## Sicherheit und Einrichtung
Die verbundenen GitHub-Zugangsdaten bestätigen den Repository-Eigentümer `metzgerhannes-oss`. Diese Berechtigung allein ist noch keine Supabase-Auth-Session eines iPhones. Deshalb wird **einmalig und außerhalb des öffentlichen Repositories** ein kryptografisch zufälliges 256-Bit-Geheimnis über den bereits administrativ autorisierten Supabase-DB-Zugang ausgestellt. Der Server speichert **nur den SHA-256-Hash**, fest auf die erste Eigentümeraktivierung beschränkt.

Das Geheimnis wird über einen HTTPS-Link mit URL-Fragment `#activate=...` an den Eigentümer ausgegeben. Das Fragment wird im Client sofort aus der Adresszeile entfernt. **Keine** Weitergabe in Issues, Logs, GitHub-Secrets oder Code; keine automatische oder stille Benutzeranlage.

Nach Klick auf **Als Administrator aktivieren** erstellt die App bei Bedarf eine technische anonyme Supabase-Sitzung auf diesem Gerät, ohne E-Mail oder Passwort. Die Backend-Funktion sperrt sich mit Row-Lock und akzeptiert nur das gültige, noch nicht eingelöste Bootstrap-Geheimnis, sofern noch **kein** `private_content.site_owners`-Eintrag existiert. Der erste Claim bindet den Eigentümer an die dabei authentifizierte `auth.uid()`. Besucher mit dem Link zu der leeren Aktivierungsseite, einer frei gewählten DBV-ID oder einem selbst angelegten anonymen Account erhalten keine Rechte.

**Alternative für bereits als PWA installierte iPhones:** Einstellungen → Eigentümeraktivierung (nur Betreiber) → Einmaligen Eigentümercode auf diesem Gerät eingeben. Der Eigentümer kopiert dort die 64 hexadezimalen Zeichen aus seinem privaten Aktivierungslink hinein. So bleibt die Auth-Sitzung im Speicher der installierten iPhone-App und nicht in einem anderen Safari-/ChatGPT-Webview-Kontext. Kein Token nach Klick im Browser-Storage.

## Spielerfreigaben
Nach der Eigentümeraktivierung wird unter Einstellungen → **Eigentümerverwaltung – private Spieler** eine eigene, ausschließlich nach Serverprüfung sichtbare Verwaltung angeboten. Eigene DBV-ID eingeben oder aus lokalen Profilen auswählen, dazu ausdrücklich bestätigen, dass Sorgeberechtigung oder sonstige Verwaltungsbefugnis für dieses **konkrete** Spielerprofil besteht. Nur dann wird ein verifizierter Grant für diese Owner-UID und genau diese DBV-ID angelegt, insgesamt maximal 12 aktive Grants. Das ist kein automatischer Nachweis für fremde Minderjährige. Ein Nutzer kann jederzeit jeden Grant widerrufen; bestehende private Spielerlinks sind dann sofort serverseitig gesperrt.

Bereits eingerichtete Empfänger benötigen **keinen** dauerhaften Account mit E-Mail/Passwort. Die sieben Tage gelten nur als Annahmefrist und nicht als Dauer des bestätigten Zugangs. Der öffentliche Turnierkalender funktioniert weiterhin ohne Konto.

## Aufruf zur separaten Tokenausstellung (administrativer Supabase-Zugang)
Nur nach v117-Deployment, bei weiterhin 0 Owners, ausschließlich per DB-Admin ausführen:
```sql
-- Geheimnis nur an den berechtigten Eigentümer ausgeben, nicht loggen!
WITH token AS (
  SELECT encode(extensions.gen_random_bytes(32),'hex') AS secret
), upsert AS (
  INSERT INTO private_content.owner_bootstrap
   (bootstrap_id,token_digest,issued_for,issued_at,expires_at)
  SELECT 'first-repository-owner',
   extensions.digest(pg_catalog.decode(secret,'hex'),'sha256'),
   'metzgerhannes-oss',now(),now()+interval '60 minutes'
  FROM token
  ON CONFLICT(bootstrap_id) DO UPDATE
   SET token_digest=excluded.token_digest,
       issued_at=excluded.issued_at,expires_at=excluded.expires_at,
       claimed_by=NULL,claimed_at=NULL
   WHERE private_content.owner_bootstrap.claimed_by IS NULL
  RETURNING bootstrap_id
)
SELECT secret FROM token WHERE EXISTS(SELECT 1 FROM upsert)
  AND NOT EXISTS(SELECT 1 FROM private_content.site_owners);
```
Geheimnis nicht in der GitHub-Historie ablegen oder in öffentlich zugängliche Channels kopieren. **Kein** weiterer Token nach erfolgreicher Bindung. Für verlorene PWA-Sitzungen muss später ein separater, verifizierter Wiederherstellungsprozess definiert werden.

## Abnahme
1. CI/HTML-/SQL-Vertragsprüfung und Browser-Tests grün.
2. SQL-Transaktionsprobe mit anschließendem `ROLLBACK`, keine offenen Browser-Datenbankrechte.
3. Negativtest ohne `auth.uid()`: kein Claim; Owner-Status `owner=false`, Attestation und Revoke `false`.
4. Nach Produktivmigration: 29/29 öffentliche Tabellen weiter RLS aktiv; `anon` kann neue RPCs nicht ausführen; der normale Turnierkalender bleibt offen.
5. **Echte iPhone-Abnahme:** Eigentümercode direkt in PWA einfügen, danach eigenen berechtigten Spieler bestätigen und privaten Link an zweites iPhone schicken. Link akzeptieren, erneut öffnen, widerrufen. Erst dann vollständig real abgenommen.

**Bestehende Datenschutzthemen:** Rechtsgrundlagen, Quelle, Betreiberkontakt und Löschkonzept in #53/#56; erster legitimer Owner in #173. Kein kostenpflichtiger Dienst, kein Aufweichen der bisherigen Besucherrechte.