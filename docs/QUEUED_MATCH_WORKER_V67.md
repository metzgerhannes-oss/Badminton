# v67 – Historien-Worker verarbeitet vorgemerkte Imports

11.10.2026. Bisher wurden bestehende `queued`-Statuszeilen vom Cron-Selektor übergangen.
Die Migration ergänzt `queued` bei erhaltenem 14-Tage-Nachfragefenster, `service_role`-Claim, Lease, Quotenlimit und einem Spieler pro Lauf alle 30 Minuten.

Produktiv migriert und durch direkten privaten Worker-Aufruf verifiziert (HTTP 200).
Philipp (05-070879): 62 veröffentlichte Badhub-Matchkarten, 52 fachlich verwertbar, 10 ausgeschlossen.
Nach Bereinigung veralteter Parser-Zuordnungen: 52 eindeutig gespeicherte Spiele, 25 Siege, 27 Niederlagen, verteilt auf 14 Turnierquellen.
Badhub 62/26/36 und DBV 60/26/34 sind getrennte datierte Profil-Screenshots, nicht 62 verifizierte Einzelnachweise.
