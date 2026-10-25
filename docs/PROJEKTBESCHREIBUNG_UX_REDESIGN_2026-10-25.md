# Schmetterlinge – Projektbeschreibung und UX-Neuausrichtung 2.0

**Projektentscheidung: 25.10.2026.** Status: **verbindliche Produkt-/Design-Zielbeschreibung; Konzept, keine umgesetzte oder abgenommene App-Version**. Referenz: bestehendes GitHub-Projekt `metzgerhannes-oss/Badminton`, bei Sichtung `main`/HTML-Angabe v209. Die tatsächliche veröffentlichte Version und alle Release-Gates separat prüfen.

## 1. Zielbild und Leitmotiv

**„Öffnen. Erkennen. Tippen. Fertig.“** Schmetterlinge ist eine intuitive, kostenlose, datensparsame und iPhone-optimierte Badminton-PWA für Familien, eigene und gefolgte Spieler, Vereine, Mannschaften und regionale Turniere.

Die App zeigt zuerst **das aktuell Relevante**: eigenes Profil, nächste Spiele/Turniere, belastbare Ergebnisse, Ranglisten und Mannschaftstermine. Seltene Funktionen bleiben erreichbar, ohne die Hauptoberfläche zu überfrachten. Eine Information soll möglichst nur **eine fachliche Heimat** besitzen; Kontextlinks dürfen direkt auf sie verweisen, ohne zweite Pflegeformulare und widersprüchliche Listen einzuführen.

**Erlaubter Veränderungsumfang:** Die *gesamte* Informationsarchitektur, Navigation, Reihenfolge, Texte, Karten, Formulare, Suchabläufe, Desktop-/Mobile-Layouts, Komponenten, Animationen und interne Frontend-Struktur dürfen neu gestaltet werden. **Einzige feste visuelle Grenze: das bereits freigegebene Corporate Design (CD).** Vorhandene Markenidentität, Original-Schmetterlingslogo und freigegebene dunkelblaue/vereinsbezogene Farbidentität nicht ungefragt neu erfinden, austauschen oder umfärben. Die Home-Seite ist eine positive visuelle Referenz, **ihr Aufbau darf** in der neuen Architektur vereinfacht werden. Unverzichtbare Rechte-, Datenschutz-, Daten-, PWA- und Quellenschutzregeln bleiben technische Grenzen, nicht Design-Optionen.

Die Bezeichnung „2.0“ markiert **ein UX-Zielbild**, keine neu erschienene App-Version. Vorliegende alte IA-1 bis IA-5-Entscheidungen bleiben historische Implementierungsnachweise; bei fachlichen Konflikten gilt diese neuere Zielarchitektur als **geplante Weiterentwicklung**, bis sie implementiert und vollständig verifiziert ist.

## 2. Erkenntnisse aus UX-Forschung und Plattformrichtlinien

| Prinzip | Konsequenz in Schmetterlinge |
|---|---|
| Status sichtbar halten | Laden, fehlende Daten, Offline und Aktualität verständlich zeigen; „live“ nur quellengestützt behaupten. |
| Wiedererkennung vor Erinnerung | Navigationsziele, Filter und Aktionen sichtbar und konsistent benennen. Beschriftete Icons statt Icon-Rätsel. |
| Fachsprache der Nutzenden | „Meine Turniere“, „Spieler“, „Teams“, „Folgen“, „Ergebnis“, „Rangliste“ statt interner DB-/Importterminologie. |
| Progressive Offenlegung | Zuerst Titel/Ergebnis/Ort/Termin/Aktion; Quellen, Satzdetails, Filter und seltene Optionen auf Abruf. |
| Konsistenz | Eine Suchlogik, eine Ergebnisdarstellung, eine Art Profile zu wechseln und immer derselbe Home-Rückweg. |
| Fehlervermeidung | Keine falschen Follow-/Profilaktionen, keine Zoomsprünge, verlässliche Zurück-/Vorwärts-Navigation, keine zweite Codeeingabe nach PWA-Installation. |
| Nutzerkontrolle | Klarer Zurückweg, echte Abbruch-/Wiederaufnahmemöglichkeit, persönliche Sortierung und verständliche Zustandswechsel. |
| Minimalismus | Keine doppelte Überschrift, doppelte Funktion, redundant erklärenden Kartentexte oder technischer Warnblöcke auf der Startseite. |
| Adaptive Darstellung | iPhone = aufgabenorientierter Einspaltenfluss; Desktop = breite Listen mit paralleler Detailfläche. |

Die **Drei-Klick-Regel ist kein UX-Gesetz**. Kurze, erwartungskonforme Wege sind wichtiger als eine absolute Klickzahl. Zielwerte unten sind Projekt-Designziele, keine aus Studien abgeleiteten Naturgesetze.

Quellen:
- Nielsen Norman Group: [10 Usability Heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) und [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
- Apple: [Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).
- W3C: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## 3. Referenz-Apps: kritische Wettbewerbs-/Bedienmusteranalyse

**Methodik:** Herstellerbeschreibungen, offizielle Funktionsdokumentation und verfügbare veröffentlichte UI-Informationen; **keine** systematische Nutzerstudie, kein eigener vollständiger Hands-on-Test auf allen Geräten. Die Eignungswerte beschreiben, wie gut ein *Muster* als Inspiration für Schmetterlinge passt, nicht die Gesamtqualität einer App.

| App | Wertvoll für Schmetterlinge | Bewusst nicht übernehmen | Muster-Eignung |
|---|---|---|---|
| **[ebad / BadNet](https://ebad.fr/)** | Badminton-spezifisches Zusammenspiel von Spieler, Rangliste, Turnier, Team, Begegnung; mehrere Konten/Kindernutzer; Turnierfavoriten und Termine | Registrierung/Passwort und umfangreiche Turnieranmeldung als Pflichtablauf; fremde Datenrechte übernehmen | 5/5 für Badminton-/Familienlogik |
| **[Sofascore](https://www.sofascore.com/news/sofascores-new-home-screen-a-smarter-faster-way-to-follow-sports)** | Persönliches Home, angeheftete und manuell sortierbare Wettbewerbe, direkte Filter und kurze Favoritenwege | Mehrsport-, Trending-, Fantasy- und Feed-Komplexität | 5/5 für Personalisierung |
| **[Flashscore](https://www.flashscore.de/faq/capabilities/)** | Kompakte chronologische Score- und Statuslisten; eine klare Favoritenaktion | Hohe Informationsdichte, Notification-Druck; keine Annahme, dass Spielersuche/Folgen identisch implementiert wäre | 5/5 für schnelle Ergebnisübersicht |
| **[Badminton4U (BWF)](https://play.google.com/store/apps/details?id=com.bwf.mobile.app)** | Zusammenhang zwischen Spielerprofil, Turnier, Matchcenter, Rangliste und belegten Live-Ergebnissen | Profi-/World-Tour-Fokus, zusätzlicher Nachrichtenstrom auf der Hauptfläche | 5/5 für Match-/Turnierdetails |
| **[Spond](https://help.spond.com/app/de/articles/765343-startbildschirm-spond-app)** | Kommende Ereignisse, Gruppen-/Termin-Kontext, nachvollziehbare Terminlisten | Chat, Zahlungen, Umfragen und gesamte Vereinsorganisation | 5/5 für Termine und ruhige Eventkarten |

**Synthese:** ebad liefert das passendste Fachmodell, Sofascore die beste Produktidee für Personalisierung, Flashscore den geeigneten Score-Dichtegrad (in unserem Fall reduziert), Badminton4U das Matchcenter-Muster und Spond das Terminmuster. **Keine App 1:1 kopieren**: Unser Produkt soll eine familiäre, regionale und klar begrenzte Badminton-Erlebniswelt bleiben.

## 4. Kritische Bestandsaufnahme aus dem Repository (Sichtung 25.10.2026)

Prüfquellen: `index.html`, `app-shell.css`, `design-v2.css`, `styles.css`, `desktop-dashboard.css`, `desktop-workspace-v176.css`, `settings-rooms.js`, `docs/NAVIGATION_IA1_V183.md`, `docs/SETTINGS_IA3_V184.md`, Issue #13 und #333.

- **Navigation:** fünf reguläre mobile Ziele (Home, Turniere, Spieler, Mannschaft, Berichte), bedarfsweise ein sechster LIVE-Tab; Desktop zusätzlich Verein. Der nachträglich hinzukommende Tab verändert Verteilung und Touchflächen.
- **Home:** sichtbare Blöcke für nächste Termine, Statistik/Filter/Nachweise, heutige Ereignisse, KPI/Trophäen, Ranglisten, Freunde und Wiki. Viele wertvolle Funktionen, aber zu hohe gleichzeitige Informationslast.
- **Eigene Profile/Freunde:** eigene Familienprofile werden hauptsächlich in Einstellungen verwaltet; gefolgte Spieler im Spielerbereich. Fachliche Trennung muss **semantisch erhalten**, aber in einer gemeinsamen Personenoberfläche mit zwei sichtbaren Bereichen organisiert werden.
- **Turnierseite:** Spieltag, Live-Bereich, Suche/Kalender, gefolgte Matches, Spond und Merkliste auf derselben umfangreichen Seite. Daten- und UI-Komplexität entkoppeln.
- **Berichte:** eigenständiger Haupttab plus redaktionelle Teamberichte; sinnvoller als sekundäre Kontextansicht bei Verein/Team/Spieler.
- **Desktop:** vorhandene Sidebar und mehrspaltige Dashboards sind eine Grundlage, noch kein durchgängiger Listen-/Detail-Workspace.
- **CSS:** historische dunkle Grundschicht, helle `design-v2.css`-Schicht, getrennte dunkle Desktop- und weitere Kontrast-/A11y-Overrides führen zu komplexer Kaskade. Statt weitere Overrides zu stapeln: CD-Tokens und Komponenten konsolidieren; **freigegebenes CD nicht ersetzen**.
- **Positiv:** bereits vorhandene kanonische Navigationsrouten, fünf Settings-Räume, Home-Reset, Quellenkennzeichnung, persönliche Sortierung, private Berechtigungslogik und automatisierte Netzübersperrung **weiterverwenden statt neu erfinden**.

Diese Bestandsaufnahme ist ein **Codebefund**, keine Behauptung über die gerade aktive PWA-Version auf allen Endgeräten.

## 5. Neue Informationsarchitektur (verbindliches UX-Soll)

**Mobil genau vier feste, beschriftete Hauptziele**, in beständiger Position:
1. **Start** – persönlicher Tag, nächster Termin, belegte Live-/Ergebnisvorschau, kompakter Profilkontext.
2. **Spieler** – **Meine Profile** (eigene Kinder/Familie), **Gefolgte Spieler** (Fremdprofile), gemeinsame DBV-Suche, Ranglisten, Matches, Trophäen, Statistik, persönliche Berichte.
3. **Turniere** – **Meine Turniere**, **Finden**, **Ergebnisse**; Turnierdetails, Ort, Termin, Kategorie/Altersklasse, Vormerken, Historie, belegte Matchnachweise.
4. **Teams** – gefolgte Mannschaften zuerst, Liga/Saison/Spielplan/Tabelle/Kader/Ergebnisse; Verein als fachlicher Kontext.

**Kopfbereich:** Original-Logo als Home/Start, dauerhaft eindeutig sichtbarer Profilwechsel, Einstellungen (keine fünfte Bottom-Navigation). Persönliche Profile bleiben sichtbar unterscheidbar von gefolgten Spielern.

**Kontext, keine zusätzlichen Tabs:**
- **Heute/LIVE**: Bei nachweislich heute angesetzter Begegnung eine auffällige rote Kontext-Aktion/Karte, **kein** zusätzlicher Bottom-Tab; Live-Status nur bei tatsächlicher Nachweisbarkeit, keine simulierten Zahlen oder Zeiten. Die gespeicherte Event-/Source-Zeit eindeutig von „live“ trennen.
- **Berichte**: bei Spieler, Mannschaft oder Verein, gegebenenfalls gesammelte Berichte als Unteransicht. Nicht als reguläres fünftes Mobilziel.
- **Verein**: auf Desktop zusätzliche Sidebar-/Arbeitsansicht; mobil im Teams-/Spieler-Kontext.
- **Historie, Trophäen, Ranglisten, Statistik, Wiki**: klare Kontext-Heimat und direkte Links, keine weiteren gleichrangigen Bottom-Ziele.
- **Einstellungen**: weiterhin fünf klar definierte Räume (Profile & Familie; App & Darstellung; Zugänge & Freigaben; Daten & Datenschutz; Hilfe & Informationen), aber **fachliche Profilbearbeitung perspektivisch als gemeinsamer, kanonischer Workflow über „Spieler“** anbieten. Settings darf nur gezielt auf diesen Workflow verlinken und nicht ein zweites Formular betreiben.
- Tiefe URLs, Einladungscodes, Browser-Zurück/-Vorwärts, alte Hashes, Offline-PWA-Caches und bestehender lokaler Zustand müssen durch Redirect-/Kompatibilitätsschicht erhalten bleiben.

**Eindeutige Heimat je Aufgabe:** Suchen/Folgen/Sortieren von Spielern unter Spieler, eigene Profile in dort klar getrenntem Bereich; Mannschaften unter Teams; Turnier merken unter Turniere; personenbezogene Ergebnisse direkt am Spieler und als Turnier-Nachweise. Kontextabkürzungen sind ausdrücklich erlaubt, **doppelte Datenpflege nicht**.

### 5.1 Zielwege (Produktakzeptanz, nicht Forschungsnorm)

| Aufgabe | Ziel ab geeigneter Ausgangsansicht |
|---|---|
| Start/Home | 1 Tipp von überall auf Home/Logo |
| Eigenes Spielerprofil wechseln | Profilchip öffnen und mit 1 weiterer Auswahl wechseln |
| Eigenen Spieler hinzufügen | Spieler → Meine Profile → Suchen/Hinzufügen, möglichst 2–3 erkennbare Aktionen |
| Fremdem Spieler folgen | Spieler → Suchen → Folgen, maximal drei verständliche Hauptaktionen |
| Nächsten Termin oder aktuelle Ergebnisse | von Home sofort sehen oder 1–2 Tipps |
| Ergebnisbeleg anzeigen | Tipp auf Ergebnis → genau passender Einzelnachweis |
| Turnier aus Suchtreffer merken | 1 direkte `+`-/Merken-Aktion |
| Turnierort lesen | eigene sichtbare Zeile ohne Detailaufruf |
| Mannschaftstabelle | Teams → Mannschaft → Tabelle, 1–2 Tipps ab Teamliste |
| Aktuelle Rangliste | direkt beim Spielerprofil, 1–2 Tipps |
| Gefolgte Spieler/Teams sortieren | direkt in jeweiliger Liste, ohne Einstellungen-Umweg |

Klickzählungen anhand synthetischer End-to-End-Tests belegen; reale Fehlbedienungen und Verständlichkeit zusätzlich bei einmaliger Schlussabnahme prüfen.

## 6. Inhalt und Layout – mobil

**Home-Reihenfolge nach tatsächlichem Kontext**, nicht nach technischer Widget-Reihenfolge:
1. ruhiger Kopf mit CD-Logo, aktiver eigener Profilwahl, Einstellungen; keine große Versionsanzeige;
2. **bei echtem Spieltag:** belegte „Heute“-Aktion mit Anpfiff/Begegnung; sonst nächster Termin;
3. letzte/aktuelle Ergebnisse, leicht erfassbare Scores und direkte Matchnachweise;
4. kompakte persönliche Ranglisten-/Statistikvorschau mit „Details“;
5. sekundäre Vorschauen auf gefolgte Spieler/Teams, Trophäen und Wiki; nicht alle Tabellen offen anzeigen.

**Informationskarten** sind konsistent. Eine Turnierkarte zeigt auf den ersten Blick: konkreter Titel/Kategorie, **eigene Ort-Zeile**, Datum/Zeit, Altersklasse wenn relevant, statusgerechte Markierung und direktes `+` Merken. Der restliche Kartentext darf keine bloße Wiederholung der Informationen sein. Beim Tippen auf die Karte folgen Details; `+` darf unabhängig davon funktionieren. Ein Ergebnis zeigt Spieler/Disziplin/Gegner, hervorgehobenen Score, Zeitpunkt/Turnier und Antippen für Nachweis. Bei fehlenden Daten keine scheinbar konkreten Bezeichnungen, Matchpunkte oder „live“ erfinden; kurze Erklärung und Originalquellen-Link anbieten.

**Such- und Filtermuster:** universelle visuelle Suchkomponente für Spieler, Mannschaften und Turniere; fachlich getrennte Ergebnisarten und Berechtigungen. Für eigene Profile wie für Folgen DBV-Name/ID-Volltextsuchfunktion an derselben technischen Suchquelle nutzen, aber Aktionen eindeutig unterscheiden; keine ungefragten Volltabellen-Downloads. Zusätzliche Filter (Altersklasse, Verein, Landesverband, Saison) werden erst auf Wunsch eingeblendet. Suche auf iPhone ohne Zoomsprung bei Fokussierung.

**Text:** so wenig wie möglich, so viel wie nötig. Kurze verständliche Labels, keine redundanten Absätze, keine ausschließlich durch Icons erklärten Aktionen. Hinweise zu Datenschutz/Quellen/Aktualität an passenden Details, nicht als dauerhaft dominierende Startseitenblöcke. Begriffe konsistent; sortierbare Listen und Familienprofile müssen erkennbar anders aussehen als gefolgte Fremdspieler.

**PWA/iOS:** Safe-Area berücksichtigen, kein ungewollter Zoom, keine durch Tastatur verdeckten Dialoge, kein horizontales Überlaufen bei 320/390 px, keine unerwartete Neuauthentifizierung; zurück und Start stets verfügbar. Liquid-Glass-Nähe nur zurückhaltend, mit intakter Lesbarkeit, nicht als transparentes Dekorexperiment. Reduzierte Bewegung respektieren. Animierter Federball/Ladebildschirm darf aufgeräumt und realistischer werden; Original-Logo ohne weißes Quadrat. Animation und Wiki-/Minispiel-Inhalte sind sekundär gegenüber Kernwegen und Release-Gates.

## 7. Desktop: vollwertiger Arbeitsbereich statt breites Telefon

- **Stabile Sidebar** mit denselben Domänen und bei Bedarf zusätzlichem **Verein**-Ziel.
- **Listen-/Detail-Muster:** links durchsuchbare Spieler/Mannschaften/Turniere, rechts die ausgewählte Rangliste/Matches/Tabelle/Belege. Kontextwechsel ohne jedes Mal vollständiges Seitenspringen.
- Vereinsübersicht: so viele Spieler wie sinnvoll **auf einen Blick**, Jugend/Erwachsene, Filter und erkennbare Sortierung. Große lesbare Scores, ausreichende Kontraste und Bedienelemente bei 100 % Zoom.
- Desktopbreite sinnvoll ausnutzen; flexible Spalten, keine überlange Textzeilen, keine schmalen zentrierten Mobil-Karten auf großem Monitor.
- Identische Daten-/Berechtigungslogik wie iPhone, **kein zweiter Datenbestand oder doppeltes Rendering für Pflegeaktionen**.

## 8. CD, Lesbarkeit und Barrierefreiheit

- **CD ist unveränderbar**, einschließlich Original-Logo und freigegebener Marke/Grundfarben. Farbwechsel oder neues Logo sind **nicht** Teil des Redesign-Auftrags. Die bereits akzeptierte dunkelblaue Anmutung ist zu bewahren. Ein anderes Hell-/Dunkel-Schema nicht ungefragt global einführen. Bei bestehenden Vereinsbranding-Einstellungen die bewusste Wahl des Nutzers respektieren.
- Die früher vorgeschlagenen freien Hex-Farbpaletten sind **illustrativ, keine neue Markenvorgabe**. Farben nur als Token-Ableitungen aus dem vorhandenen CD; jeder konkrete Paar-Kontrast ist am *tatsächlichen* Hintergrund zu prüfen.
- WCAG 2.2 AA: gewöhnlicher Text >= **4,5:1**, großer Text >= **3:1**, relevante nichttextliche UI-Informationen >= **3:1**; Ausnahmen gemäß WCAG beachten; Status nicht allein durch Farbe.
- Entwurfsziele: Fließ-/Kartentext häufig **16–18 CSS-px**, Sekundärtext möglichst **14–16 CSS-px**, Ergebnisse oft **20–26 CSS-px**; Fokusfelder auf iPhone mit mindestens **16 CSS-px** gegen Autozoom; genügend Platz bei großer Schrift. Werte sind **Designziele**, keine WCAG-Schriftgrößenpflicht. Smartphone-Touchziele bevorzugt >= **44×44 CSS-px** als freiwilliger Qualitätsstandard; Apples native `pt` nicht unbemerkt mit CSS-Pixeln gleichsetzen.
- Kontrast-/Lesbarkeitscheck **durchgängig**: Profilmodal, Platzhalter, (optional)-Labels, Ranglisten, Tabellen, Sortieren, Einladungen, Desktop, alle Dialoge, leerer/Offline-/Fehlerzustand, Disabled-/Hover-/Focus-/Aktiv-Zustand. Nicht den aktuellen Home-Bildschirm ungewollt verschlechtern.
- Neutrales 4-/8-px-Abstandssystem, wenige Kartenvarianten, eindeutige visuelle Hierarchie, sichtbarer Fokus, Tastatur und VoiceOver.
- CSS-Architektur mit zentralen CD-Tokens und Komponenten konsolidieren; Altregeln nur nach nachgewiesener Äquivalenz/Regression entfernen.

## 9. Ersteinrichtung und Berechtigungen

- Erstinstallation als **vier kurze Schritte**: eigenes Profil → weitere Kinder/Spielerprofile (optional) → Mannschaft folgen (optional) → Turniere merken (optional). Ein Satz und eine Hauptaktion je Schritt; Fortschritt, Zurück, Überspringen, Unterbrechung/Wiederaufnahme.
- Bestehende Nutzer niemals zwangsweise neu einrichten; kein Löschen lokaler Daten, keine Pflichtregistrierung.
- **Eigene Familie ≠ gefolgte Spieler.** Keine automatische Übernahme fremder Profile in Familie; Zugriffsrecht/Einladung bleibt separat und serverseitig geprüft.
- Einladung aus Safari und Homescreen-App übernehmen; **kein zweiter Freigabecode** nach Installation. Bestehende Schlüssel/Storage-/Freigabeabläufe kompatibel halten.
- Quellenschutz, Betreiberrechte, Datenschutz und Freigabestatus dürfen auch durch direkte Deep Links nicht umgangen werden. Externe Datenrechte (#56) und autorisierter Live-Zugang (#17) sind **nicht** durch Redesign gelöst.

## 10. Umsetzungspakete (fachliche Reihenfolge)

| Paket | Inhalt | Abnahmeziel |
|---|---|---|
| **A – Navigation/IA** | Vier feste mobile Ziele, semantische Kontextansichten, Profilchip, Alt-URL-Übergänge, keine doppelten Pflegewege | Home von überall, Profile/Freunde eindeutig, Zurück/Deep Link stabil |
| **B – CD-Designsystem** | Token-Inventur, konsistente Karten/Scores/Suchen/Filter/Inputs, CSS-Layer konsolidieren, AA-Kontrast | Kein CD-Wechsel; einheitliche Komponenten über alle Screens |
| **C – Mobile Flows** | Home, Spieler, Turniere, Teams, Live-Kontext, Suche, Hinzufügen, Historie, Onboarding | End-to-End-Kernwege, iPhone 320/390, keine Zoom-/Codefehler |
| **D – Desktop-Workspace** | Sidebar, Vereinsliste, Listen-/Detailansicht, Tabellen, Sortieren, responsives Layout | 1280/1440/1920 ohne Überlauf, lesbar bei 100 % |
| **E – Gesamtabnahme** | Synthetische End-to-End-/A11y-/Offline-/PWA-/Sicherheitsregressionen, exakte Main-/Pages-Gates, einmalige Schlusscheckliste | Nur belegte Erfolge als abgeschlossen markieren |

**Bestehendes Backlog nicht ignorieren:** #13 (Navigation/IA), #306 (Volltextsuche für zusätzliches Familienprofil), #333 (Kontrast), #305 (Onboarding) sowie Turnierort/-kategorie/+Merken, einheitliche Ergebnisnachweise, Sortierung von Spieler/Teams, iPhone-Zoom und Animationen. Vor neuer Umsetzung laufende PRs/Automationen, bereits gemergte Funktionen und Releaseblocker abgleichen; keine parallelen widersprüchlichen Feature-PRs, keine ungesicherten Aussagen zu „live“ oder „erledigt“. Arbeiten streng sequenziell und große, aber beherrschbare Pakete. **Keine manuellen Zwischenabnahmen**; automatisierte technische Gates und **eine** physische Schlussabnahme als abhakebare Liste.

**Funktionierende Bestände schützen:** CI/Unit/Playwright vollständig synthetisch mit Netzwerksperre zu produktivem Supabase, gezielte reale Prüfungen nur ausdrücklich und möglichst lesend; keine zusätzlichen Freeplan-Kosten, keine Trackingdienste, keine neuen kostenpflichtigen Dienste, bestehende Nutzerprofile/Bookmarks/Freigaben behalten. Bei externen Blockern separat dokumentieren und andere Pakete weiterbearbeiten.

## 11. Messbare UX-Kriterien für die Schlussabnahme

1. Alle vier Hauptbereiche bleiben jederzeit an derselben Stelle und sind per Touch/Tastatur erreichbar. „Heute“ ändert nicht das Navigationsraster.
2. Home/Logo öffnet immer das aktive **eigene** Familienprofil; gezieltes Anzeigen eines gefolgten Spielers verändert diese eigene Auswahl nicht.
3. Profilwechsel und Hinzufügen haben eindeutige Begriffe; eigene und fremde Spieler können nicht unabsichtlich verwechselt werden.
4. DBV-Namens-/ID-Suche liefert klar erkennbare Treffer und fachlich passende Aktionen; Mannschaft/Turnier-Suche haben dieselben Bedienelement-Muster.
5. Jedes Turniersuchergebnis zeigt eine **konkrete Kategorie** (soweit belegbar) und **eigenständige Ort-Zeile**; Vormerken ohne Umweg, Fallback ohne erfundene Angaben.
6. Tippen auf Score führt exakt zum zugehörigen Einzelnachweis; Freilos und nicht gespielte Begegnungen nicht als Sieg/Niederlage zählen.
7. Dynamischer „Heute“-Hinweis nur bei belegter Terminlage, echte Live-Angaben nur mit gültiger Quelle/Zeitstempel.
8. Sortierbare Spieler/Teams funktionieren auf iPhone und Desktop, ohne Einstellungs-Doppelwege.
9. Keine horizontale Überläufe/Autozoom bei 320/390/768/1280/1440/1920 px; Tastatur, Dialoge, VoiceOver/Screenreader und reduzierte Bewegung berücksichtigen.
10. Kontrastpaare/Schrift/Touchziele auch in Modal- und Randzuständen prüfen; unveränderte CD-Markenidentität nachweisen.
11. Safari-zu-PWA-Einladungsannahme, Profilbestand, Datensicherung, Offline-Shell, Zurück/Reload und lokale Persistenz bestehen Regressionen.
12. Synthetische Tests berühren **kein produktives Supabase**; Rechte/RLS/Quellenunterscheidung unverändert; CI- und Pages-Status exakt auf gemergter Commit-SHA nachgewiesen.
13. Erst nach Abschluss aller Pakete eine **einzige** reale iPhone-/Desktop-Schlussabnahme-To-do-Liste; offene externe Rechte-/Datenzugangspunkte nicht als gelöst ausweisen.

Technische Performance-Ziele, **nur soweit für Nutzer sinnvoll messbar:** INP <= 200 ms und CLS <= 0,1 am 75. Perzentil. Dies sind Web-Vitals-Zielwerte, keine in der vorliegenden Analyse bereits erhobenen Messwerte.

## 12. Projektweite Entscheidungsregel

**Jede neue Funktion muss eine dieser Fragen positiv beantworten:** Ist die Information aktuell/korrekt und relevant? Kommt der Nutzer erkennbar schneller ans Ziel? Bleibt die Oberfläche leichter verständlich? Bleiben CD, Datenschutz, Freeplan und vorhandene Daten intakt? Werden bestehende Funktionen wiederverwendet statt dupliziert?

Wenn nicht, Funktion sekundär platzieren oder weglassen. **Ein Ende finden:** Erst Kernwege bis zur belastbaren Endabnahme perfektionieren, danach optionale Erweiterungen nur nach nachgewiesenem Nutzen.

---
**Dokumentationsstatus:** Diese Datei integriert die UX-Recherche, den kritischen Vergleich und das freigegebene Änderungsmandat. **Keine UI-Implementierung, kein Merge von UI-Code, keine Live-Abnahme durch dieses Dokument.**
