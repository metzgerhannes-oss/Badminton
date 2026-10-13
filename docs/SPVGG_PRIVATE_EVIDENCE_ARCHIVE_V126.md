# SpVgg Mössingen – privates Quellenarchiv v126

**Produktivumgebung:** ausschließlich Badminton-Supabase `yadexibmjmnjfmfabrug`. Kein öffentlicher JSON-Export.

## Zweck

Alle derzeit in der Spieler-Datenbank eindeutig als `SpVgg. Mössingen` geführten DBV-Profile erhalten einen privaten archivierten Datensatz. Vorhandene, quellengebundene Turnierplatzierungen und externe Einzelmatchkarten werden **zusätzlich** zu den ursprünglichen Supabase-Tabellen in `private_content` gespeichert. Damit bleiben sie bei einem Fehler im Client, Importstatus oder öffentlichen Cache serverseitig vorhanden.

**Stand der tatsächlichen Archivmigration vom 13.10.2026:**
- 13 Club-Profile mit stabiler DBV-ID.
- 49 vorhandene belegte Platzierungsdatensätze; 24 davon mit Platz 1–4.
- 839 gespeicherte externe Matchkarten.
- Vier Profile besitzen aktuell dokumentierte Platzierungen; drei Profile externe Matchkarten.
- **Keine Vollständigkeitszusage** für die übrigen Profile. Fehlende Belege heißen `not_exhaustively_verified`, nicht „0 sportliche Erfolge“.

## Technik und Datenschutz

- Tabellen: `private_content.spvgg_archive_players`, `private_content.spvgg_archive_evidence`; Primärschlüssel verhindern Doppelkarten je Spieler/Quell-ID.
- Private Row Level Security aktiviert, **keine** Lesepolicies oder Tabellen-Grants für `anon`/`authenticated`; keine öffentlich ausführbare Refresh-RPC.
- Der Refresh schreibt nur vom bestehenden, nach DBV-ID eindeutig zugeordneten belegten Datenbestand. Korrekturen und Löschungen der Originaldaten werden bei der Aktualisierung synchronisiert, Spieler-Löschung kaskadiert; keine erfundenen Ergebnisse.
- Schon vorhandene Quell-URL und beobachteter Zeitpunkt bleiben im archivierten Eintrag erhalten. Keine neue externe Quelle und keine neue Identitäts-/Profilregistrierung.
- Erster Datenabgleich wurde während der Migration ausgeführt. Bestehendes Supabase pg_cron führt täglich einen schlanken, idempotenten Update-Abgleich aus (03:35 UTC). Keine zusätzlichen kostenpflichtigen Dienste.
- Kein automatisches Auslesen privater Daten durch die PWA: Die separaten Berechtigungs-/Freigabe-Gates aus #173, #187 und #188 gelten weiterhin. Ein gespeicherter Datensatz ist **nicht** automatisch eine für beliebige Follower sichtbare Karte.

## Prüfung (nur aus der administrativen SQL-Konsole)

```sql
select count(*) from private_content.spvgg_archive_players;
select kind,count(*) from private_content.spvgg_archive_evidence group by kind;
select has_table_privilege('anon','private_content.spvgg_archive_evidence','SELECT');
select has_table_privilege('authenticated','private_content.spvgg_archive_evidence','SELECT');
select active from cron.job where jobname='badminton-spvgg-private-evidence-archive-v126';
```

Erwartet: 13 Spieler, 49 Platzierungen, 839 Matchkarten (Momentaufnahme, später wachsend), beides kein SELECT, pg_cron aktiv. Die zwei Archivinhalte entsprechen bei der ersten Sicherung 1:1 den Originaltabellen.

## Weiter offen

1. Vollständige Turnier- und Matchquellen-Abdeckung pro Vereinsspieler prüfen; nach Möglichkeit nur serverseitig und quellenrechtlich zulässig ergänzen. Aktuelle Importe sind bewusst privat gesperrt, nicht über öffentliche PWA-Aufrufe umgehen.
2. Gesicherte Nachweise über den streng spielerbezogenen Lesekanal in Startseite/Trophäenschrank einbinden – mit Berechtigungsprüfung, Revocation und „nicht verfügbar“ statt falscher Null (#173, #188).
3. Aufbewahrung, Quellenrecht, Löschanforderungen sowie Rollenzuordnung nach #53/#56 klären.
