# IA-4 · Navigation und Startübersicht (Issue #13, v185)

Stand: 22.10.2026. IA-1 bis IA-3 sind umgesetzt; v184 wurde für die Weiterarbeit manuell freigegeben.

## Kanonische Benutzerwege
- **Home** zeigt das aktuell gewählte eigene Profil, Spielstatistik und Vorschauen. Das Logo und der Home-Tab führen auch nach einem iPhone-Hashwechsel sofort zurück.
- **Turniere** umfasst Turniertag und Historie. „Heute“ bleibt ein kontextbezogener Shortcut und erscheint ausschließlich bei belegter heutiger Ansetzung; keine Behauptung laufender Team-Ergebnisse.
- **Spieler** verwaltet gefolgte Spieler, getrennt von eigenen Familienprofilen; **Mannschaft** verwaltet gefolgte Teams; **Berichte** ist der redaktionelle Lesebereich.
- Die bestehenden **fünf Einstellungen** bleiben unverändert, sind über das Kopf-Symbol auch auf iOS unmittelbar erreichbar. Legacy-Links bleiben kompatibel.
- **Desktop** bietet zusätzlich Verein, verwendet denselben Router und dieselben Profil-/Rechtezustände; kein zweiter Codepfad.

## Technische Änderungen
- Alle primären und die zwei wichtigen Home-Kontextziele (Historie und belegte Heute-Ansicht) verwenden denselben synchronen Navigationsweg für iOS/WebKit; Settings als eigenes primäres Ziel.
- Eine nicht belegte Heute-Verknüpfung fällt auf Turniere zurück, statt als Live-Match zu erscheinen.
- Profilorientierung unterscheidet „Eigenes Profil“ von „Gefolgter Spieler“, ohne gespeicherte Profile oder Einladungsschlüssel zu ändern.
- Kleine iPhone-Navflächen bleiben mindestens 44px und zeigen aktive Ziele mit sichtbarem Fokus/AA-tauglichem Kontrast.
- Release v185: genau eine weitere statische CSS-Datei im Service-Worker-Precache, kein zusätzlicher Netzwerkjob.

## Sicherheits- und Abnahmegates
Normale Node/Chromium/WebKit-Tests verwenden ausschließlich synthetische Fixtures mit harter Netzsperre gegen produktive Supabase-Domains. 320/390 und 1280/1440/1920 px, Browser-Back/Hash, Keyboard, Profile, nachgewiesene Heute-Karte, Offline-PWA, keine zweite Einladungseingabe. Merge erst nach fünf grünen PR-Gates auf identischem HEAD; Main Tests/Chromium/WebKit/Pages anschließend vollständig grün, danach echte iPhone- und Desktop-Abnahme **vor IA-5**.
