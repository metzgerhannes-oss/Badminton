# v70 – CSS-Kaskade konsolidiert

## Ziel

Nach der Modularisierung der Gestaltungsschichten und dem Entfernen alter Prototyp-Komponenten blieben in den Basisschichten Mehrfachdeklarationen derselben Eigenschaft unter **identischem Selektor und identischer Media-Bedingung**. Die spätere Deklaration überschreibt die frühere vollständig.

## Änderung

- `styles.css`: 62 überschriebenen Eigenschaftsdeklarationen entfernt und zwölf danach leere Regelblöcke bereinigt.
- `design-v2.css`: fünf überschriebenen Eigenschaftsdeklarationen entfernt und einen danach leeren Regelblock bereinigt.
- Insgesamt 67 redundante CSS-Deklarationen und 13 leere Regelblöcke entfernt.
- `styles.css` wurde von 51.622 auf 50.247 Zeichen reduziert; `design-v2.css` von 38.054 auf 37.948 Zeichen. **1.481 Zeichen weniger**, ohne Selektoren umzusortieren.
- `ui-components.css` und `app-shell.css` bleiben unverändert.
- Regeln für das freigegebene Vereinslogo (`mask`, `clip-path`, mobile Größe) wurden ausdrücklich nicht entfernt; ebenso wenig die noch benötigten Grundlayouts.
- Ein neuer CI-Test kontrolliert Mehrfachdefinitionen derselben Eigenschaft in identischen Geltungsbereichen. Erweiterte Chromium/WebKit-Tests sichern die Hauptansichten und Dialoge bei kleinen und größeren Viewports.
- PWA-Cache v70 gewährleistet das erneute Laden der Stylesheets.

## Begrenzung

Die Konsolidierung ist **kein Redesign**; sie verändert weder angezeigte Matchdaten noch private Familienprofile, Datenquellen oder Datenbankberechtigungen. Nicht identische Selektoren und abweichende Media-Queries wurden bewusst nicht automatisch zusammengeführt, weil dadurch Kaskadenprioritäten verändert werden könnten. Die Prüfung auf einem echten iPhone und mit VoiceOver bleibt separat offen.
