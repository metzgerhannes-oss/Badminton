# v69: BYE / Rast sind keine gespielten Matches

Stand 11.10.2026. DBV-Nachweis: https://www.badminton.de/fileadmin/stages/dateien_januar_2025/dbv-hp_rl-wertung_int-turniere_20241201.pdf

Ein BYE bzw. eine Rast ist ein kampfloses Vorrücken im Turnierbaum. Das beeinflusst unter Umständen Platzierungs- und Ranglistenpunkte, aber nicht die Zahl tatsächlich gewonnener Spiele oder Sätze.

Der Import unterscheidet explizit beschriftete BYE/Rast/Rust/Freilos/Spielfrei von W.O./Walkover/Aufgabe und unbeschrifteten Matchkarten ohne Satzstände. Es entstehen weder zusätzliche Siege noch Niederlagen. Konflikte zwischen solchen Kennzeichnungen und vorhandenen Satzständen gelten als ungeklärt.

Bei Philipp: 62 veröffentlichte Matchkarten, 52 auswertbar, 6 mit unvollständigem Kurzergebnis, 4 ohne auswertbare Satzstände. Die vier Karten tragen derzeit keine ausdrückliche BYE/Rast-Kennzeichnung; eine solche Einstufung wäre nicht belegt. Ein älterer HTML-Selektor war für die Gegnerpräsenz nicht aussagekräftig.

Der neue Status-Parser und die Tests halten den Nachnamen Rust bei echten Spielen ausdrücklich von Freilos-Kennzeichnungen getrennt.

GitHub-Merge und Supabase-Edge-Deployment müssen getrennt bestätigt werden. Vor dem Deployment ist der Produktivbestand unverändert; der Server importiert keine ungeprüften Spiele.
