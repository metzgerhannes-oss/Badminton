# v218 – Turnieridentität bei Kalender-Duplikaten

## Datenintegrität (Issues #348 / #386)

Zwei Turnierkarten werden nur zusammengefasst, wenn beide auf dieselbe **verifizierte DBV-Turnier-UUID** verweisen. Gleicher Ort, Datum, Altersklasse oder C/D/E-Level reicht nicht aus. Die frühere Heuristik konnte dadurch eigenständige Turniere ausblenden.

Der neue rein lokale Vergleich prüft zwei vollständige HTTPS-Links auf `dbv.turnier.de/tournament/<UUID>`, verwirft fremde Hosts, Abfrageparameter, Übersichtslinks und Ankündigungen. Ohne eindeutige UUID bleiben beide Einträge sichtbar, statt ein mögliches anderes Turnier zu verbergen. Keine neuen Datenquellen, keine Änderung lokaler Favoriten.

Synthetische Unit-Fälle prüfen gleiche UUID, verschiedene UUID bei identischem Ort/Termin/Level, fehlenden Direktlink und irreführende URLs. Bestehende Chromium-/WebKit-Regression und Netzsperren bleiben unverändert.

**Nicht abgeschlossen:** Der konkrete Reutlinger C-Turniernachweis und der Gomaringer E/D-UUID-Abgleich bleiben offen; #348/#386 nicht schließen. Quellen-/Betreiberrechte #56 separat.
