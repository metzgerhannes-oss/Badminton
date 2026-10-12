# Spond-Kalender in Schmetterlinge übernehmen

## Was funktioniert
Du hast Spond bereits mit dem iPhone-Kalender synchronisiert. Schmetterlinge kann **nicht direkt** auf die iPhone-Kalenderdaten zugreifen (Safari-/PWA-Datenschutzgrenze). Deshalb erfolgt die Übergabe bewusst über eine Kalenderdatei oder einen Apple-Kurzbefehl.

- In Schmetterlinge `Turniere → Spond-Turniere → Termine übernehmen` antippen. Wenn der Kalendertext bereits in der Zwischenablage ist, öffnet sich sofort die Vorschau. Sonst erscheint ein kurzes Fenster mit Anleitung und weiteren Importmöglichkeiten.
- Einmalig einen iPhone-Kurzbefehl einrichten, der Termine aus dem von Spond genutzten Kalender in die Zwischenablage kopiert. Alternativ eine `.ics`-Datei oder vorbereitete Kalenderdaten über „Weitere Importmöglichkeiten“ verwenden.
- Vorschau prüfen und einem eigenen Spieler zuordnen. Erst mit „Termine übernehmen“ wird lokal gespeichert.
- Erneuter Import aktualisiert Termine mit gleicher Kalender-UID. Bereits importierte, danach in Spond gelöschte Termine müssen vorerst in Schmetterlinge einzeln entfernt werden.

**Wichtig:** Spond erstellt nach den derzeitigen Herstellerangaben Kalendertermine direkt in einem ausgewählten Telefon-/Onlinekalender und stellt hierfür keinen frei nutzbaren privaten API-Zugriff bereit. Eine iPhone-Web-App kann den iPhone-Kalender nicht selbst abfragen. Google-Kalender oder eine eigene native iOS-Anwendung wären gesondert zu prüfende Integrationen. Kalenderdaten sind keine offizielle Meldung, Teilnahmebestätigung oder Matchbelege. Es erfolgt kein Upload nach Supabase, kein Spond-Login und keine öffentliche Veröffentlichung. Der private Kalenderimport wird separat auf dem verwendeten Gerät gespeichert und ist aktuell **nicht** Bestandteil der bestehenden Familiensicherung.

## Apple-Kurzbefehl (ohne zusätzliche App / ohne API)
1. Auf dem iPhone die App **Kurzbefehle** öffnen und einen neuen Kurzbefehl „Spond nach Schmetterlinge“ erstellen.
2. Aktion **Kalenderereignisse suchen** hinzufügen. Nach dem Kalender filtern, in dem die Spond-Termine liegen, und nach gewünschten kommenden Ereignissen (z. B. nächste 90 Tage).
3. Aktion **Mit jedem wiederholen** hinzufügen. Pro Ereignis die Details **Titel**, **Startdatum**, **Enddatum** und optional **Ort** abrufen.
4. Start- und Enddatum jeweils mit **Datum formatieren**, benutzerdefiniertes Format `yyyy-MM-dd`.
5. In einer **Text**-Aktion die vier Werte **tabulatorgetrennt** zusammenstellen. Die Zeile jeweils mit **Zu Variable hinzufügen** in einer Liste sammeln.
6. Nach der Wiederholung die Zeilen durch einen Zeilenumbruch mit **Text kombinieren** verbinden und per **In Zwischenablage kopieren** ablegen.
7. Schmetterlinge öffnen, unter **Spond-Kalender** den Text einfügen, **Daten prüfen** und nach der Vorschau übernehmen.

Beispiel für das Textformat (zwischen Feldern ist jeweils ein Tabulator):

```text
Jugend-Ranglistenturnier	2026-10-24	2026-10-25	Sporthalle Reutlingen
```

Tipp: Die Kalenderauswahl schon im Kurzbefehl einschränken, damit private Termine aus anderen Kalendern gar nicht erst aufgenommen werden. Die tatsächlichen Aktionen und Namen können je nach iOS-Version leicht abweichen.

### Optional: Übergabe per Link statt Kopieren
Der Importer versteht lokal einen URL-**Fragment**-Wert, der nicht an den Webserver gesendet wird. Das Format ist `#spond=` gefolgt von URL-kodiertem JSON. Beispiel mit **einem** Ereignis:

```json
{"events":[{"title":"Jugendturnier","start":"2026-10-24","end":"2026-10-25","location":"Sporthalle"}]}
```

Eine Verknüpfung des JSON als URL-Fragment mit der Schmetterlinge-Webadresse öffnet die Importvorschau. Sicherheitsbedingt ist die manuelle Bestätigung erforderlich. iOS öffnet solche Links möglicherweise in Safari statt in einer installierten Homescreen-PWA; dann ist der Browser-Gerätespeicher getrennt. Deshalb ist der Weg über die Zwischenablage auf bereits eingerichteten Homescreen-Geräten zunächst zuverlässiger.

## Grenzen / nächster Schritt
Die erste Version ist ein **manuell gestarteter, wiederholbarer Kalenderimport** – **noch kein unsichtbarer Hintergrund-Sync**. Änderungen lassen sich per erneutem Import übernehmen; automatische Löschungen sind noch nicht freigeschaltet. Ein vollständig automatischer, geräteübergreifender Abgleich erfordert eine separat freigegebene, geschützte Kalenderquelle und private Account-Synchronisation. Eine Spond-API oder die Auslesung geschützter Spond-Zugänge wird nicht vorausgesetzt.
