"use strict";
// Schmetterlinge – compact editorial wiki. Search runs in the browser; no account or analytics.
// All cards require subject-matter and graphical release review before merging this draft PR.
const DBV="https://www.badminton.de/der-dbv/satzung-ordnungen-und-spielregeln/";
const FAQ="https://www.badminton.de/der-dbv/jugend-wettkampf/faq/";
const RANK="https://www.badminton.de/der-dbv/jugend-wettkampf/allgemeine-ranglisten-bestimmungen/";
const BWBV="https://bwbv.de/2025/12/25/small-games-bei-bwbv-jugendturnieren-in-2026/";
const BWBV_J="https://bwbv.de/wp-content/uploads/2025/12/80-Jugendordnung.pdf";
const FIFTEEN="https://www.badminton.de/news/badminton/neue-zaehlweise-dbv-praesidium-beschliesst-einfuehrung-von-3-x-15/";
// [topic, question, answer, search terms, validity/scope, source, illustration]
const DATA=[
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
["grundlagen","Wie hoch ist das Netz?","An den Pfosten 1,55 m, in der Mitte 1,524 m.","netzhöhe netz mitte 1.55 1.524","Spielregeln 1",DBV,"net"],
["grundlagen","Darf ein Ball die Linie berühren?","Ja. Berührt der Ball die gültige Linie, ist er im Feld.","aus in auf linie federn boden","Spielregeln 13",DBV,"line"],
["grundlagen","Wie lange sind die Pausen?","Bis 60 Sekunden im Satz beim Pausenpunkt und bis 120 Sekunden zwischen zwei Sätzen.","pause 60 120 sekunden unterbrechung","Spielregeln 16; Pausenpunkt abhängig von Zählweise",DBV,"clock"],
["grundlagen","Welche Spielarten gibt es?","Einzel: 1 gegen 1. Doppel und Mixed: 2 gegen 2, beim Mixed jeweils Frau und Mann pro Paar.","disziplin spielart einzel doppel mixed","Spielregeln 10–11",DBV,"teams"],
["spielsituationen","Müssen beide Füße beim Aufschlag stehen?","Ja. Beide Füße müssen teilweise den Boden berühren und bis zum Treffpunkt stillstehen.","fuß aufschlagfehler standlinie treten abheben","Spielregel 9.1",DBV,"feet"],
["spielsituationen","Wie hoch darf der Aufschlag sein?","International: der gesamte Ball unter 1,15 m. National gilt häufig die alternative Taille-Regel.","aufschlaghöhe taillenhöhe 115 1,15 servicehöhe aufschlag zu hoch","Spielregel 9 / nationale Alternative",DBV,"height"],
["spielsituationen","Darf die Aufschlagbewegung stoppen?","Nein. Nach Beginn muss der Schläger bis zum Treffer weiter nach vorn gehen.","bewegung halt stoppen ausholen","Spielregel 9.1",DBV,"move"],
["spielsituationen","Was, wenn der Rückschläger nicht bereit ist?","War der Empfänger nicht bereit und versuchte keinen Rückschlag, wird wiederholt.","empfänger bereit wiederholung","Spielregel 14",DBV,"receiver"],
["spielsituationen","Wer nimmt den Aufschlag im Doppel?","Nur der diagonal gegenüberstehende richtige Rückschläger darf den Aufschlag annehmen.","doppel annahme falscher partner diagonal","Spielregel 11",DBV,"serve"],
["spielsituationen","Wer schlägt im Doppel nach eigenem Punkt auf?","Dieselbe Person schlägt von der anderen Seite erneut auf.","doppel aufschlagfolge rotation vier spieler","Spielregel 11",DBV,"serveAgain"],
["spielsituationen","Wann wechseln Doppelpartner ihre Seiten?","Nur wenn sie bei eigenem Aufschlag punkten. Bei Rückschlaggewinn wechseln sie nicht sofort die Positionen.","doppel stellung partner wechseln rotation","Spielregel 11",DBV,"rotate"],
["spielsituationen","Darf der Ball das Netz berühren?","Ja. Fliegt er trotz Netzberührung ins gültige gegnerische Feld, läuft der Ballwechsel weiter.","netzroller netzkante über netz","Spielregel 13",DBV,"net"],
["spielsituationen","Ist die Netzberührung ein Fehler?","Ja, wenn Spieler oder Schläger während des Ballwechsels das Netz berühren.","netz netzberuehrung schläger berühren","Spielregel 13",DBV,"fault"],
["spielsituationen","Darf der Schläger übers Netz ragen?","Treffe den Ball auf deiner Seite. Danach darf der Schläger über das Netz schwingen.","über netz nachschwingen netzüberschreitung","Spielregel 13",DBV,"net"],
["spielsituationen","Aufschlag bleibt im Netz hängen?","Fehler. Der Gegner gewinnt den Ballwechsel.","ball hängt netz aufschlag","Spielregel 13",DBV,"hangServe"],
["spielsituationen","Rückschlag bleibt im Netz hängen?","Hat der Ball das Netz überquert und bleibt daran hängen, wird wiederholt.","ball hängt netz rückschlag let","Spielregel 14",DBV,"hangReturn"],
["spielsituationen","Darf man den Ball zweimal schlagen?","Nein. Zwei Schläge derselben Person nacheinander sind ein Fehler.","doppelschlag zweimal","Spielregel 13",DBV,"doubleHit"],
["spielsituationen","Was passiert bei falscher Aufschlagposition?","Die Stellung wird nach Entdeckung korrigiert. Der bisherige Spielstand bleibt bestehen.","stellung falscher empfänger fehler korrigieren","Spielregel 12",DBV,"rotate"],
["spielsituationen","Was ist ein Let?","Ein Let ist eine Wiederholung. Der Punktestand bleibt unverändert, und der letzte Aufschläger serviert erneut.","let wiederholung unterbrechung","Spielregel 14",DBV,"let"],
["spielsituationen","Was gilt bei einem Deckenball?","Eine Deckenberührung ist grundsätzlich ein Fehler. Für niedrige Hallen kann es besondere nationale Regelungen geben.","decke hallendecke niedrige halle","DBV-Spielregeln und nationale Anlagen",DBV,"ceiling"],
["spielsituationen","Darf man während des Spiels beraten?","Coaching ist nur zu den im Wettbewerb erlaubten Zeitpunkten zulässig.","coaching trainer pause betreuer beraten","Spielregel 16; Turnierbestimmungen beachten",DBV,"clock"],
["spielsituationen","Was tun ohne Schiedsrichter?","Unklare Entscheidungen nach den Turnierregeln klären. Bei Streitfällen die Turnierleitung hinzuziehen.","schiedsrichter umpire selbstentscheid streit","Wettbewerbsregel und Turnierleitung maßgeblich",DBV,"decision"],
["spielsituationen","Wann ist der Ballwechsel vorbei?","Bei Bodenberührung, Fehler oder Wiederholung sowie wenn der Ball nicht mehr im Spiel ist.","tot spielende punkt ball","Spielregel 15",DBV,"decision"],
["jugend","Welche Jugendaltersklassen gibt es?","U11, U13, U15, U17 und U19 sind die üblichen Jugendklassen. Die Turnierausschreibung nennt den gültigen Jahrgang.","alter altersklassen jugend geburtsjahr jahrgang","Jugend – Altersstichtag je Saison prüfen",BWBV_J,"ages"],
["jugend","Was bedeuten A- bis E-Turniere?","A = DBV, B = Gruppe, C = Landesverband, D = Bezirk, E = Region/Kreis. Einzelne Altersklassen haben Ausnahmen.","a rlt b rlt c rlt d rlt e rlt turnierklassen level","DBV-Jugendwettkampfsystem",FAQ,"levels"],
["jugend","Gibt es B-Turniere für U11?","In der regulären DBV-Jugendrangliste ist U11 den Kategorien A sowie C–E zugeordnet, nicht B.","u11 b rlt altersklasse möglich","DBV-Jugendrangliste – aktuelle Ausschreibung zählt",FAQ,"levels"],
["jugend","Wie viele Turniere zählen für die Jugendrangliste?","Die fünf besten Ergebnisse aus den letzten zwölf Monaten zählen.","rangliste beste fünf 5 turniere","DBV-Jugendrangliste",FAQ,"ranking"],
["jugend","Wann verfallen Jugendranglistenpunkte?","Eine Turnierwertung bleibt zwölf Monate gültig.","punkte ablauf 12 monate verfallen","DBV-Jugendrangliste",FAQ,"months"],
["jugend","Wann wird die Jugendrangliste aktualisiert?","Die Jugendrangliste wird jeden Donnerstag aktualisiert.","ranking update wöchentlich donnerstag","DBV-Jugendrangliste",FAQ,"weekday"],
["jugend","Wie entstehen Ranglistenpunkte?","Turnierkategorie, Altersklasse und Platzierung bestimmen die Wertung. Die offizielle Punktetabelle ist maßgeblich.","punkteplatzierung punktetabelle punkte a b c d e","DBV-Jugendrangliste",RANK,"podium"],
["jugend","Was sind Small Games?","U11 und U13 spielen teilweise auf kleineren Feldern. Die Ausschreibung nennt die Spielform.","kleinfeld small games verkleinert u11 u13 box","BWBV-Jugendturniere 2026",BWBV,"small"],
["jugend","Was bedeutet Einzel „Box“?","Nur das mittlere Einzelfeld zählt. Vorder- und Hinterfeld sind aus.","box small games einzel vorne hinten","BWBV-Spielform 1 · 2026",BWBV,"smallbox"],
["jugend","Was bedeutet „ohne Hinterfeld“?","Der hintere Feldstreifen gehört nicht zum gültigen Spielfeld. Das verändert die Länge der Ballwechsel.","small games feld ohne hinten u13","BWBV-Spielform 8 · 2026",BWBV,"smallnoback"],
["jugend","Welche Small Games gelten beim C-RLT?","BWBV 2026: 1. C-RLT Box, 2. ohne Hinterfeld, 3. Standardfeld. U13: 4. C-RLT Mixed statt Einzel.","c rangliste small games c rlt bwbv 2026","BWBV-Jugendordnung 2026, Anhang 3",BWBV_J,"smallSchedule"],
["jugend","Darf man in einer höheren Altersklasse spielen?","Entscheidend sind Altersklassenregel und Turnierausschreibung.","hochmelden u13 u15 u17 höhere altersklasse","DBV/BWBV – konkrete Ausschreibung prüfen",BWBV_J,"ages"],
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
 +'<text x="200" y="243" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="12.5" fill="#15516f">'+caption+'</text>'
 +SVG_END;
}
function badgeArt(left,right,sub){
 return SVG_START+'<rect width="400" height="264" rx="20" fill="#d9f1ff"/><rect x="25" y="40" width="164" height="150" rx="18" fill="#167ba9"/><rect x="211" y="40" width="164" height="150" rx="18" fill="#128c72"/><text x="107" y="131" text-anchor="middle" font-family="system-ui" font-size="45" font-weight="850" fill="white">'+left+'</text><text x="293" y="131" text-anchor="middle" font-family="system-ui" font-size="45" font-weight="850" fill="white">'+right+'</text><text x="200" y="229" text-anchor="middle" font-family="system-ui" font-size="15" font-weight="750" fill="#165075">'+sub+'</text>'+SVG_END;
}
function art(kind){
 if(["court","single","double","service","serve","even","odd","small","smallbox","smallnoback"].includes(kind))return court(kind);
 if(kind==="score21"||kind==="deuce21")return badgeArt(kind==="deuce21"?"20:20":"21",kind==="deuce21"?"29:29":"30","ZWEI PUNKTE VORSPRUNG");
 if(kind==="score15")return badgeArt("15","21","3 × 15 · MAX. 21");
 if(kind==="bestof")return badgeArt("2","3","ZWEI GEWINNSÄTZE");
 if(kind==="teams")return badgeArt("1 : 1","2 : 2","EINZEL  /  DOPPEL");
 if(kind==="ages")return badgeArt("U11","U19","U13 · U15 · U17");
 if(kind==="ranking")return SVG_START+'<rect width="400" height="264" fill="#d7f2ff"/>'+Array.from({length:7},(_,i)=>'<rect x="'+(34+i*49)+'" y="'+(200-[107,134,80,160,115,56,38][i])+'" width="35" height="'+[107,134,80,160,115,56,38][i]+'" rx="6" fill="'+(i<5?"#1a89b9":"#94afbd")+'"/>').join("")+'<text x="200" y="239" font-size="16" fill="#155477" font-weight="800" text-anchor="middle" font-family="system-ui">DIE BESTEN 5</text>'+SVG_END;
 if(kind==="levels")return SVG_START+'<rect width="400" height="264" fill="#e1f5ff"/>'+["A","B","C","D","E"].map((v,i)=>'<circle cx="'+(48+i*76)+'" cy="'+(130+((i%2)?9:-9))+'" r="32" fill="'+(i<2?"#207fac":"#209c86")+'"/><text x="'+(48+i*76)+'" y="'+(142+((i%2)?9:-9))+'" font-size="33" font-weight="850" font-family="system-ui" text-anchor="middle" fill="white">'+v+'</text>').join("")+SVG_END;
 if(kind==="rotate")return SVG_START+'<rect width="400" height="264" fill="#dff2fc"/>'+["A1","A2","B1","B2"].map((v,i)=>'<circle cx="'+(110+(i%2)*180)+'" cy="'+(68+Math.floor(i/2)*132)+'" r="41" fill="'+(i<2?"#1888b2":"#189a82")+'"/><text x="'+(110+(i%2)*180)+'" y="'+(82+Math.floor(i/2)*132)+'" font-family="system-ui" font-size="31" font-weight="850" fill="white" text-anchor="middle">'+v+'</text>').join("")+'<path d="M152 68H246 M290 109V159 M248 200H152 M110 159V109" fill="none" stroke="#fbbf2c" stroke-width="6" stroke-dasharray="8 6"/>'+SVG_END;
 if(kind==="net")return SVG_START+'<rect width="400" height="264" fill="#d7f0ff"/><path d="M48 194V74 M352 194V74" stroke="#174763" stroke-width="9"/><path d="M48 82 Q200 106 352 82V177H48Z" fill="#78c0bc" stroke="#216575" stroke-width="4"/>'+Array.from({length:13},(_,i)=>'<path d="M'+(48+i*25)+' 88V177" stroke="#e8fbff" stroke-width="1"/>').join("")+'<text x="200" y="228" font-family="system-ui" font-size="19" font-weight="800" text-anchor="middle" fill="#175275">NETZ</text>'+SVG_END;
 if(kind==="clock"||kind==="calendar")return badgeArt(kind==="clock"?"60 s":"12",kind==="clock"?"120 s":"Do","PAUSE / WERTUNG");
 if(kind==="line")return SVG_START+'<rect width="400" height="264" fill="#d9f2ff"/><rect x="49" y="37" width="304" height="183" rx="8" fill="#0b956a"/><path d="M235 39V219" stroke="white" stroke-width="12"/><circle cx="239" cy="114" r="18" fill="#f5f9f9" stroke="#365a71" stroke-width="4"/><path d="m200 158 24 26 49-54" fill="none" stroke="#ffda3c" stroke-width="10" stroke-linecap="round"/>'+SVG_END;
 const symbol=kind==="let"?"↻":kind==="fault"?"×":kind==="decision"?"?":kind==="ceiling"?"↑":kind==="switch"?"⇄":kind==="feet"?"✓":kind==="podium"?"★":"🏸";
 return SVG_START+'<rect width="400" height="264" fill="#d6f1ff"/><circle cx="200" cy="129" r="90" fill="#167da9"/><circle cx="200" cy="129" r="70" fill="#229e9b"/><text x="200" y="169" font-family="system-ui" font-size="112" font-weight="850" fill="white" text-anchor="middle">'+symbol+'</text>'+SVG_END;
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
 }else if(topic==="alle"){
  const pinned=[0,4,5,9,20,22,34,36,39,40,42,46];
  items=pinned.map(i=>CARDS[i]).filter(Boolean);
 }else items=items.map(x=>x.c);
 return items;
}
function openCard(c){
 document.getElementById("detail-category").textContent=TOPICS[c.topic];
 document.getElementById("detail-title").textContent=c.title;
 document.getElementById("detail-art").innerHTML=art(c.kind);
 document.getElementById("detail-art").setAttribute("aria-label","Grafik zur Regel: "+c.title);
 document.getElementById("detail-answer").textContent=c.answer;
 document.getElementById("detail-scope").textContent=c.scope;
 document.getElementById("detail-source").href=c.source;
 dialog.showModal();
}
function render(){
 const items=findItems(),term=search.value.trim();
 heading.textContent=term?"Suchergebnisse":topic==="alle"?"Beliebte Regeln":TOPICS[topic];
 count.textContent=items.length+" Karten";
 output.replaceChildren();
 empty.hidden=items.length!==0;
 for(const c of items){
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
document.getElementById("detail-close").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
render();
