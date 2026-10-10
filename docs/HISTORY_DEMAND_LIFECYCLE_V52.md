# v52 – Bedarfsabhängiger Historienabgleich

Die persönliche Follow-Liste, die eigenen Profile und die Turnierfavoriten werden nicht übertragen. Erst beim bewussten Öffnen der Historie meldet die App die ausgewählte öffentliche DBV-ID als aktuell nachgefragt.

Der Server akzeptiert nur verifizierte DBV-IDs, eine erneute Aktivierung höchstens einmal täglich pro ID und maximal 60 neu oder erneut aktivierte IDs innerhalb von 24 Stunden. Eine gesonderte, anonym nicht lesbare Spalte `last_demand_at` protokolliert ausschließlich den Zeitpunkt der letzten serverseitig akzeptierten Nachfrage.

Der vorhandene 15-Minuten-Worker prüft weiterhin nur fällige Historien und berücksichtigt eine ID automatisch nur, wenn innerhalb der letzten 14 Tage eine Nachfrage vorlag. Danach ruht die automatische Quellensuche, bis ein Nutzer die Historie erneut ausdrücklich öffnet.

**Keine Ergebnislöschung:** Vorhandene Matchbelege, Platzierungen und Quellbelege werden nicht entfernt. Die 14 Tage beschreiben ausschließlich den technischen Zeitraum für automatische Wiederprüfungen, keine datenschutzrechtliche Aufbewahrungs- oder Löschfrist.

Der externe Badhub-Matchimport hat eine separate Queue und benötigt ein eigenes Lösch-/Cachekonzept. Betreiberangaben, Rechtsgrundlagen, Betroffenenrechte und Quellennutzungsrechte sind in #53 und #56 gesondert abschließend zu bewerten.

Abnahme: Node- und Browser-CI, danach Migration in Badminton-Supabase `yadexibmjmnjfmfabrug`, Test ungültiger IDs ohne Datenbankänderung, Privilegienprüfung, erst anschließend Merge des Frontends.
