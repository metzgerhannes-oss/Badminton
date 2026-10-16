"use strict";
// Schmetterlinge – compact editorial wiki. Search runs in the browser; no account or analytics.
// Each card is linked to the cited DBV/BWBV rule; independent review remains tracked separately.
const DBV="https://www.badminton.de/fileadmin/dateien_upload/dateien_2026/juli_2026/dbv_satzungswerk_2026-27_stand_13.06.2026.pdf";
const FAQ="https://www.badminton.de/der-dbv/jugend-wettkampf/faq/";
const RANK="https://www.badminton.de/der-dbv/jugend-wettkampf/allgemeine-ranglisten-bestimmungen/";
const BWBV="https://bwbv.de/2025/12/25/small-games-bei-bwbv-jugendturnieren-in-2026/";
const BWBV_J="https://bwbv.de/wp-content/uploads/2025/12/80-Jugendordnung.pdf";
const FIFTEEN="https://www.badminton.de/news/badminton/neue-zaehlweise-dbv-praesidium-beschliesst-einfuehrung-von-3-x-15/";
// [topic, question, answer, search terms, validity/scope, source, illustration]
const DATA=[
["grundlagen","Welche Maße darf ein Schläger haben?","Maximal 68 cm lang und 23 cm breit.","schläger schlaeger masse länge breite regel","Spielregel 4.1",DBV,"racket"],
["grundlagen","Wie sieht ein Naturfederball aus?","Er hat 16 Federn und wiegt 4,74 bis 5,50 g.","spielball naturfeder federzahl gewicht kork federball","Spielregel 2.2",DBV,"shuttle"],
["grundlagen","Was wird vor Spielbeginn gewählt?","Die gewinnende Seite wählt Auf-/Rückschlag oder Feldseite. Die andere Seite wählt aus den übrigen Möglichkeiten.","wahl auslosung seitenwahl anfangen aufschlagen spielbeginn","Spielregel 6",DBV,"choice"],
["grundlagen","Wie groß ist das Spielfeld?","13,40 m lang; im Doppel 6,10 m und im Einzel 5,18 m breit.","feld größe spielfeld länge breite netz maß meter","Spielregeln 1",DBV,"court"],
["grundlagen","Welche Linien gelten im Einzel?","Die inneren Seitenlinien begrenzen das Einzelfeld. Die hintere Grundlinie zählt zum Feld.","einzel seitenaus grundlinie linie","Spielregeln 1",DBV,"single"],
["grundlagen","Welche Linien gelten im Doppel?","Im Doppel gelten die äußeren Seitenlinien. Beim Aufschlag ist das hintere Feld um 76 cm kürzer.","doppel seitenaus hintere aufschlaglinie","Spielregeln 1",DBV,"double"],
["grundlagen","Wo liegt die kurze Aufschlaglinie?","1,98 m vom Netz entfernt. Der Aufschlag muss über die Linie in das diagonale Feld gelangen.","kurze vordere aufschlaglinie 1.98","Spielregeln 1 und 9",DBV,"service"],
["grundlagen","Wohin muss der Aufschlag?","Diagonal ins gegenüberliegende Aufschlagfeld. Ein Aufschlag auf die gültige Linie zählt.","diagonal feld einzel doppel aufschlag","Spielregeln 9–11",DBV,"serve"],
["grundlagen","Wer schlägt von rechts auf?","Bei geradem eigenem Punktestand: von rechts. Das gilt auch bei 0 Punkten.","gerade null 0 zwei rechts aufschlag","Spielregeln 10–11",DBV,"even"],
["grundlagen","Wer schlägt von links auf?","Bei ungeradem eigenem Punktestand: von links.","ungerade 1 3 links aufschlag","Spielregeln 10–11",DBV,"odd"],
["grundlagen","Wann ist ein Spiel gewonnen?","Wer zuerst zwei Sätze gewinnt, gewinnt das Match.","match spiel gewinn best of three","Spielregeln 7",DBV,"bestof"],
["grundlagen","Wie zählt man bis 21?","Ein Satz endet bei 21 Punkten mit mindestens zwei Punkten Vorsprung; spätestens entscheidet der 30. Punkt.","21 punkt zaehlweise satz 29:29 30","Standardzählweise – Ausschreibung beachten",DBV,"score21"],
["grundlagen","Was passiert bei 20:20?","Es wird bis zum Zwei-Punkte-Vorsprung weitergespielt. Bei 29:29 gewinnt der 30. Punkt.","20 20 verlängerung 30 29","Standardzählweise 3 × 21",DBV,"deuce21"],
["grundlagen","Wie funktioniert 3 × 15?","Zwei Gewinnsätze bis 15; bei 14:14 mit zwei Punkten Abstand, höchstens bis 21.","2027 umstellung 15 14 20 21 zaehlweise","DBV-Individualturniere ab 04.01.2027; regional abweichend",FIFTEEN,"score15"],
["grundlagen","Wann werden die Seiten gewechselt?","Nach Satz 1 und vor Satz 3; im dritten Satz bei 11 Punkten (21er) bzw. 8 Punkten (15er).","seite wechseln pause dritter entscheidungssatz","Abhängig von der geltenden Zählweise",DBV,"switch"],
["grundlagen","Wie hoch ist das Netz?","An den Pfosten 1,55 m, in der Mitte 1,524 m.","netzhöhe netz mitte 1.55 1.524","Spielregeln 1",DBV,"netHeight"],
["grundlagen","Darf ein Ball die Linie berühren?","Ja. Berührt der Ball die gültige Linie, ist er im Feld.","aus in auf linie federn boden","Spielregeln 13",DBV,"line"],
["grundlagen","Wie lange sind die Pausen?","Bis 60 Sekunden im Satz beim Pausenpunkt und bis 120 Sekunden zwischen zwei Sätzen.","pause 60 120 sekunden unterbrechung","Spielregeln 16; Pausenpunkt abhängig von Zählweise",DBV,"clock"],
["grundlagen","Welche Spielarten gibt es?","Einzel: 1 gegen 1. Doppel und Mixed: 2 gegen 2, beim Mixed jeweils Frau und Mann pro Paar.","disziplin spielart einzel doppel mixed","Spielregeln 10–11",DBV,"teams"],
["spielsituationen","Darf man den Federball beim Aufschlag drehen?","Nein. Kein Spin beim Loslassen; der Schläger muss zuerst die Ballbasis treffen.","spin spinaufschlag ball drehen kork basis zuerst","Spielregel 9.1.5",DBV,"spin"],
["spielsituationen","Was, wenn man beim Aufschlag den Ball verfehlt?","Fehler. Ein begonnener Aufschlag gilt auch bei einem Fehlversuch als ausgeführt.","verfehlen miss erfolgloser aufschlag vorbei","Spielregeln 9.1.8 und 9.3",DBV,"missServe"],
["spielsituationen","Müssen beide Füße beim Aufschlag stehen?","Ja. Beide Füße müssen teilweise den Boden berühren und bis zum Treffpunkt stillstehen.","fuß aufschlagfehler standlinie treten abheben","Spielregel 9.1",DBV,"feet"],
["spielsituationen","Wie hoch darf der Aufschlag sein?","Bei DBV-Turnieren ohne Messgerät: Ball unter der Taille, Schläger abwärts. Sonst: ganz unter 1,15 m.","aufschlaghöhe taillenhöhe 115 1,15 servicehöhe aufschlag zu hoch","Spielregel 9 / nationale Alternative",DBV,"height"],
["spielsituationen","Darf die Aufschlagbewegung stoppen?","Nein. Nach Beginn muss der Schläger bis zum Treffer weiter nach vorn gehen.","bewegung halt stoppen ausholen","Spielregel 9.1",DBV,"move"],
["spielsituationen","Was, wenn der Rückschläger nicht bereit ist?","War der Empfänger nicht bereit und versuchte keinen Rückschlag, wird wiederholt.","empfänger bereit wiederholung","Spielregel 14",DBV,"receiver"],
["spielsituationen","Wer nimmt den Aufschlag im Doppel?","Nur der diagonal gegenüberstehende richtige Rückschläger darf den Aufschlag annehmen.","doppel annahme falscher partner diagonal","Spielregel 11",DBV,"serve"],
["spielsituationen","Wer schlägt im Doppel nach eigenem Aufschlagpunkt auf?","Dieselbe Person schlägt von der anderen Seite erneut auf.","doppel aufschlagfolge rotation vier spieler","Spielregel 11",DBV,"serveAgain"],
["spielsituationen","Wann wechseln Doppelpartner ihre Seiten?","Nur wenn sie bei eigenem Aufschlag punkten. Bei Rückschlaggewinn wechseln sie nicht sofort die Positionen.","doppel stellung partner wechseln rotation","Spielregel 11",DBV,"rotate"],
["spielsituationen","Darf der Ball das Netz berühren?","Ja. Fliegt er trotz Netzberührung ins gültige gegnerische Feld, läuft der Ballwechsel weiter.","netzroller netzkante über netz","Spielregel 13",DBV,"netRoller"],
["spielsituationen","Ist die Netzberührung ein Fehler?","Ja, wenn Spieler oder Schläger während des Ballwechsels das Netz berühren.","netz netzberuehrung schläger berühren","Spielregel 13",DBV,"netTouch"],
["spielsituationen","Darf der Schläger übers Netz ragen?","Treffe den Ball auf deiner Seite. Danach darf der Schläger über das Netz schwingen.","über netz nachschwingen netzüberschreitung","Spielregel 13",DBV,"netFollow"],
["spielsituationen","Aufschlag bleibt im Netz hängen?","Fehler. Der Gegner gewinnt den Ballwechsel.","ball hängt netz aufschlag","Spielregel 13",DBV,"hangServe"],
["spielsituationen","Rückschlag bleibt im Netz hängen?","Bleibt der Rückschlag oben am Netz oder nach Überfliegen darin hängen, gibt es Wiederholung.","ball hängt netz rückschlag let","Spielregel 14",DBV,"hangReturn"],
["spielsituationen","Darf man den Ball zweimal schlagen?","Zwei getrennte Schläge derselben Person sind ein Fehler. Rahmen und Saiten in einem Schlag sind erlaubt.","doppelschlag zweimal","Spielregel 13",DBV,"doubleHit"],
["spielsituationen","Was passiert bei falscher Aufschlagposition?","Die Stellung wird nach Entdeckung korrigiert. Der bisherige Spielstand bleibt bestehen.","stellung falscher empfänger fehler korrigieren","Spielregel 12",DBV,"wrongPosition"],
["spielsituationen","Was ist ein Let?","Ein Let ist eine Wiederholung. Der Punktestand bleibt unverändert, und der letzte Aufschläger serviert erneut.","let wiederholung unterbrechung","Spielregel 14",DBV,"let"],
["spielsituationen","Was gilt bei einem Deckenball?","Bei DBV-Hallen von 5 bis unter 9 m: Aufschlag an Decke = Wiederholung. Danach im Ballwechsel: Fehler.","decke hallendecke niedrige halle","Spielregel 13.3.3 – DBV-Sonderfall",DBV,"ceiling"],
["spielsituationen","Darf man während des Spiels beraten?","Beratung ist zwischen Ballwechseln erlaubt, bevor Aufschläger und Rückschläger bereitstehen.","coaching trainer pause betreuer beraten","Spielregel 16.5.1",DBV,"coach"],
["spielsituationen","Was tun ohne Schiedsrichter?","Auch Spieler dürfen „Wiederholung“ rufen. Bei Unklarheiten das Turnierverfahren nutzen oder die Turnierleitung fragen.","schiedsrichter umpire selbstentscheid streit let wiederholung","Spielregel 14.1 / Turnierordnung",DBV,"let"],
["spielsituationen","Wann ist der Ballwechsel vorbei?","Der Ballwechsel endet bei Bodenberührung, Fehler, Wiederholung oder wenn der Ball nach Netztreffer zurückfällt.","tot spielende punkt ball","Spielregel 15",DBV,"rallyEnd"],
["jugend","Welche Jugendaltersklassen gibt es?","BWBV-Turniere: meist U11 bis U19. In der DBV-Jugendrangliste gibt es auch U9.","alter altersklassen jugend geburtsjahr jahrgang","Jugend – Altersstichtag je Saison prüfen",BWBV_J,"ages"],
["jugend","Was bedeuten A- bis E-Turniere?","A = DBV, B = Gruppe, C = Landesverband, D = Bezirk, E = Region/Kreis. Einzelne Altersklassen haben Ausnahmen.","a rlt b rlt c rlt d rlt e rlt turnierklassen level","DBV-Jugendwettkampfsystem",FAQ,"levels"],
["jugend","Gibt es B-Turniere für U11?","In der regulären DBV-Jugendrangliste ist U11 den Kategorien A sowie C–E zugeordnet, nicht B.","u11 b rlt altersklasse möglich","DBV-Jugendrangliste – aktuelle Ausschreibung zählt",FAQ,"levelsU11"],
["jugend","Wie viele Turniere zählen für die Jugendrangliste?","Je Disziplin zählen die fünf besten Wertungen der letzten zwölf Monate.","rangliste beste fünf 5 turniere","DBV-Jugendrangliste",FAQ,"ranking"],
["jugend","Wann verfallen Jugendranglistenpunkte?","Eine Turnierwertung bleibt zwölf Monate gültig.","punkte ablauf 12 monate verfallen","DBV-Jugendrangliste",FAQ,"months"],
["jugend","Wann wird die Jugendrangliste aktualisiert?","Die Jugendrangliste wird jeden Donnerstag aktualisiert.","ranking update wöchentlich donnerstag","DBV-Jugendrangliste",FAQ,"weekday"],
["jugend","Wie entstehen Ranglistenpunkte?","Turnierkategorie, Altersklasse und Platzierung bestimmen die Wertung. Die offizielle Punktetabelle ist maßgeblich.","punkteplatzierung punktetabelle punkte a b c d e","DBV-Jugendrangliste",RANK,"podium"],
["jugend","Was sind Small Games?","U11 und U13 spielen teilweise auf kleineren Feldern. Die Ausschreibung nennt die Spielform.","kleinfeld small games verkleinert u11 u13 box","BWBV-Jugendturniere 2026",BWBV,"small"],
["jugend","Was bedeutet Einzel „Box“?","Nur das Einzelfeld zwischen kurzer und hinterer Doppel-Aufschlaglinie zählt.","box small games einzel vorne hinten","BWBV-Spielform 1 · 2026",BWBV,"smallbox"],
["jugend","Was bedeutet „ohne Hinterfeld“?","Im Einzel endet das Feld an der hinteren Doppel-Aufschlaglinie.","small games feld ohne hinten u13","BWBV-Spielform 8 · 2026",BWBV,"smallnoback"],
["jugend","Welche Small Games gelten beim C-RLT?","BWBV 2026 (U11/U13): 1. C-RLT Box, 2. ohne Hinterfeld, 3. Standardfeld. U13: 4. Mixed statt Einzel.","c rangliste small games c rlt bwbv 2026","BWBV-Jugendordnung 2026, Anhang 3",BWBV_J,"smallSchedule"],
["jugend","Darf man in einer höheren Altersklasse spielen?","Entscheidend sind Altersklassenregel und Turnierausschreibung.","hochmelden u13 u15 u17 höhere altersklasse","DBV/BWBV – konkrete Ausschreibung prüfen",BWBV_J,"ages"],
["grundlagen","Wer bekommt nach einem Ballwechsel einen Punkt?","Die Seite, die den Ballwechsel gewinnt, erhält einen Punkt – unabhängig davon, wer aufgeschlagen hat.","rally point punktevergabe ballwechsel sieger","Spielregel 7.3",DBV,"bestof"],
["grundlagen","Wie viele Aufschlagversuche hat man?","Es gibt keinen zweiten Versuch. Ein verfehlter Aufschlag ist ein Fehler.","zweiter aufschlag versuch wiederholen fehler","Spielregeln 9 und 13",DBV,"missServe"],
["grundlagen","Welche hintere Linie zählt beim Doppelaufschlag?","Die innere hintere Doppel-Aufschlaglinie begrenzt das gültige Aufschlagfeld.","doppel aufschlag hintere linie feld hinten","Spielregeln 1 und 11",DBV,"double"],
["spielsituationen","Federball berührt Körper oder Kleidung?","Fehler. Berührt der Federball eine Person oder deren Kleidung, verliert ihre Seite den Ballwechsel.","körper körperkontakt kleidung federball getroffen","Spielregel 13.3",DBV,"fault"],
["spielsituationen","Ball landet vollständig außerhalb der Linien?","Aus. Die gegnerische Seite gewinnt den Ballwechsel.","aus außerhalb hinter grundlinie seitenlinie boden","Spielregel 13.3",DBV,"line"],
["spielsituationen","Darf man beim Aufschlag auf der Linie stehen?","Nein. Aufschläger und Rückschläger dürfen die Linien ihres Aufschlagfeldes dabei nicht berühren.","aufschlag linie fuß stellung stehen feld","Spielregel 9.1",DBV,"feet"],
["spielsituationen","Ist absichtliches Ablenken des Gegners erlaubt?","Nein. Absichtliche Ablenkung durch Rufe oder Gesten während des Ballwechsels ist ein Fehler.","rufen ablenkung gesten gegner stören","Spielregel 13.4",DBV,"coach"],
["spielsituationen","Netzroller beim Aufschlag: weiterspielen?","Ja. Fliegt der Ball über das Netz ins gültige Aufschlagfeld, läuft der Ballwechsel weiter.","netz aufschlag netzroller gültig feld","Spielregeln 9 und 13",DBV,"netRoller"],
["jugend","Gilt ab 2027 überall die 15er-Zählweise?","Nein. Ab 4. Januar 2027 ist 3 × 15 für DBV-Individualturniere verbindlich; Landes- und Mannschaftswettbewerbe können abweichen.","2027 15 satz umstellung jugend","DBV-Individualturniere ab 04.01.2027",FIFTEEN,"score15"]
];
const TOPICS={grundlagen:"Grundregeln",spielsituationen:"Spielsituationen",jugend:"Jugend & Turniere"};
const CARDS=DATA.map((a,i)=>({id:"regel-"+String(i+1).padStart(2,"0"),topic:a[0],title:a[1],answer:a[2],terms:a[3],scope:a[4],source:a[5],kind:a[6]}));
const SVG_START='<svg viewBox="0 0 400 264" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">';
const SVG_END='</svg>';
// Court drawn at a fixed scale. 352 px = 13.40m, 160 px = 6.10m.
// Singles sidelines y=64/200, short service x=148/252, doubles back x=44/356.
function court(kind){
 const fill='<rect x="24" y="52" width="352" height="160" rx="2" fill="#0c9778"/>';
 const overlays={
  single:'<rect x="24" y="64" width="352" height="136" fill="#cef050" opacity=".50"/>',
  double:'<rect x="24" y="52" width="352" height="160" fill="#a5dcff" opacity=".37"/>',
  service:'<rect x="252" y="64" width="104" height="68" fill="#ffde54" opacity=".65"/>',
  serve:'<rect x="252" y="64" width="104" height="68" fill="#ffde54" opacity=".65"/>',
  even:'<rect x="252" y="64" width="104" height="68" fill="#ffde54" opacity=".65"/>',
  odd:'<rect x="252" y="132" width="104" height="68" fill="#ffde54" opacity=".65"/>',
  small:'<rect x="44" y="64" width="104" height="136" fill="#ffe55a" opacity=".65"/><rect x="252" y="64" width="104" height="136" fill="#ffe55a" opacity=".65"/>',
  smallbox:'<rect x="44" y="64" width="104" height="136" fill="#ffe55a" opacity=".72"/><rect x="252" y="64" width="104" height="136" fill="#ffe55a" opacity=".72"/>',
  smallnoback:'<rect x="44" y="64" width="156" height="136" fill="#ffe55a" opacity=".66"/><rect x="200" y="64" width="156" height="136" fill="#ffe55a" opacity=".66"/>'
 };
 const lines='<rect x="24" y="52" width="352" height="160" rx="1" fill="none" stroke="white" stroke-width="3"/>'
 +'<path d="M24 64H376 M24 200H376 M44 52V212 M148 52V212 M252 52V212 M356 52V212 M24 132H148 M252 132H376" stroke="white" fill="none" stroke-width="3"/>'
 +'<path d="M200 49V215" stroke="#194d68" stroke-width="6"/>';
 const arrow=(kind==="serve"||kind==="even")?'<path d="M91 169Q200 48 308 97" stroke="#fee44c" stroke-width="6" fill="none" stroke-dasharray="10 7"/><path d="m292 87 17 12-19 11" fill="none" stroke="#fee44c" stroke-width="6"/>':
 kind==="odd"?'<path d="M91 98Q200 216 307 166" stroke="#fee44c" stroke-width="6" fill="none" stroke-dasharray="10 7"/><path d="m290 156 19 10-17 12" fill="none" stroke="#fee44c" stroke-width="6"/>':'';
 const caption={
  court:"13,40 m · Breite Doppel: 6,10 m",single:"EINZEL · INNERE SEITENLINIE",
  double:"DOPPEL · ÄUSSERE SEITENLINIE",service:"KURZE AUFSCHLAGLINIE: 1,98 m",
  serve:"DIAGONAL AUFSCHLAGEN",even:"GERADE PUNKTE · RECHTS",
  odd:"UNGERADE PUNKTE · LINKS",small:"BEISPIEL: VERKLEINERTES FELD",
  smallbox:"BOX · OHNE VORDER-/HINTERFELD",smallnoback:"OHNE HINTERFELD"
 }[kind]||"";
 return SVG_START
 +'<rect width="400" height="264" rx="20" fill="#d8f1ff"/>'
 +fill+(overlays[kind]||"")+lines+arrow
 +'<rect x="19" y="222" width="362" height="33" rx="11" fill="#fff"/>'
 +'<text x="200" y="243" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="14" fill="#15516f">'+caption+'</text>'
 +SVG_END;
}
function badgeArt(left,right,sub){
 return SVG_START+'<rect width="400" height="264" rx="20" fill="#d9f1ff"/><rect x="25" y="40" width="164" height="150" rx="18" fill="#167ba9"/><rect x="211" y="40" width="164" height="150" rx="18" fill="#128c72"/><text x="107" y="131" text-anchor="middle" font-family="system-ui" font-size="45" font-weight="850" fill="white">'+left+'</text><text x="293" y="131" text-anchor="middle" font-family="system-ui" font-size="45" font-weight="850" fill="white">'+right+'</text><text x="200" y="229" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="750" fill="#165075">'+sub+'</text>'+SVG_END;
}
function diagramTitle(kind){
 const names={height:"AUFSCHLAGHÖHE",hangServe:"AUFSCHLAG",hangReturn:"RÜCKSCHLAG",doubleHit:"DOPPELSCHLAG",feet:"BEIDE FÜSSE",receiver:"EMPFÄNGER",move:"AUFSCHLAGBEWEGUNG"};
 return names[kind]||"";
}
function art(kind){
 if(["court","single","double","service","serve","even","odd","small","smallbox","smallnoback"].includes(kind))return court(kind);
 if(kind==="score21")return badgeArt("21","30","ZIEL: 21 · MAXIMAL: 30");
 if(kind==="deuce21")return badgeArt("20:20","29:29","+2 PUNKTE · MAXIMAL 30");
 if(kind==="score15")return badgeArt("15","21","ZIEL: 15 · MAXIMAL: 21");
 if(kind==="bestof")return badgeArt("2","3","ZWEI GEWINNSÄTZE");
 if(kind==="teams")return badgeArt("1 : 1","2 : 2","EINZEL  /  DOPPEL");
 if(kind==="months")return badgeArt("12","MON.","WERTUNGSFENSTER");
 if(kind==="weekday")return badgeArt("DO","↻","JEDE WOCHE");
 if(kind==="clock")return badgeArt("60 s","120 s","IM SATZ / ZWISCHEN SÄTZEN");
 if(kind==="ages")return SVG_START+'<rect width="400" height="264" fill="#d9f2ff"/>'
  +["U11","U13","U15","U17","U19"].map((v,i)=>'<rect x="'+(11+i*79)+'" y="79" width="73" height="95" rx="13" fill="'+(i%2?"#178e91":"#127da9")+'"/><text x="'+(47+i*79)+'" y="134" text-anchor="middle" font-family="system-ui" font-size="24" font-weight="800" fill="white">'+v+'</text>').join('')
  +'<text x="200" y="211" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="700" fill="#15516f">ALTERSKLASSEN</text>'+SVG_END;
 if(kind==="ranking")return SVG_START+'<rect width="400" height="264" fill="#dcf4ff"/>'
  +Array.from({length:7},(_,i)=>'<rect x="'+(13+i*55)+'" y="86" width="46" height="64" rx="10" fill="'+(i<5?"#138eb6":"#b2bec5")+'"/><text x="'+(36+i*55)+'" y="128" font-size="22" fill="white" font-weight="800" font-family="system-ui" text-anchor="middle">'+(i+1)+'</text>').join('')
  +'<text x="200" y="194" font-size="16" fill="#15516f" font-weight="800" font-family="system-ui" text-anchor="middle">DIE FÜNF BESTEN ZÄHLEN</text>'+SVG_END;
 if(kind==="levels"||kind==="levelsU11")return SVG_START+'<rect width="400" height="264" fill="#dff4ff"/>'
  +["A","B","C","D","E"].map((v,i)=>'<circle cx="'+(46+i*77)+'" cy="116" r="34" fill="'+(kind==="levelsU11"&&i===1?"#b2bec5":i<2?"#167eac":"#179787")+'"/><text x="'+(46+i*77)+'" y="129" font-size="34" font-weight="850" font-family="system-ui" text-anchor="middle" fill="white">'+(kind==="levelsU11"&&i===1?"×":v)+'</text><text x="'+(46+i*77)+'" y="176" font-size="14" font-weight="700" font-family="system-ui" text-anchor="middle" fill="#15516f">'+["DBV","Gruppe","Land","Bezirk","Region"][i]+'</text>').join('')
  +'<text x="200" y="225" font-size="13" font-weight="700" font-family="system-ui" text-anchor="middle" fill="#15516f">'+(kind==="levelsU11"?"U11: KEINE B-WERTUNG":"TURNIEREBENEN A–E")+'</text>'+SVG_END;
 if(kind==="smallSchedule")return SVG_START+'<rect width="400" height="264" fill="#dff3ff"/>'
  +[['1.','BOX'],['2.','OHNE HINTERFELD'],['3.','STANDARD']].map((p,i)=>'<rect x="15" y="'+(22+i*68)+'" width="370" height="58" rx="12" fill="'+(i%2?"#147ca9":"#16947f")+'"/><text x="43" y="'+(59+i*68)+'" font-family="system-ui" font-size="22" font-weight="800" fill="white">'+p[0]+'</text><text x="214" y="'+(58+i*68)+'" font-family="system-ui" font-size="17" font-weight="750" text-anchor="middle" fill="white">'+p[1]+'</text>').join('')
  +'<text x="200" y="245" font-family="system-ui" font-size="14" font-weight="750" text-anchor="middle" fill="#15516f">BWBV C-RLT 2026 · U13 4.: MIXED</text>'+SVG_END;
 if(kind==="rotate"||kind==="serveAgain")return SVG_START+'<rect width="400" height="264" fill="#dcf2ff"/>'
  +'<text x="107" y="44" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="800" fill="#17516e">VOR DEM PUNKT</text>'
  +'<text x="294" y="44" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="800" fill="#17516e">NACH DEM PUNKT</text>'
  +'<rect x="29" y="58" width="153" height="111" rx="11" fill="#149177"/>'
  +'<path d="M105 58V169" stroke="white" stroke-width="3"/>'
  +'<circle cx="146" cy="115" r="23" fill="#f9e263"/><text x="146" y="122" font-family="system-ui" text-anchor="middle" font-size="17" font-weight="800" fill="#15415c">A1</text>'
  +'<circle cx="67" cy="115" r="17" fill="#d3efff"/><text x="67" y="121" font-family="system-ui" text-anchor="middle" font-size="12" font-weight="800" fill="#15415c">A2</text>'
  +'<path d="M190 114h24m-10-10 10 10-10 10" stroke="#eb9d15" stroke-width="6" fill="none" stroke-linecap="round"/>'
  +'<rect x="218" y="58" width="153" height="111" rx="11" fill="#149177"/>'
  +'<path d="M294 58V169" stroke="white" stroke-width="3"/>'
  +'<circle cx="258" cy="115" r="23" fill="#f9e263"/><text x="258" y="122" font-family="system-ui" text-anchor="middle" font-size="17" font-weight="800" fill="#15415c">A1</text>'
  +'<circle cx="333" cy="115" r="17" fill="#d3efff"/><text x="333" y="121" font-family="system-ui" text-anchor="middle" font-size="12" font-weight="800" fill="#15415c">A2</text>'
  +'<text x="200" y="209" font-family="system-ui" text-anchor="middle" font-size="16" font-weight="800" fill="#15516f">A1 BLEIBT AUFSCHLÄGER</text>'
  +'<text x="200" y="233" font-family="system-ui" text-anchor="middle" font-size="13" font-weight="650" fill="#416781">TEAM PUNKTET BEI EIGENEM AUFSCHLAG</text>'+SVG_END;
 
 if(kind==="netHeight")return SVG_START+'<rect width="400" height="264" rx="20" fill="#ddf4ff"/>'
  +'<path d="M35 201V50 M365 201V50" stroke="#225b7d" stroke-width="9"/>'
  +'<path d="M35 53Q200 73 365 53V198H35Z" fill="#8dc9bd" stroke="#2d8395" stroke-width="3"/>'
  +Array.from({length:9},(_,i)=>'<path d="M'+(38+i*41)+' 65V198" stroke="#eafafb" stroke-width="1.8"/>').join('')
  +'<path d="M47 47V195 M40 53h14M40 193h14 M200 68V195 M193 73h14M193 193h14" stroke="#e0a431" stroke-width="5"/>'
  +'<rect x="48" y="216" width="126" height="37" rx="10" fill="#127faa"/>'
  +'<rect x="218" y="216" width="156" height="37" rx="10" fill="#198e81"/>'
  +'<text x="111" y="240" text-anchor="middle" font-size="17" font-weight="800" fill="white" font-family="system-ui">1,55 m</text>'
  +'<text x="296" y="240" text-anchor="middle" font-size="17" font-weight="800" fill="white" font-family="system-ui">1,524 m</text>'+SVG_END;
 if(kind==="netRoller")return SVG_START+'<rect width="400" height="264" rx="20" fill="#e1f4ff"/>'
  +'<path d="M198 45V205" stroke="#184e6b" stroke-width="7"/>'
  +'<path d="M161 91H238" stroke="#184e6b" stroke-width="10"/>'
  +'<path d="M169 101V201 M186 101V201 M207 101V201 M226 101V201" stroke="#55a1aa" stroke-width="2"/>'
  +'<path d="M55 167Q120 41 194 75Q236 40 330 154" stroke="#e9ae41" fill="none" stroke-width="7" stroke-dasharray="9 6"/>'
  +'<circle cx="200" cy="76" r="16" fill="white" stroke="#1c5e7e" stroke-width="4"/>'
  +'<rect x="87" y="210" width="227" height="42" rx="12" fill="#148e7e"/>'
  +'<text x="200" y="237" text-anchor="middle" font-size="19" font-weight="800" fill="white" font-family="system-ui">WEITERSPIELEN</text>'+SVG_END;
 if(kind==="netTouch")return SVG_START+'<rect width="400" height="264" rx="20" fill="#e0f4ff"/>'
  +'<path d="M200 43V195" stroke="#194e6c" stroke-width="7"/>'
  +'<path d="M169 86H230" stroke="#194e6c" stroke-width="9"/>'
  +'<path d="M177 94V193 M191 94V193 M210 94V193 M223 94V193" stroke="#8dbabd" stroke-width="2"/>'
  +'<path d="M80 185L178 96" stroke="#145e82" stroke-width="10"/>'
  +'<ellipse cx="174" cy="95" rx="32" ry="14" transform="rotate(-42 174 95)" fill="none" stroke="#145e82" stroke-width="6"/>'
  +'<path d="M263 103l54 55 M317 103l-54 55" stroke="#c4354c" stroke-width="9" stroke-linecap="round"/>'
  +'<rect x="111" y="209" width="177" height="41" rx="10" fill="#bb4650"/>'
  +'<text x="200" y="236" text-anchor="middle" font-size="19" font-weight="800" fill="white" font-family="system-ui">FEHLER</text>'+SVG_END;
 if(kind==="netFollow")return SVG_START+'<rect width="400" height="264" rx="20" fill="#e0f4ff"/>'
  +'<path d="M200 43V203" stroke="#174f6c" stroke-width="7"/>'
  +'<path d="M175 97H224" stroke="#174f6c" stroke-width="10"/>'
  +'<path d="M174 107V202 M188 107V202 M211 107V202 M224 107V202" stroke="#7fb4b9" stroke-width="2"/>'
  +'<path d="M74 192Q125 70 171 88Q211 48 296 99" stroke="#e9b040" stroke-width="7" fill="none" stroke-dasharray="9 6"/>'
  +'<circle cx="157" cy="97" r="14" fill="white" stroke="#235873" stroke-width="4"/>'
  +'<path d="M52 196L162 100" stroke="#185f80" stroke-width="7"/>'
  +'<rect x="94" y="211" width="212" height="39" rx="11" fill="#168d7b"/>'
  +'<text x="200" y="236" text-anchor="middle" font-size="17" font-weight="800" fill="white" font-family="system-ui">TREFFPUNKT EIGENE SEITE</text>'+SVG_END;
 
 if(["hangServe","hangReturn","net"].includes(kind)){
  const result=kind==="hangServe"?"FEHLER":kind==="hangReturn"?"WIEDERHOLUNG":"NETZ";
  const color=kind==="hangServe"?"#af3045":"#0b789e";
  return SVG_START+'<rect width="400" height="264" fill="#d8f2ff"/><path d="M52 78H348" stroke="#184e6b" stroke-width="8"/>'
   +Array.from({length:16},(_,i)=>'<path d="M'+(55+i*19)+' 84V169" stroke="#348498" stroke-width="1.8"/>').join('')
   +Array.from({length:5},(_,i)=>'<path d="M52 '+(94+i*17)+'H348" stroke="#348498" stroke-width="1.8"/>').join('')
   +(kind==="net"?"":'<circle cx="201" cy="82" r="15" fill="#fff" stroke="#184e6b" stroke-width="3"/>')
   +'<rect x="85" y="185" width="230" height="52" rx="14" fill="'+color+'"/><text x="200" y="217" text-anchor="middle" font-family="system-ui" font-size="23" font-weight="800" fill="white">'+result+'</text>'+SVG_END;
 }
 if(kind==="height")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dff4ff"/>'
  +'<rect x="14" y="36" width="178" height="183" rx="15" fill="#167ca9"/><rect x="208" y="36" width="178" height="183" rx="15" fill="#199780"/>'
  +'<text x="103" y="71" text-anchor="middle" font-family="system-ui" font-size="17" font-weight="800" fill="white">BWF</text>'
  +'<text x="103" y="129" text-anchor="middle" font-family="system-ui" font-size="35" font-weight="850" fill="white">1,15 m</text>'
  +'<text x="103" y="173" text-anchor="middle" font-family="system-ui" font-size="14" fill="white">BALL DARUNTER</text>'
  +'<text x="297" y="71" text-anchor="middle" font-family="system-ui" font-size="17" font-weight="800" fill="white">DBV NATIONAL</text>'
  +'<text x="297" y="125" text-anchor="middle" font-family="system-ui" font-size="29" font-weight="850" fill="white">TAILLE</text>'
  +'<text x="297" y="175" text-anchor="middle" font-family="system-ui" font-size="13" fill="white">SCHLÄGER ABWÄRTS</text>'
  +'<text x="200" y="243" text-anchor="middle" font-family="system-ui" font-size="14" fill="#15516f">DBV OHNE MESSGERÄT: TAILLE</text>'+SVG_END;
 if(kind==="choice")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dff4ff"/>'
 +'<rect x="17" y="54" width="174" height="141" rx="15" fill="#187fa9"/><rect x="209" y="54" width="174" height="141" rx="15" fill="#17947b"/>'
 +'<text x="104" y="118" text-anchor="middle" font-size="24" font-weight="800" fill="white" font-family="system-ui">AUFSCHLAG</text>'
 +'<text x="104" y="156" text-anchor="middle" font-size="20" font-weight="800" fill="white" font-family="system-ui">↔ RÜCKSCHLAG</text>'
 +'<text x="296" y="119" text-anchor="middle" font-size="26" font-weight="800" fill="white" font-family="system-ui">FELDSEITE</text>'
 +'<text x="296" y="154" text-anchor="middle" font-size="33" fill="white" font-family="system-ui">↔</text>'
 +'<text x="200" y="232" text-anchor="middle" font-size="13" font-weight="750" fill="#15516f" font-family="system-ui">DIE GEWINNERSEITE WÄHLT</text>'+SVG_END;
 if(kind==="racket")return SVG_START+'<rect width="400" height="264" rx="20" fill="#def3ff"/>'
 +'<ellipse cx="142" cy="104" rx="48" ry="74" fill="none" stroke="#176c95" stroke-width="8"/>'
 +Array.from({length:5},(_,i)=>'<path d="M'+(108+i*17)+' 53V155" stroke="#64b1c9" stroke-width="1.5"/>').join('')
 +Array.from({length:7},(_,i)=>'<path d="M103 '+(57+i*15)+'H181" stroke="#64b1c9" stroke-width="1.5"/>').join('')
 +'<path d="M142 179V217" stroke="#176c95" stroke-width="9"/>'
 +'<rect x="129" y="216" width="26" height="27" rx="4" fill="#20536d"/>'
 +'<path d="M214 34V240m-8-195 8-14 8 14m-16 180 8 14 8-14" stroke="#1b739d" stroke-width="3" fill="none"/>'
 +'<text x="228" y="133" font-size="19" font-weight="800" fill="#15516f" font-family="system-ui">68 cm</text>'
 +'<path d="M93 14H190m-83-7-15 7 15 7m69-14 15 7-15 7" stroke="#1b739d" stroke-width="3" fill="none"/>'
 +'<text x="240" y="230" text-anchor="middle" font-size="16" font-weight="800" fill="#15516f" font-family="system-ui">MAX. 23 cm BREIT</text>'+SVG_END;
 if(kind==="shuttle")return SVG_START+'<rect width="400" height="264" rx="20" fill="#def4ff"/>'
 +Array.from({length:16},(_,i)=>{const x=91+i*13;const y=30+Math.round((i-7.5)**2*.65);return '<path d="M188 182L'+x+' '+y+'" stroke="#f5f9fc" stroke-width="8" stroke-linecap="round"/>';}).join('')
 +'<path d="M133 183Q188 197 242 183L224 221H149Z" fill="#edf5f5" stroke="#155471" stroke-width="4"/>'
 +'<ellipse cx="188" cy="226" rx="40" ry="16" fill="#e5c596" stroke="#155471" stroke-width="3"/>'
 +'<rect x="275" y="70" width="98" height="72" rx="11" fill="#197fa9"/>'
 +'<text x="324" y="115" text-anchor="middle" font-size="36" font-weight="850" fill="white" font-family="system-ui">16</text>'
 +'<text x="320" y="162" text-anchor="middle" font-size="13" font-weight="800" fill="#15516f" font-family="system-ui">FEDERN</text>'
 +'<text x="199" y="254" text-anchor="middle" font-size="14" font-weight="800" fill="#15516f" font-family="system-ui">4,74–5,50 g</text>'+SVG_END;
 if(kind==="spin")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dff4ff"/>'
  +'<path d="M119 118q-24-39 20-48t34 37" fill="none" stroke="#1683ad" stroke-width="9" stroke-linecap="round"/>'
  +'<path d="m167 89 6 18-18-4" fill="none" stroke="#1683ad" stroke-width="6"/>'
  +'<path d="M92 65L216 186 M216 65L92 186" stroke="#bd3448" stroke-width="10" stroke-linecap="round"/>'
  +'<circle cx="299" cy="121" r="29" fill="#ecfaff" stroke="#16536f" stroke-width="5"/>'
  +'<path d="M299 150V202" stroke="#1e7389" stroke-width="7"/>'
  +'<text x="200" y="237" text-anchor="middle" font-family="system-ui" font-size="17" font-weight="800" fill="#15516f">KEIN SPIN · BASIS ZUERST</text>'+SVG_END;
 if(kind==="missServe")return SVG_START+'<rect width="400" height="264" rx="20" fill="#def4ff"/>'
  +'<path d="M80 204L195 106" stroke="#145c7b" stroke-width="11" stroke-linecap="round"/><ellipse cx="210" cy="94" rx="60" ry="28" transform="rotate(-34 210 94)" fill="none" stroke="#167dad" stroke-width="8"/>'
  +'<circle cx="304" cy="72" r="18" fill="white" stroke="#1c5b75" stroke-width="4"/>'
  +'<path d="M266 140l64 64 M330 140l-64 64" stroke="#c23244" stroke-width="9" stroke-linecap="round"/>'
  +'<text x="200" y="241" text-anchor="middle" font-family="system-ui" font-size="17" font-weight="800" fill="#15516f">BALL VERFEHLT = FEHLER</text>'+SVG_END;
 if(kind==="coach")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dff3ff"/>'
  +'<rect x="26" y="36" width="348" height="166" rx="15" fill="#158873"/>'
  +'<path d="M200 36V202" stroke="white" stroke-width="6"/>'
  +'<circle cx="105" cy="119" r="24" fill="#fff5ba"/><circle cx="295" cy="119" r="24" fill="#fff5ba"/>'
  +'<path d="M144 108Q200 72 257 107" stroke="#f6df56" stroke-width="5" stroke-dasharray="7 7" fill="none"/>'
  +'<rect x="91" y="205" width="216" height="43" rx="12" fill="#1678ad"/>'
  +'<text x="200" y="232" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="800" fill="white">ZWISCHEN BALLWECHSELN</text>'+SVG_END;
 if(kind==="ceiling")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dff3ff"/>'
  +'<path d="M25 51H375" stroke="#1c536b" stroke-width="11"/>'
  +'<path d="M114 177Q95 97 114 54" fill="none" stroke="#edbd4c" stroke-width="7" stroke-dasharray="10 7"/>'
  +'<circle cx="114" cy="62" r="12" fill="white" stroke="#194d68" stroke-width="4"/>'
  +'<rect x="18" y="190" width="176" height="60" rx="12" fill="#178db4"/>'
  +'<rect x="206" y="190" width="176" height="60" rx="12" fill="#bd4554"/>'
  +'<text x="106" y="215" text-anchor="middle" fill="white" font-family="system-ui" font-size="13" font-weight="800">AUFSCHLAG 5–9 m</text>'
  +'<text x="106" y="239" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="800">WIEDERHOLEN</text>'
  +'<text x="294" y="215" text-anchor="middle" fill="white" font-family="system-ui" font-size="13" font-weight="800">BALLWECHSEL</text>'
  +'<text x="294" y="239" text-anchor="middle" fill="white" font-family="system-ui" font-size="18" font-weight="800">FEHLER</text>'+SVG_END;
 if(kind==="wrongPosition")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dff2ff"/>'
  +'<rect x="45" y="52" width="310" height="159" rx="6" fill="#16967e"/>'
  +'<path d="M200 52V211 M45 132H355" stroke="white" stroke-width="5"/>'
  +'<circle cx="274" cy="88" r="24" fill="#f8e799"/><circle cx="275" cy="175" r="24" fill="#e0eef7"/>'
  +'<text x="275" y="96" text-anchor="middle" fill="#15536d" font-family="system-ui" font-size="23" font-weight="850">×</text>'
  +'<text x="275" y="183" text-anchor="middle" fill="#15536d" font-family="system-ui" font-size="23" font-weight="850">✓</text>'
  +'<path d="M313 100V163m-10-12 10 13 10-13" stroke="#ffdc4a" stroke-width="6" fill="none"/>'
  +'<text x="200" y="239" text-anchor="middle" fill="#15536d" font-family="system-ui" font-size="14" font-weight="800">STELLUNG KORRIGIEREN</text>'+SVG_END;
 if(kind==="rallyEnd")return SVG_START+'<rect width="400" height="264" rx="20" fill="#dcf3ff"/>'
  +'<path d="M42 199H358" stroke="#f8fffe" stroke-width="8"/>'
  +'<rect x="27" y="204" width="347" height="35" rx="5" fill="#149676"/>'
  +'<path d="M95 58Q200 22 253 171" stroke="#1b85b2" stroke-dasharray="9 8" stroke-width="6" fill="none"/>'
  +'<circle cx="256" cy="185" r="14" stroke="#1e556b" stroke-width="4" fill="#fff"/>'
  +'<path d="M287 85l45 45 M332 85l-45 45" stroke="#bb354c" stroke-width="10" stroke-linecap="round"/>'
  +'<text x="200" y="255" text-anchor="middle" fill="#15536d" font-family="system-ui" font-size="13" font-weight="800">BALL BODEN = ENDE</text>'+SVG_END;
 if(kind==="feet")return SVG_START+'<rect width="400" height="264" fill="#def4ff"/>'
  +'<path d="M42 196H358" stroke="#1b6272" stroke-width="8"/>'
  +'<path d="M101 74V175Q103 193 130 192h51V169h-27l-8-95" fill="#208cad" stroke="#15516f" stroke-width="4"/>'
  +'<path d="M225 74V175Q227 193 254 192h51V169h-27l-8-95" fill="#208cad" stroke="#15516f" stroke-width="4"/>'
  +'<text x="200" y="239" font-family="system-ui" font-weight="800" font-size="17" fill="#15516f" text-anchor="middle">BODENKONTAKT</text>'+SVG_END;
 if(kind==="doubleHit")return badgeArt("1","2","ZWEI SCHLÄGE = FEHLER");
 if(kind==="receiver")return badgeArt("NICHT","BEREIT","KEIN RÜCKSCHLAG: WIEDERHOLEN");
 if(kind==="move")return SVG_START+'<rect width="400" height="264" fill="#e1f3ff"/>'
  +'<path d="M80 174Q200 36 319 145" stroke="#1986b2" stroke-width="13" fill="none" stroke-linecap="round"/>'
  +'<path d="M292 143 28 2-17 20" stroke="#1986b2" stroke-width="9" fill="none" stroke-linecap="round"/>'
  +'<text x="200" y="234" font-family="system-ui" font-size="17" font-weight="800" text-anchor="middle" fill="#15516f">BEWEGUNG NACH VORN</text>'+SVG_END;
 if(kind==="podium")return SVG_START+'<rect width="400" height="264" fill="#dff4ff"/>'
  +'<rect x="78" y="142" width="78" height="66" fill="#55a8c9"/><rect x="162" y="99" width="78" height="109" fill="#f3bf4a"/><rect x="246" y="161" width="78" height="47" fill="#61af9d"/>'
  +["2","1","3"].map((v,i)=>'<text x="'+(117+i*84)+'" y="'+([181,158,194][i])+'" font-size="31" text-anchor="middle" font-family="system-ui" font-weight="850" fill="#16466b">'+v+'</text>').join('')
  +'<text x="200" y="238" font-size="16" font-weight="800" font-family="system-ui" text-anchor="middle" fill="#16516f">PLATZIERUNG</text>'+SVG_END;
 if(kind==="line")return SVG_START+'<rect width="400" height="264" fill="#d9f2ff"/><rect x="49" y="37" width="304" height="183" rx="8" fill="#0b956a"/><path d="M235 39V219" stroke="white" stroke-width="12"/><circle cx="239" cy="114" r="18" fill="#f5f9f9" stroke="#365a71" stroke-width="4"/><path d="m200 158 24 26 49-54" fill="none" stroke="#ffda3c" stroke-width="10" stroke-linecap="round"/>'+SVG_END;
 const symbol=kind==="let"?"↻":kind==="fault"?"×":kind==="decision"?"?":kind==="ceiling"?"↑":kind==="switch"?"⇄":"✓";
 const subtitle=kind==="let"?"WIEDERHOLUNG":kind==="fault"?"FEHLER":kind==="ceiling"?"DECKENBERÜHRUNG":kind==="switch"?"SEITENWECHSEL":"ENTSCHEIDUNG";
 return SVG_START+'<rect width="400" height="264" fill="#d6f1ff"/><circle cx="200" cy="119" r="78" fill="#197eaa"/><text x="200" y="160" font-family="system-ui" font-size="113" font-weight="850" fill="white" text-anchor="middle">'+symbol+'</text>'
 +'<text x="200" y="239" font-family="system-ui" font-weight="800" font-size="16" text-anchor="middle" fill="#15516f">'+subtitle+'</text>'+SVG_END;
}
const normalize=(s)=>String(s||"").toLowerCase().replace(/ß/g,"ss").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
const search=document.getElementById("wiki-search");
const output=document.getElementById("wiki-results");
const empty=document.getElementById("wiki-empty");
const count=document.getElementById("wiki-count");
const heading=document.getElementById("results-title");
const dialog=document.getElementById("wiki-detail");
let topic="alle";
// Once-built client-side index: no searches, names, or history leave the device.
const INDEX=CARDS.map(c=>{
 const flat=normalize([c.title,c.answer,c.terms,c.scope].join(" "));
 return {c,flat,title:normalize(c.title),tokens:[...new Set(flat.match(/[a-z0-9]+/g)||[])]};
});
function editDistanceWithin(a,b,max){
 if(Math.abs(a.length-b.length)>max)return false;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];
  for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
  if(Math.min(...next)>max)return false;
  prev=next;
 }
 return prev[b.length]<=max;
}
function findItems(){
 const words=normalize(search.value).trim().split(/\s+/).filter(Boolean);
 let items=INDEX.filter(x=>topic==="alle"||x.c.topic===topic);
 if(words.length){
  items=items.map(x=>{
   let score=0;let matched=true;
   for(const w of words){
    const titleHit=x.title.includes(w), exact=x.flat.includes(w);
    const fuzzy=!exact&&w.length>=4&&x.tokens.some(t=>t[0]===w[0]&&editDistanceWithin(w,t,w.length>=8?2:1));
    if(!(exact||fuzzy)){matched=false;break;}
    score+=titleHit?8:exact?4:1;
   }
   return {c:x.c,score,matched};
  }).filter(x=>x.matched).sort((a,b)=>b.score-a.score).map(x=>x.c);
 }else items=items.map(x=>x.c);
 return items;
}
function openCard(c){
 dialog.dataset.cardId=c.id;
 document.getElementById("detail-category").textContent=TOPICS[c.topic];
 document.getElementById("detail-title").textContent=c.title;
 document.getElementById("detail-art").innerHTML=art(c.kind);
 document.getElementById("detail-art").dataset.kind=c.kind;
 document.getElementById("detail-art").setAttribute("aria-label","Grafik zur Regel: "+c.title);
 document.getElementById("detail-answer").textContent=c.answer;
 document.getElementById("detail-scope").textContent=c.scope;
 document.getElementById("detail-source").href=c.source;
 const visible=findItems(),position=visible.findIndex(item=>item.id===c.id);
 document.getElementById("wiki-card-position").textContent=(position+1)+" von "+visible.length;
 document.getElementById("wiki-previous").disabled=position<=0;
 document.getElementById("wiki-next").disabled=position<0||position>=visible.length-1;
 if(!dialog.open)dialog.showModal();
}
function adjacent(step){
 const visible=findItems();
 const position=visible.findIndex(item=>item.id===dialog.dataset.cardId);
 if(position<0||position+step<0||position+step>=visible.length)return;
 openCard(visible[position+step]);
}
function render(){
 const items=findItems(),term=search.value.trim();
 heading.textContent=term?"Suchergebnisse":topic==="alle"?"Alle Regeln":TOPICS[topic];
 count.textContent=items.length+" Karten";
 output.replaceChildren();
 empty.hidden=items.length!==0;
 let lastGroup="";
 for(const c of items){
  if(topic==="alle"&&!term&&lastGroup!==c.topic){
   const label=document.createElement("h3");label.className="wiki-group-title";
   const size=CARDS.filter(card=>card.topic===c.topic).length;
   label.textContent=TOPICS[c.topic]+" · "+size+" Karten";
   output.append(label);lastGroup=c.topic;
  }
  const b=document.createElement("button");b.type="button";b.className="wiki-entry";
  const image=document.createElement("span");image.className="mini-art";image.innerHTML=art(c.kind);
  const copy=document.createElement("span");copy.className="entry-copy";
  const cat=document.createElement("small");cat.textContent=TOPICS[c.topic];
  const title=document.createElement("strong");title.textContent=c.title;
  copy.append(cat,title);
  const arrow=document.createElement("span");arrow.className="entry-arrow";arrow.setAttribute("aria-hidden","true");arrow.textContent="›";
  b.append(image,copy,arrow);b.addEventListener("click",()=>openCard(c));output.append(b);
 }
}
search.addEventListener("input",render);
for(const button of document.querySelectorAll("[data-topic]")){
 button.addEventListener("click",()=>{
  topic=button.dataset.topic;
  for(const b of document.querySelectorAll("[data-topic]")){
   const on=b===button;b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on));
  }
  render();
 });
}
document.getElementById("wiki-previous").addEventListener("click",()=>adjacent(-1));
document.getElementById("wiki-next").addEventListener("click",()=>adjacent(1));
document.getElementById("detail-close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
render();
