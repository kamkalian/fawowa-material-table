# Plan: Material-Datenbank Webtool

Stand: 11.11.2026 · Repo: https://github.com/kamkalian/fawowa-material-table

Dieses Dokument ist die Übergabe an Claude Code. Alle Entscheidungen sind getroffen, Phase 1 kann starten. Die Startdaten liegen in `startdaten.csv` neben dieser Datei.

## Ziel und Umfang

Das Webtool ist eine öffentliche Material-Datenbank für den Fahrradwohnwagen-Bau: Besucher finden und vergleichen Baustoffe in einer filterbaren Tabelle, Andreas pflegt die Daten in einem Admin-Bereich.

Dazu gehört:

- Materialien mit frei definierbaren Eigenschaften (Stärke, Flächengewicht, Wärmewert und beliebige weitere)
- Eine Übersichtstabelle mit Sortierung, Suche und Filtern, die man hinzufügt und wieder entfernt
- Filter in der URL, damit ein Link genau die gefilterte Ansicht öffnet
- Fehlermeldungen zu bestehenden Einträgen und Vorschläge für neue Materialien, beides ohne Benutzerkonto
- Ein Admin-Bereich für Materialien, Eigenschaften und eingegangene Meldungen
- Oberfläche in Deutsch und Englisch mit Umschalter

Nicht dazu gehört: Import und Export, Preise. Die Startdaten werden einmalig per Skript eingespielt, nicht über eine Funktion im Tool.

## Entscheidungen

- Neubau im selben Repo
- Eine Zeile pro Material und Stärke
- Ein Admin-Konto, nur für Andreas
- Link-Prüfung, Ko-fi-Fußzeile und dunkles Design werden aus dem alten Tool übernommen
- Einheiten sind pro Eintrag änderbar, auch beim Wärmewert
- Stück- und Meterware bekommt eine eigene Kategorie
- Hosting bleibt auf dem eigenen Server mit Docker und Caddy
- Deutsch und Englisch mit Umschalter
- Keine Preise
- Startdaten sind nur die Forenlisten, die alte `materials.json` wird ignoriert
- Neue Meldungen zeigt ein Zähler im Admin-Bereich, keine E-Mail

## Ausgangslage

Stand des bestehenden Repos (24 Commits, Version 0.2.0):

| Bereich | Stand heute |
| --- | --- |
| Stack | Express-Server, Frontend in reinem JavaScript mit Vite, Docker und Caddy |
| Speicher | JSON-Dateien im Ordner `data/` (Materialien, Meldungen) |
| Eigenschaften | Pro Material ein freies Objekt aus Name, Wert und Einheit; keine zentrale Liste der Eigenschaften |
| Tabelle | Filter nach Eigenschaften, Seitenblättern, helles und dunkles Design |
| Meldungen | Formular für neue Materialien; Fehlermeldungen zu bestehenden Einträgen fehlen |
| Admin | Eigene Seite, Zugang über einen Schlüssel in `data/editor-key.txt` |
| Extras | Link-Prüfung mit Status-Punkten, Fußzeile „Projekt unterstützen“ mit Ko-fi |
| Altlasten | Reste der früheren Next.js-Version in `src/app`, `src/components`, `src/types` |

Sicherheit: `data/editor-key.txt` liegt im öffentlichen Repo. Der Schlüssel muss geändert und die Datei aus dem Repo entfernt werden.

## Startdaten

Quelle ist der Forenthread https://fahrradwagen.com/d/536-gewichte-der-verschiedenen-baustoffe/27. Die beiden Listen aus den ersten Beiträgen ergeben zusammen 61 Einträge, bereinigt in `startdaten.csv`. Einen Wärmewert haben nur 6 Einträge.

Spalten der CSV: `name`, `staerke_mm`, `gewicht_kg_m2`, `waermewert`, `waermewert_einheit`, `kategorie`, `vermerk`, `notiz`. Dezimaltrenner ist der Punkt.

Alle Gewichte wurden über die Rohdichte gegengerechnet. 57 der 61 Einträge sind plausibel. Mit den Auffälligkeiten wurde so verfahren:

| Eintrag | Befund | Entscheidung |
| --- | --- | --- |
| GFK-Platte | 0,2 mm mit 0,40 kg/m² passt zur Dichte von GFK. 10 mm mit 0,30 kg/m² ist unmöglich | 0,2 mm übernommen, die 10-mm-Zeile verworfen |
| Polsterstoff gesteppt | Stärke nur in Liste 2 | 4 mm übernommen |
| Stadurlon | 16 mm ist schwerer als 20 mm, Herstellerdaten nicht abrufbar | Beide übernommen, Vermerk „ungeprüft“ |
| Aluminiumblech 0,2 mm | 0,496 kg/m², rechnerisch 0,54 | Übernommen, Vermerk „ungeprüft“ |
| COSMO Classic Quick Tape | 25 mm ist vermutlich die Breite, nicht die Stärke | Kategorie für Sonderfälle, Vermerk „ungeprüft“ |
| Wärmewert Evazote, Reimo X-Trem | 0,04 und 0,028 passen zur Wärmeleitfähigkeit | Als Wärmeleitfähigkeit in W/(m·K) übernommen |
| Wärmewert Styrodur, GFK, Kiefer | 0,27, 0,013 und 3,3 passen zu keiner einheitlichen Größe | Mit Forums-Einheit W/(m²K) übernommen, Vermerk „ungeprüft“ |
| Paulownia, Luxboard | Maße und Deckschichten standen im Namen | In die Notiz verschoben |
| OSB und Kiefer | Zwei Schreibweisen | „OSB-Platte“ und „Vollholz Kiefer“ |

Kategorien: Holz, Sperrholz, Metall, Schaum und Dämmung, Kunststoff, Verbundplatte, Textil. Die Zuordnung in der CSV ist ein Vorschlag, Andreas korrigiert sie im Admin-Bereich. Hersteller fehlen in den Forenlisten.

Dazu kommt die Kategorie „Stäbe, Leisten und Sonstiges“ für alles, was kein Flächenmaterial ist. Sie hat eigene Eigenschaften wie Länge, Durchmesser, Stückgewicht und Gewicht pro Meter. Erster Eintrag dort neben dem Tape: Bambusstab, Länge 2 m, Durchmesser 3,4 bis 5 cm, Stückgewicht ca. 500 g (Angabe aus dem Thread, nicht in der CSV).

Die englischen Erstfassungen für Eigenschaften, Kategorien und Materialnamen werden beim Einspielen erzeugt.

## Datenmodell

Eigenschaften werden zentral definiert und nicht mehr pro Material frei eingetippt. Erst dadurch werden Filter, Sortierung und Einheiten verlässlich.

| Tabelle | Inhalt | Verknüpft mit |
| --- | --- | --- |
| `material` | Name (de, optional en), Hersteller, Kategorie, Notiz (de, optional en), Status (Entwurf oder veröffentlicht) | Kategorie |
| `eigenschaft` | Kurzwort, Name (de, en), Typ, Standard-Einheit, Reihenfolge, standardmäßig sichtbar, filterbar | – |
| `wert` | Ein Wert eines Materials für eine Eigenschaft, mit eigener Einheit, Vermerk und optional Quelle | Material, Eigenschaft |
| `link` | Bezugsquelle oder Datenblatt mit Beschriftung | Material |
| `kategorie` | Name (de, en) | – |
| `meldung` | Fehlermeldung oder Vorschlag, mit Inhalt, Kommentar, Kontakt, Status | Material (bei Fehlern) |
| `aenderung` | Protokoll: wann wurde welcher Wert geändert | Material |

Typen von Eigenschaften:

| Typ | Beispiel | Filter |
| --- | --- | --- |
| Zahl mit Einheit | Stärke in mm, Gewicht in kg/m² | größer, kleiner, von–bis |
| Text | Bemerkung, Oberfläche | enthält |
| Auswahl | Brandklasse, Verarbeitung | eines von |
| Ja/Nein | wasserfest, UV-beständig | ja oder nein |

Eine neue Eigenschaft wird im Admin-Bereich angelegt. Sie erscheint danach automatisch als mögliche Spalte und als möglicher Filter, ohne Änderung am Code.

**Stärken.** Jede Kombination aus Material und Stärke ist eine eigene Zeile. Pappelsperrholz 4 mm und 10 mm sind zwei Einträge.

**Einheit pro Eintrag.** Jede Eigenschaft hat eine Standard-Einheit, jeder einzelne Wert kann davon abweichen und wird im Admin-Bereich direkt am Wert geändert. Ein Zahlenfilter zeigt die Einheit an und berücksichtigt nur Werte in dieser Einheit. Gibt es bei einer Eigenschaft mehrere Einheiten, wählt der Besucher im Filter eine aus.

**Deutsch und Englisch.** Die Oberfläche gibt es in beiden Sprachen, mit Umschalter oben rechts. Die Wahl steht als `lang=en` in der URL und wird im Browser gemerkt. Namen von Eigenschaften und Kategorien werden in beiden Sprachen gepflegt. Materialnamen und Notizen haben ein optionales englisches Feld; ist es leer, erscheint der deutsche Text.

## Übersichtstabelle und Filter

Die Startseite ist die Tabelle selbst: eine Zeile pro Material, darüber eine Suchzeile und die aktiven Filter als entfernbare Chips.

- Suchfeld für Name und Hersteller, wirkt sofort beim Tippen
- Schaltfläche „Filter hinzufügen“: Eigenschaft wählen, dann Bedingung passend zum Typ (bei Zahlen ein Von-bis-Feld, bei Auswahl eine Liste zum Ankreuzen)
- Jeder aktive Filter steht als Chip über der Tabelle, zum Beispiel „Gewicht ≤ 3 kg/m² ×“. Ein Klick auf das × entfernt ihn, ein Klick auf den Chip ändert ihn.
- „Alle Filter zurücksetzen“ und eine Anzeige „12 von 61 Materialien“
- Klick auf eine Spaltenüberschrift sortiert, zweiter Klick dreht die Richtung
- Spaltenauswahl: Eigenschaften ein- und ausblenden. Standardmäßig sichtbar sind nur die im Admin-Bereich dafür markierten.
- Materialien werden nach Namensteilen gruppiert (wie die Tabellengruppen in phpMyAdmin): Teile sind durch `_` getrennt, gleiche Anfangsteile in derselben Kategorie bilden eine Gruppe, auch verschachtelt (`Holz_Pappel_4mm`, `Holz_Pappel_10mm`, `Holz_Kiefer` → Gruppe „Holz“ mit Untergruppe „Pappel“). Gleiche Namen ohne Unterstrich bilden ebenfalls eine Gruppe. Die Kopfzeile zeigt die Anzahl und fasst die Werte zusammen (Zahlen als Bereich, z. B. „0,2–1,5 mm“). Ein Pfeil am rechten Rand der Zelle klappt die Gruppe auf. Mit dem Schalter „Gruppieren“ lässt sich das ausschalten (`flat=1` in der Adresse).
- Leere Werte werden als Strich angezeigt und beim Sortieren ans Ende gestellt
- Werte mit Vermerk „ungeprüft“ sind in der Tabelle erkennbar markiert
- Klick auf eine Zeile öffnet die Detailansicht mit allen Eigenschaften, Links, Quellen und der Schaltfläche „Fehler melden“
- Auf dem Handy bleibt die Namensspalte stehen, der Rest scrollt seitlich

**Filter in der URL.** Jede Änderung an Suche, Filtern, Sortierung und Spalten schreibt sich sofort in die Adresse. Wer den Link öffnet, sieht genau dieselbe Ansicht. Vor- und Zurück-Tasten des Browsers funktionieren wie erwartet.

```
/?q=sperrholz&f=gewicht:bis:3&f=staerke:4..10&f=wasserfest:ja&sort=gewicht&cols=staerke,gewicht,waermewert&lang=de
```

| Teil | Bedeutung |
| --- | --- |
| `q=sperrholz` | Textsuche |
| `f=gewicht:bis:3` | Gewicht höchstens 3 (weitere: `ab`, `ist`, `von..bis`) |
| `f=staerke:4..10` | Stärke zwischen 4 und 10 |
| `f=wasserfest:ja` | Ja/Nein-Eigenschaft |
| `sort=gewicht` | Aufsteigend sortiert, `-gewicht` für absteigend |
| `cols=…` | Sichtbare Spalten |
| `flat=1` | Materialien nicht gruppieren |
| `lang=en` | Sprache |

Jede Eigenschaft hat ein festes Kurzwort wie `gewicht`. Es bleibt gleich, auch wenn der Anzeigename später geändert wird, damit alte Links weiter funktionieren. Unbekannte oder fehlerhafte Filter in einer URL werden ignoriert und kurz als Hinweis angezeigt.

Bei einigen hundert Materialien lädt die Seite alle Daten einmal und filtert im Browser.

## Meldungen

Besucher melden Fehler und schlagen Materialien vor, ohne Konto. Nichts davon erscheint öffentlich, bevor es im Admin-Bereich übernommen wurde.

| | Fehler melden | Neues Material vorschlagen |
| --- | --- | --- |
| Einstieg | Schaltfläche in der Zeile und in der Detailansicht | Schaltfläche über der Tabelle |
| Vorbelegt | Material und seine aktuellen Werte | leeres Formular |
| Eingaben | Betroffene Eigenschaft, richtiger Wert, Kommentar | Name, Hersteller, Werte für beliebige Eigenschaften, Link |
| Pflicht | Kommentar oder neuer Wert | Name und mindestens ein Wert |
| Optional | Quelle als Link, Kontakt für Rückfragen | Quelle als Link, Kontakt für Rückfragen |

Im Vorschlagsformular wählt der Besucher Eigenschaften aus der zentralen Liste. Fehlt eine, nennt er sie im Kommentar. Neue Eigenschaften legt nur der Admin an.

Schutz vor Spam, ohne Captcha:

- Ein verstecktes Feld, das nur Bots ausfüllen
- Höchstens fünf Meldungen pro Stunde von einer Adresse
- Mindestzeit zwischen Öffnen und Absenden des Formulars
- Längenbegrenzung für alle Felder, Links werden nie automatisch veröffentlicht

## Admin-Bereich

Der Admin-Bereich liegt unter einem Fantasienamen (Standard `/wunderkammer`, änderbar mit `ADMIN_PATH`) hinter einem Login und hat drei Teile. Die öffentliche Tabelle verlinkt am Seitenende dezent darauf.

**Materialien**

- Dieselbe Tabelle wie öffentlich, aber mit Bearbeiten direkt in der Zelle, einschließlich Einheit und Vermerk pro Wert
- Material anlegen, duplizieren (für eine weitere Stärke), als Entwurf verstecken, löschen
- Links und Quellen pro Material pflegen

**Eigenschaften**

- Anlegen, umbenennen (de und en), Typ und Standard-Einheit festlegen, Reihenfolge per Ziehen ändern
- Festlegen, ob eine Eigenschaft standardmäßig sichtbar und ob sie filterbar ist
- Zwei Eigenschaften zusammenführen, falls doppelte entstanden sind
- Löschen nur mit Warnung, wie viele Werte dabei verloren gehen

**Meldungen**

- Eingang mit offenen Meldungen, neueste zuerst, mit Zähler in der Navigation
- Bei Fehlermeldungen: alter und vorgeschlagener Wert nebeneinander, „Übernehmen“ mit einem Klick
- Bei Vorschlägen: Formular vorbefüllt, korrigieren und veröffentlichen
- Ablehnen mit optionaler Notiz, erledigte Meldungen bleiben im Archiv

**Login und Sicherheit.** Ein Admin-Konto mit Passwort. Das Passwort liegt nur als Hash in der Server-Konfiguration (Umgebungsvariable), nicht im Repo. Anmeldung über ein Sitzungs-Cookie, nach fünf Fehlversuchen eine Wartezeit. Jede Änderung landet im Protokoll.

## Technik

| Baustein | Vorschlag | Warum |
| --- | --- | --- |
| Datenbank | SQLite, eine Datei im `data/`-Ordner | Echte Tabellen und Beziehungen, kein eigener Datenbankserver, Sicherung durch Kopieren einer Datei |
| Server | Node.js mit Express wie bisher | Bekannt, reicht für die wenigen Schnittstellen |
| Oberfläche | Vite mit einem leichten Framework wie Svelte oder Vue | Filter, Chips und Bearbeiten in der Zelle werden in reinem JavaScript schnell unübersichtlich |
| Betrieb | Docker und Caddy wie bisher | Funktioniert bereits, bleibt unverändert |
| Tests | Automatische Tests für Filter und URL-Format | Dort entstehen die meisten Fehler |

Aus dem alten Repo bleiben: Dockerfile, Compose-Datei, Caddyfile und das Farbschema. Die Next.js-Reste werden entfernt. Link-Prüfung, Ko-fi-Fußzeile und dunkles Design werden in Phase 5 neu angebunden.

## Umsetzungsphasen

Jede Phase endet mit etwas, das sich ausprobieren lässt.

1. **Fundament.** Datenbank mit allen Tabellen anlegen, Schnittstellen für Materialien und Eigenschaften bauen. Ein einmaliges Skript spielt `startdaten.csv` ein. Ergebnis: Die Daten liegen sauber in der Datenbank.
2. **Öffentliche Tabelle.** Tabelle mit Suche, Sortierung, Spaltenauswahl, Filter-Chips, Filtern in der URL und Sprachumschalter, dazu die Detailansicht. Ergebnis: Das Tool ist für Besucher benutzbar.
3. **Admin-Bereich.** Login, Materialien und Eigenschaften bearbeiten, Änderungsprotokoll. Ergebnis: Datenpflege ohne Skripte.
4. **Meldungen.** Formulare für Fehler und Vorschläge, Spam-Schutz, Eingang im Admin-Bereich mit „Übernehmen“. Ergebnis: Die Community kann mitarbeiten.
5. **Feinschliff und Start.** Handy-Ansicht, helles und dunkles Design, Link-Prüfung, Ko-fi-Fußzeile, Tests, Deployment, Hinweis im Forum.

Phase 4 kommt nach Phase 3, weil das Übernehmen von Meldungen die Bearbeitungsfunktionen des Admin-Bereichs nutzt.

## Stand

- [x] Admin-Schlüssel entfernt: `data/editor-key.txt` und die alten Routen sind aus dem Repo
- [x] Phase 1: Datenbank, Schnittstellen und Einspielen der Startdaten
- [x] Phase 2: öffentliche Tabelle (zusätzlich: Kategorie-Leiste mit Icons als Filter)
- [x] Phase 3: Admin-Bereich (zusätzlich: Kategorien mit Icons verwalten)
- [x] Phase 4: Meldungen. Ablauf: Besucher senden über Formulare (ohne Konto), Spam-Schutz mit verstecktem Feld, Mindestzeit
  und höchstens fünf Meldungen pro Stunde und Adresse; im Admin-Bereich liegen sie im Eingang mit Zähler. Fehlermeldungen werden
  mit einem Klick (nach Korrektur) übernommen, Vorschläge öffnen das Materialformular vorbefüllt. Erledigte Meldungen bleiben im Archiv.
- [x] Phase 5: Feinschliff (Handy-Ansicht mit wischbarer Kategorie-Leiste, Link-Prüfung, Ko-fi-Fußzeile). Offen nur: Hinweis im Forum (macht der Betreiber)
  - Link-Prüfung: Der Server prüft alle Links täglich (und eine Minute nach dem Start); im Admin-Bereich gibt es „Links prüfen“. Ergebnis je Link: erreichbar, unklar (403/429) oder nicht erreichbar, als Punkt in der Detailansicht. Adressen im lokalen Netz werden nie abgefragt.
  - Projekt unterstützen: Bereich in der Fußzeile, vollständig über die .env eingestellt (SUPPORT_URL, SUPPORT_GOAL, SUPPORT_RAISED, Texte). Der Fortschrittsbalken zählt von Hand eingetragene Beträge und, mit KOFI_VERIFICATION_TOKEN, per Ko-fi-Webhook (`POST /api/v2/kofi`) gemeldete Beträge; gespeichert werden nur Betrag und Transaktionsnummer.
  - Datenschutzerklärung unter `/datenschutz` (Deutsch und Englisch, in `src/public/Datenschutz.svelte`): keine Cookies für Besucher, keine Zugriffsprotokolle, Browser-Speicher nur für Sprache und Design, Hinweis zu Ko-fi. Der Verantwortliche kommt aus OPERATOR in der .env.
  - Impressum unter `/impressum` (§ 5 DDG, Angaben aus OPERATOR) mit Hinweis, dass die Materialangaben ohne Gewähr sind.

## Icon-Stil „Feinstrich“

Alle Icons (Kategorien und Bedienelemente) sind selbst gezeichnet und stehen in `src/shared/Icon.svelte`. Regeln:

1. Zeichenfläche 24 × 24, Inhalt mit mindestens 2 Einheiten Rand.
2. Nur Linien, keine Füllungen: Strichstärke 1,5, runde Enden und Ecken, Farbe = `currentColor`.
3. Form aus einfachen Grundelementen (Kreise, gerade Linien, Bögen), Winkel möglichst 45° oder 90°.
4. Parallele Linien haben mindestens 3 Einheiten Abstand.
5. Innenlinien haben dieselbe Stärke wie die Außenlinie, höchstens eine Detailebene.
6. Aufstehende Dinge stehen auf einer Grundlinie bei y = 21.

Kategorie-Icons sind in der Akzentfarbe, Bedienelemente übernehmen die Textfarbe. Neue Kategorie-Icons müssen zusätzlich in `lib/icons.js` eingetragen werden.
