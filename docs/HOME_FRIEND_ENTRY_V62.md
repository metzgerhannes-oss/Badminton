# v62 – Ein Einstieg je Kontext: Freunde auf Home

Stand: 11.10.2026 · Basis: v61 · P1 Menü- und UX-Bereinigung.

## Ausgangslage
Home zeigte in der Freunde-Sektion zwei Links **„+ Freund“** und **„Verwalten“**, die beide in den Bereich `#spieler` führten. Zusätzlich erschien bei noch leerer Freundeliste dort eine dritte Schaltfläche. Die nebeneinanderliegenden Links boten somit mehrere scheinbar verschiedene Wege zur selben Bibliothek.

## Änderung
- Ohne gefolgte Spieler zeigt Home **eine** große Aktion **„Spieler suchen und folgen“**; der Link führt in die vorhandene Spielerbibliothek.
- Sobald jemand gefolgt wird, erscheinen die Schnellwechsel-Karten und als einzige Verwaltungsaktion **„Freunde verwalten“** im Kopf der Sektion. Die Leerlauf-Aktion entfällt dann.
- Das Entfernen des letzten Freundes stellt automatisch die klare Suchaktion wieder her.
- Die Navigation bleibt `Home · Turniere · Spieler · Berichte` mit Einstellungen im Kopfbereich. Kein fünfter Tab, keine zweite Suche und keine neuen Nutzerprofile.
- Die vorhandene Funktion `window.badmintonSelectViewer` bleibt für den Wechsel zwischen eigenen Profilen und gefolgten Spielern maßgeblich.
- Der obsolete Listener des entfernten Home-Buttons wird gestrichen. Ein `[hidden]`-CSS-Kontrakt stellt sicher, dass der verbliebene Link auf iPhones zuverlässig ausgeblendet ist.

## Prüfungen und Grenzen
- Neue DOM-/Zustandsregression `tests/friend-home-entry.mjs`: 0, 1 und wieder 0 Freunde, nur ein Kontext-CTA, bestehender Freundeswechsel.
- Bestehende Profile, Turnierfavoriten, lokale Backups und `shuttleboard-v1` bleiben unverändert.
- Cache-Rotation auf `schmetterlinge-shell-v62` mit aktualisierten Testfixtures.
- Keine Änderung der DBV-Datenquellen, RLS-Policies, historischen Matchvollständigkeit oder Live-Rechte.
- Eine echte iPhone-SE- und VoiceOver-Abnahme wird nicht durch die Browser-QA ersetzt.

## Offener nächster P1-Block
Die doppelte CSS-Kaskade `styles.css` / `design-v2.css` und der verbliebene DOM-/Formularcode in `app.js` benötigen weitere **kleine, einzeln überprüfbare** Extraktionen. Vor CSS-Löschungen müssen sichtbare Zustände bei 320–390 px, 200 % Schriftvergrößerung sowie Modal-/Safe-Area-Konflikte abgesichert sein.
