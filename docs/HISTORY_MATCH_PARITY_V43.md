# v43 – Historische Einzelspiele und Home stimmen fachlich überein

Datum: 10.10.2026. Produktziel P0 (#6/#17): keine falschen Siege/Niederlagen und keine unbelegten Karrierezahlen.

Fehler: Home verwendet die strenge Satz-, Quellen-, Sieger- und Dublettenprüfung. Die historische Detailansicht zählte bislang jedes importierte Match als Sieg oder Niederlage, auch wenn die Quelle widersprüchlich oder doppelt war. Zudem war ihr Abruf auf 1.000 Zeilen begrenzt, Home auf 10.000.

Fix: Beide Ansichten verwenden dieselbe reine Funktion computeExternalStats. Filter nach Jahr und Disziplin greifen in derselben Prüfung; für Turnier/Liga wird vorher auf Spielart gefiltert. Unklare und doppelte Quellkarten werden nicht als Match gezeigt oder gezählt. Importabdeckung bleibt kenntlich, maximal 10.000 Quellenkarten je Ansicht und ausdrücklicher Hinweis auf mögliche Unvollständigkeit. Ein REST-Fehler ist keine bestätigte leere Historie; Nutzer können erneut laden.

Prüfung: Unit-Fixtures mit widersprüchlichem Gewinner, ungültigem Beleglink und doppeltem source_key; mobile Chromium-/WebKit-E2E für Historie↔Home und Quellenausfall/Retry. Keine Supabase-Schema-/RLS-/Importveränderung, keine Änderung lokaler Profile.

Offen: autorisierter vollständiger Datenfeed (#17), physische iPhone-/VoiceOver-Abnahme (#28).
