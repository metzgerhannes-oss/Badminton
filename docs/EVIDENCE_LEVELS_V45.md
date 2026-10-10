# v45 – Quellenhinweise von zählbaren Matchbelegen unterscheiden

Datum 10.10.2026. Quelle: [Vereinsbericht SpVgg Mössingen, 28.09.2026](https://spvgg.org/abteilungen/badminton/aktuelles/4-e-rangliste-suedwuerttemberg-u11-u19-am-26-september-2026).

**Neuer tatsächlicher Quellenbeleg:** Der Bericht bestätigt namentlich für DBV-ID `05-071969` ein gewonnenes Spiel beim ersten E-Ranglistenturnier am 26.09.2026 (Mädcheneinzel U13, Platz 5). Er enthält dafür **keinen konkreten Gegner, kein Match-Datum und keine Satzstände**. Das ist ein quellengesicherter Ergebnis-Hinweis, aber **kein** individuell zählbarer Matchbeleg. Daher nur beschreibend in der vorhandenen Turnierchronik und unter „Berichte“, niemals W/L-KPI oder `player_external_match_facts` verändern.

Der andere geprüfte Weg ist die **offizielle Jugendrangliste** unter https://turniere.badminton.de/ranking : DBV-ID `05-071969`, U13 DE, 611 Ranglistenpunkte, **2 gewertete Turniere** in KW41/2026. Diese Information existiert bereits mit `source_quality=official_total` in der Badminton-Supabase-Datenbank und wird **nicht** als 2 Matchbelege umgedeutet.

## Systematische Quellenreihenfolge für weitere Recherche
1. Offizielle DBV-/Turnier.de- und BWBV-Ergebnislisten, Turnier-Veranstalterdateien (rechtlich freigegeben), eindeutige Matchprotokolle mit Gegenseite und Satzständen.
2. Vereine, Verbände und Sportberichte für belegte Platzierungen und Ergebnis-Hinweise ohne ganze Matchkarten, Quelle mit Zeitstempel archivieren/prüfen.
3. Badhub nur soweit rechtmäßig, erreichbar und fachlich validiert; bei Ausfall andere unabhängige Quellen recherchieren, **keine** technische Zugriffssperre umgehen.
4. Ranglisteneinträge dienen als Quercheck für Turnierteilnahmen und Priorisierung fehlender Ergebnisse, **nicht** als Matchstatistik.
5. Unklar belegte Ergebnisse nicht importieren; bei fehlendem offiziellen Datenzugang Erlaubnis für Einzelspieler-bezogene Read-only-Feeds bzw. Turnierexports erbitten.

UI zeigt den Win-Hinweis getrennt von zählbaren Matchstatistiken im vorhandenen Historienweg, kein zusätzlicher Menüpunkt, keine doppelte Buchung.
