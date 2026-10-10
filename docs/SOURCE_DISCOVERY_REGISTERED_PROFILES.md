# Spielerbezogene Quellenrecherche nach registrierten DBV-IDs

Der bestehende tägliche GitHub-Quellenmonitor suchte vorher nur nach Philipp und Charlotte. Jetzt lädt er über den öffentlichen Supabase-Lesezugang maximal 60 bereits in `player_history_imports` registrierte DBV-IDs und deren Namen aus `players`. Diese registrierten Spieler sind **nicht** die gesamten 9.246 Bibliotheksprofile und nicht sämtliche lokal gefolgten Personen anderer Geräte.

Die bisherigen Sicherheitsregeln bleiben: robots.txt, nur freigegebene Domains und Artikelpfade, maximal 45 Artikel je Quelle, keine Inhalte kopieren, exakte Namensnennung nur im redaktionellen Artikelkörper, prüfpflichtiger PR mit Kandidaten, keine automatische Freigabe von Ergebnissen, kein Drittanbieter-Matchscraping und keine erhöhte Abfragehäufigkeit.

Die öffentliche Clubquelle https://spvgg.org/abteilungen/badminton/aktuelles/55-bwbv-meisterschaft-u11-u19-am-03-04-oktober-2026 nennt Sarah Storz und Vinzent Pius Ott **im Vorbericht** ebenso wie Philipp und Charlotte. Diese Meldungen wurden in der bereits bestehenden Quellregistrierung und in Supabase erfasst, **ohne** Matchstatistiken oder bestätigte Turnierstarts zu erzeugen.
