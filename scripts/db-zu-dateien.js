// Einmalige Umstellung: liest die alte SQLite-Datenbank und schreibt die Daten als Dateien.
//   node scripts/db-zu-dateien.js <material.db> <Zielordner für das Repo> [<Ordner für lokale Dateien>]
//
// Ins Repo (Zielordner): kategorien.json, eigenschaften.json, materialien/<name>-<id>.json
// Lokal (nicht ins Repo): meldungen.json (enthält Kontaktangaben), linkstatus.json, unterstuetzung.json
// Dieses Skript braucht better-sqlite3, das nicht mehr zum Projekt gehört: vorher einmal
//   npm install --no-save better-sqlite3
// ausführen. Es wird nur für die Umstellung gebraucht.

import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { serialisiere, slugify } from '../lib/speicher.js';
import { ICON_NAMEN, ICON_NACH_SLUG, STANDARD_ICON } from '../lib/icons.js';

const [dbPfad, ziel, lokal = null] = process.argv.slice(2);
if (!dbPfad || !ziel) {
  console.error('Aufruf: node scripts/db-zu-dateien.js <material.db> <Zielordner> [<Ordner für lokale Dateien>]');
  process.exit(1);
}
if (existsSync(ziel) && readdirSync(ziel).some(d => !d.startsWith('.'))) {
  console.error(`Der Zielordner ${ziel} ist nicht leer. Bitte einen leeren Ordner angeben.`);
  process.exit(1);
}

const db = new Database(dbPfad, { readonly: true });
const hat = (tabelle, spalte) => db.prepare(`PRAGMA table_info(${tabelle})`).all().some(c => c.name === spalte);

const kategorien = db.prepare('SELECT * FROM kategorie ORDER BY reihenfolge, id').all().map((k, i) => ({
  id: k.id, slug: k.slug, name_de: k.name_de, name_en: k.name_en || null, icon: ICON_NAMEN.includes(k.icon) ? k.icon : (ICON_NACH_SLUG[k.slug] ?? STANDARD_ICON), reihenfolge: i + 1
}));

const optionenJeEigenschaft = new Map();
for (const o of db.prepare('SELECT * FROM eigenschaft_option ORDER BY reihenfolge, id').all()) {
  if (!optionenJeEigenschaft.has(o.eigenschaft_id)) optionenJeEigenschaft.set(o.eigenschaft_id, []);
  optionenJeEigenschaft.get(o.eigenschaft_id).push({ id: o.id, de: o.wert_de, en: o.wert_en || null });
}
const eigenschaften = db.prepare('SELECT * FROM eigenschaft ORDER BY reihenfolge, id').all().map((e, i) => ({
  id: e.id, kurzwort: e.kurzwort, name_de: e.name_de, name_en: e.name_en || null, typ: e.typ,
  standard_einheit: e.standard_einheit || null, reihenfolge: i + 1,
  standard_sichtbar: !!e.standard_sichtbar, filterbar: !!e.filterbar, optionen: optionenJeEigenschaft.get(e.id) ?? []
}));
const kurzwortVon = new Map(eigenschaften.map(e => [e.id, e.kurzwort]));

const werteJeMaterial = new Map();
for (const w of db.prepare('SELECT * FROM wert').all()) {
  if (!werteJeMaterial.has(w.material_id)) werteJeMaterial.set(w.material_id, {});
  werteJeMaterial.get(w.material_id)[kurzwortVon.get(w.eigenschaft_id)] = {
    zahl: w.zahl ?? null, text: w.text ?? null, option_id: w.option_id ?? null,
    ja_nein: w.ja_nein === null || w.ja_nein === undefined ? null : !!w.ja_nein,
    einheit: w.einheit || null, vermerk_de: w.vermerk_de || null, vermerk_en: w.vermerk_en || null
  };
}
const statusSpalten = hat('link', 'status');
const linksJeMaterial = new Map();
const linkStatus = {};
for (const l of db.prepare('SELECT * FROM link ORDER BY reihenfolge, id').all()) {
  if (!linksJeMaterial.has(l.material_id)) linksJeMaterial.set(l.material_id, []);
  linksJeMaterial.get(l.material_id).push({ beschriftung: l.beschriftung, url: l.url });
  if (statusSpalten && l.status) linkStatus[l.url] = { status: l.status, geprueft_am: l.geprueft_am };
}

const materialien = db.prepare('SELECT * FROM material ORDER BY id').all().map(m => ({
  id: m.id, datei: `${slugify(m.name_de) || 'material'}-${m.id}.json`, name_de: m.name_de, name_en: m.name_en || null,
  hersteller: m.hersteller || null, kategorie_id: m.kategorie_id, notiz_de: m.notiz_de || null, notiz_en: m.notiz_en || null,
  status: m.status, erstellt_am: m.erstellt_am, geaendert_am: m.geaendert_am,
  werte: werteJeMaterial.get(m.id) ?? {}, links: linksJeMaterial.get(m.id) ?? []
}));

for (const [pfad, inhalt] of serialisiere({ kategorien, eigenschaften, materialien })) {
  const datei = join(ziel, pfad);
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, inhalt);
}
console.log(`Repo-Dateien: ${kategorien.length} Kategorien, ${eigenschaften.length} Eigenschaften, ${materialien.length} Materialien in ${ziel}`);

if (lokal) {
  mkdirSync(lokal, { recursive: true });
  const schreibe = (name, wert) => writeFileSync(join(lokal, `${name}.json`), JSON.stringify(wert, null, 2) + '\n');
  const meldungen = db.prepare('SELECT * FROM meldung ORDER BY id').all().map(m => ({
    id: m.id, art: m.art, material_id: m.material_id, inhalt: JSON.parse(m.inhalt), kommentar: m.kommentar, kontakt: m.kontakt,
    quelle: m.quelle, status: m.status, admin_notiz: m.admin_notiz, erstellt_am: m.erstellt_am
  }));
  schreibe('meldungen', meldungen);
  schreibe('linkstatus', linkStatus);
  const beitraege = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'unterstuetzung'").get()
    ? db.prepare('SELECT nachricht_id, betrag, waehrung, erhalten_am FROM unterstuetzung').all() : [];
  schreibe('unterstuetzung', beitraege);
  console.log(`Lokale Dateien: ${meldungen.length} Meldungen, ${Object.keys(linkStatus).length} Link-Status, ${beitraege.length} Beiträge in ${lokal}`);
}
db.close();
