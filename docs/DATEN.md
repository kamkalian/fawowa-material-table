# Datenformat

Die Materialdaten liegen als JSON-Dateien in einem Git-Repository. Der Server hält sie im Speicher, schreibt jede
Änderung aus dem Admin-Bereich in die Dateien, committet sie mit einer lesbaren Beschreibung und sendet sie ins Repo.
Dateien lassen sich auch direkt im Repo ändern; im Admin-Bereich („Protokoll und Repo“) lädt der Knopf
„Aus dem Repo laden“ die neuen Commits und prüft jede Datei, bevor sie gelten.

```
kategorien.json                  Liste der Kategorien (Reihenfolge = Reihenfolge der Liste)
eigenschaften.json               Liste der Eigenschaften mit Auswahlmöglichkeiten (Reihenfolge = Reihenfolge der Liste)
materialien/<name>-<id>.json     eine Datei je Material
```

Nicht im Repo (liegt lokal in `data/lokal/`): `meldungen.json` (enthält Kontaktangaben von Besuchern), `linkstatus.json`
(Ergebnis der Link-Prüfung), `unterstuetzung.json` (über Ko-fi gemeldete Beträge).

## kategorien.json

```json
[{ "id": 1, "slug": "holz", "name_de": "Holz", "name_en": "Wood", "icon": "trees" }]
```

`slug`: a-z, 0-9 und Bindestrich, eindeutig. `icon`: einer der Namen aus `lib/icons.js`.

## eigenschaften.json

```json
[
  { "id": 1, "kurzwort": "staerke", "name_de": "Stärke", "name_en": "Thickness", "typ": "zahl",
    "standard_einheit": "mm", "standard_sichtbar": true, "filterbar": true },
  { "id": 5, "kurzwort": "brand", "name_de": "Brandklasse", "typ": "auswahl",
    "optionen": [{ "id": 1, "de": "B1", "en": "B1" }] }
]
```

`typ`: `zahl`, `text`, `auswahl` oder `ja_nein`. `kurzwort` steht in Adressen (Filter, Sortierung) und ist später nicht
änderbar. `optionen` gibt es nur bei `auswahl`.

## materialien/*.json

```json
{
  "id": 12,
  "name_de": "Pappelsperrholz",
  "name_en": "Poplar plywood",
  "hersteller": "ACME",
  "kategorie": "holz",
  "status": "veroeffentlicht",
  "notiz_de": "…",
  "erstellt_am": "2026-11-11 13:53:46",
  "geaendert_am": "2026-11-12 08:00:00",
  "werte": {
    "staerke":    { "zahl": 4, "einheit": "mm", "vermerk_de": "ungeprüft", "vermerk_en": "unverified" },
    "wasserfest": { "ja_nein": true },
    "brand":      { "option": "B1" },
    "notiz":      { "text": "…" }
  },
  "links": [{ "beschriftung": "Datenblatt", "url": "https://example.org/blatt.pdf" }]
}
```

- `id`: Zahl, eindeutig, bleibt für immer gleich (Adressen wie `?m=12`). Bei einer von Hand angelegten Datei kann sie
  fehlen, der Server vergibt sie dann beim Laden und committet das.
- `kategorie`: der `slug` einer Kategorie. `status`: `entwurf` oder `veroeffentlicht`. Entwürfe sind im Repo sichtbar,
  auf der öffentlichen Seite nicht.
- `werte`: je Eigenschaft (Schlüssel = `kurzwort`) genau die Felder, die zum Typ passen: `zahl` (+ `einheit`), `text`,
  `ja_nein`, `option` (der deutsche Text der Auswahl). `vermerk_de` / `vermerk_en` markieren einen Wert, z. B. als „ungeprüft“.
- Dateiname: `<name>-<id>.json`. Beim Umbenennen eines Materials bleibt der Dateiname gleich.

## Prüfung

Beim Laden aus dem Repo wird jede Datei geprüft: gültiges JSON, Pflichtfelder, bekannte Kategorie und Eigenschaften,
Werte passend zum Typ, vorhandene Auswahlen, Links mit `http://` oder `https://`, keine doppelten IDs. Bei einem Fehler
wird nichts übernommen; der bisherige Stand bleibt aktiv und der Admin-Bereich nennt Datei und Problem. Hat der Server
beim Start Fehler in den Dateien, sind Änderungen gesperrt, damit nichts überschrieben wird, bis alles korrigiert ist.

## Zusammenarbeit

Der Server ist der einzige, der automatisch committet. Hat jemand direkt im Repo etwas geändert, während hier auch
etwas geändert wurde, lässt sich das nicht automatisch zusammenführen: Der Admin-Bereich zeigt das an, die beiden
Stände müssen dann im Repo abgestimmt werden.
