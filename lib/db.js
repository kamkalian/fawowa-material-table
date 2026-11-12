import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ICON_NACH_SLUG, ALTE_ICON_VORSCHLAEGE, ICON_VERSION, ICON_NAMEN, STANDARD_ICON } from './icons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data', 'material.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kategorie (
  id          INTEGER PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name_de     TEXT NOT NULL,
  name_en     TEXT,
  icon        TEXT,
  reihenfolge INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS material (
  id            INTEGER PRIMARY KEY,
  name_de       TEXT NOT NULL,
  name_en       TEXT,
  hersteller    TEXT,
  kategorie_id  INTEGER NOT NULL REFERENCES kategorie(id),
  notiz_de      TEXT,
  notiz_en      TEXT,
  status        TEXT NOT NULL DEFAULT 'entwurf' CHECK (status IN ('entwurf', 'veroeffentlicht')),
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now')),
  geaendert_am  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eigenschaft (
  id                INTEGER PRIMARY KEY,
  kurzwort          TEXT NOT NULL UNIQUE,
  name_de           TEXT NOT NULL,
  name_en           TEXT,
  typ               TEXT NOT NULL CHECK (typ IN ('zahl', 'text', 'auswahl', 'ja_nein')),
  standard_einheit  TEXT,
  reihenfolge       INTEGER NOT NULL DEFAULT 0,
  standard_sichtbar INTEGER NOT NULL DEFAULT 0 CHECK (standard_sichtbar IN (0, 1)),
  filterbar         INTEGER NOT NULL DEFAULT 1 CHECK (filterbar IN (0, 1))
);

-- Auswahlmöglichkeiten für Eigenschaften vom Typ "auswahl"
CREATE TABLE IF NOT EXISTS eigenschaft_option (
  id              INTEGER PRIMARY KEY,
  eigenschaft_id  INTEGER NOT NULL REFERENCES eigenschaft(id) ON DELETE CASCADE,
  wert_de         TEXT NOT NULL,
  wert_en         TEXT,
  reihenfolge     INTEGER NOT NULL DEFAULT 0
);

-- Ein Wert eines Materials für eine Eigenschaft. Genau eine Wertspalte ist gefüllt, passend zum Typ.
CREATE TABLE IF NOT EXISTS wert (
  id              INTEGER PRIMARY KEY,
  material_id     INTEGER NOT NULL REFERENCES material(id) ON DELETE CASCADE,
  eigenschaft_id  INTEGER NOT NULL REFERENCES eigenschaft(id) ON DELETE CASCADE,
  zahl            REAL,
  text            TEXT,
  option_id       INTEGER REFERENCES eigenschaft_option(id) ON DELETE SET NULL,
  ja_nein         INTEGER CHECK (ja_nein IN (0, 1)),
  einheit         TEXT,
  vermerk_de      TEXT,
  vermerk_en      TEXT,
  UNIQUE (material_id, eigenschaft_id)
);

CREATE TABLE IF NOT EXISTS link (
  id            INTEGER PRIMARY KEY,
  material_id   INTEGER NOT NULL REFERENCES material(id) ON DELETE CASCADE,
  beschriftung  TEXT NOT NULL,
  url           TEXT NOT NULL,
  reihenfolge   INTEGER NOT NULL DEFAULT 0
);

-- Über den Ko-fi-Webhook gemeldete Beträge (nur für den Fortschrittsbalken, ohne Namen oder Nachrichten)
CREATE TABLE IF NOT EXISTS unterstuetzung (
  nachricht_id  TEXT PRIMARY KEY,
  betrag        REAL NOT NULL,
  waehrung      TEXT NOT NULL,
  erhalten_am   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meldung (
  id            INTEGER PRIMARY KEY,
  art           TEXT NOT NULL CHECK (art IN ('fehler', 'vorschlag')),
  material_id   INTEGER REFERENCES material(id) ON DELETE SET NULL,
  inhalt        TEXT NOT NULL,            -- JSON
  kommentar     TEXT,
  kontakt       TEXT,
  quelle        TEXT,
  status        TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'uebernommen', 'abgelehnt')),
  admin_notiz   TEXT,
  erstellt_am   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Änderungsprotokoll
CREATE TABLE IF NOT EXISTS aenderung (
  id            INTEGER PRIMARY KEY,
  zeitpunkt     TEXT NOT NULL DEFAULT (datetime('now')),
  material_id   INTEGER REFERENCES material(id) ON DELETE SET NULL,
  feld          TEXT NOT NULL,
  alt           TEXT,
  neu           TEXT
);

CREATE INDEX IF NOT EXISTS idx_material_kategorie ON material(kategorie_id);
CREATE INDEX IF NOT EXISTS idx_wert_material ON wert(material_id);
CREATE INDEX IF NOT EXISTS idx_wert_eigenschaft ON wert(eigenschaft_id);
CREATE INDEX IF NOT EXISTS idx_link_material ON link(material_id);
CREATE INDEX IF NOT EXISTS idx_meldung_status ON meldung(status);
CREATE INDEX IF NOT EXISTS idx_aenderung_material ON aenderung(material_id);
`;

export function openDb(path = DB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migriere(db);
  return db;
}

// Ergänzt Spalten, die es in älteren Datenbanken noch nicht gibt.
function migriere(db) {
  const spalten = db.prepare('PRAGMA table_info(kategorie)').all().map(c => c.name);
  if (!spalten.includes('icon')) db.exec('ALTER TABLE kategorie ADD COLUMN icon TEXT');

  // Quellen einzelner Werte gibt es nicht mehr. Bestehende werden zu Links des Materials, danach entfällt die Spalte.
  if (db.prepare('PRAGMA table_info(wert)').all().some(c => c.name === 'quelle')) {
    db.transaction(() => {
      const zeilen = db.prepare("SELECT DISTINCT material_id, quelle FROM wert WHERE quelle IS NOT NULL AND quelle != ''").all();
      const vorhanden = db.prepare('SELECT 1 FROM link WHERE material_id = ? AND url = ?');
      const naechste = db.prepare('SELECT COALESCE(MAX(reihenfolge), -1) + 1 AS n FROM link WHERE material_id = ?');
      const neu = db.prepare('INSERT INTO link (material_id, beschriftung, url, reihenfolge) VALUES (?, ?, ?, ?)');
      for (const z of zeilen) {
        if (!/^https?:\/\/\S+$/i.test(z.quelle) || vorhanden.get(z.material_id, z.quelle)) continue;
        neu.run(z.material_id, 'Quelle', z.quelle, naechste.get(z.material_id).n);
      }
      db.exec('ALTER TABLE wert DROP COLUMN quelle');
    })();
  }

  // Ergebnis der Link-Prüfung (siehe lib/linkpruefung.js)
  const linkSpalten = db.prepare('PRAGMA table_info(link)').all().map(c => c.name);
  if (!linkSpalten.includes('status')) db.exec('ALTER TABLE link ADD COLUMN status TEXT');
  if (!linkSpalten.includes('geprueft_am')) db.exec('ALTER TABLE link ADD COLUMN geprueft_am TEXT');

  // Kategorien ohne Icon oder mit einem früheren Vorschlag bekommen den aktuellen Vorschlag.
  // Das läuft nur einmal je Version, damit später gewählte Icons nicht überschrieben werden.
  if (db.pragma('user_version', { simple: true }) < ICON_VERSION) {
    const setze = db.prepare('UPDATE kategorie SET icon = ? WHERE slug = ? AND (icon IS NULL OR icon = ?)');
    for (const [slug, icon] of Object.entries(ICON_NACH_SLUG)) {
      setze.run(icon, slug, null); // fehlendes Icon
      for (const alt of ALTE_ICON_VORSCHLAEGE[slug] ?? []) setze.run(icon, slug, alt);
    }
    // Es gibt nur noch selbst gezeichnete Icons: alles andere (frühere Bibliotheks-Symbole, farbige Icons)
    // wird durch das Standard-Symbol der Kategorie ersetzt, bei unbekannten Kategorien durch den neutralen Kreis
    const gueltig = new Set(ICON_NAMEN);
    for (const k of db.prepare('SELECT id, slug, icon FROM kategorie').all()) {
      if (!gueltig.has(k.icon)) {
        db.prepare('UPDATE kategorie SET icon = ? WHERE id = ?').run(ICON_NACH_SLUG[k.slug] ?? STANDARD_ICON, k.id);
      }
    }
    db.pragma(`user_version = ${ICON_VERSION}`);
  }
}

// --- Lesen ---

export function listKategorien(db) {
  return db.prepare('SELECT id, slug, name_de, name_en, icon, reihenfolge FROM kategorie ORDER BY reihenfolge, name_de')
    .all()
    .map(mapKategorie);
}

export function listEigenschaften(db) {
  return db.prepare(`
    SELECT id, kurzwort, name_de, name_en, typ, standard_einheit, reihenfolge,
           standard_sichtbar, filterbar
    FROM eigenschaft ORDER BY reihenfolge, name_de
  `).all().map(e => ({
    ...mapEigenschaft(e),
    optionen: db.prepare(`
      SELECT id, wert_de, wert_en FROM eigenschaft_option
      WHERE eigenschaft_id = ? ORDER BY reihenfolge, wert_de
    `).all(e.id).map(o => ({ id: o.id, de: o.wert_de, en: o.wert_en }))
  }));
}

/**
 * Materialien mit allen Werten und Links. Standardmäßig nur veröffentlichte.
 */
export function listMaterialien(db, { alle = false } = {}) {
  const where = alle ? '' : "WHERE m.status = 'veroeffentlicht'";
  const rows = db.prepare(`
    SELECT m.*, k.slug AS k_slug, k.name_de AS k_de, k.name_en AS k_en, k.icon AS k_icon, k.reihenfolge AS k_reihenfolge
    FROM material m JOIN kategorie k ON k.id = m.kategorie_id
    ${where}
    ORDER BY k.reihenfolge, m.name_de, m.id
  `).all();
  if (!rows.length) return [];

  const werte = db.prepare(`
    SELECT w.material_id, e.kurzwort, e.typ, w.zahl, w.text, w.ja_nein, w.einheit, w.option_id,
           w.vermerk_de, w.vermerk_en, o.wert_de AS option_de, o.wert_en AS option_en
    FROM wert w
    JOIN eigenschaft e ON e.id = w.eigenschaft_id
    LEFT JOIN eigenschaft_option o ON o.id = w.option_id
  `).all();
  const links = db.prepare('SELECT material_id, beschriftung, url, status FROM link ORDER BY reihenfolge, id').all();

  const wertMap = new Map();
  for (const w of werte) {
    if (!wertMap.has(w.material_id)) wertMap.set(w.material_id, {});
    wertMap.get(w.material_id)[w.kurzwort] = mapWert(w);
  }
  const linkMap = new Map();
  for (const l of links) {
    if (!linkMap.has(l.material_id)) linkMap.set(l.material_id, []);
    linkMap.get(l.material_id).push({ beschriftung: l.beschriftung, url: l.url, status: l.status || null });
  }

  return rows.map(r => ({
    id: r.id,
    name: { de: r.name_de, en: r.name_en || null },
    hersteller: r.hersteller || null,
    kategorie: { id: r.kategorie_id, slug: r.k_slug, icon: r.k_icon || null, name: { de: r.k_de, en: r.k_en || null } },
    notiz: { de: r.notiz_de || null, en: r.notiz_en || null },
    status: r.status,
    werte: wertMap.get(r.id) || {},
    links: linkMap.get(r.id) || []
  }));
}

export function getMaterial(db, id, { alle = false } = {}) {
  return listMaterialien(db, { alle: true }).find(m => m.id === Number(id) && (alle || m.status === 'veroeffentlicht')) || null;
}

// --- Schreiben (Grundlage für Einspielen und später Admin-Bereich) ---

export function createKategorie(db, { slug, name_de, name_en = null, icon = null, reihenfolge = 0 }) {
  const info = db.prepare(
    'INSERT INTO kategorie (slug, name_de, name_en, icon, reihenfolge) VALUES (?, ?, ?, ?, ?)'
  ).run(slug, name_de, name_en, icon, reihenfolge);
  return Number(info.lastInsertRowid);
}

export function createEigenschaft(db, e) {
  const info = db.prepare(`
    INSERT INTO eigenschaft (kurzwort, name_de, name_en, typ, standard_einheit, reihenfolge, standard_sichtbar, filterbar)
    VALUES (@kurzwort, @name_de, @name_en, @typ, @standard_einheit, @reihenfolge, @standard_sichtbar, @filterbar)
  `).run({
    kurzwort: e.kurzwort,
    name_de: e.name_de,
    name_en: e.name_en ?? null,
    typ: e.typ,
    standard_einheit: e.standard_einheit ?? null,
    reihenfolge: e.reihenfolge ?? 0,
    standard_sichtbar: e.standard_sichtbar ? 1 : 0,
    filterbar: e.filterbar === false ? 0 : 1
  });
  return Number(info.lastInsertRowid);
}

/**
 * Legt ein Material mit Werten und Links in einer Transaktion an.
 * material: { name_de, name_en, hersteller, kategorie_id, notiz_de, notiz_en, status }
 * werte:   { [kurzwort]: { zahl | text | ja_nein | option_id, einheit, vermerk_de, vermerk_en } }
 */
export const createMaterial = (db, material, werte = {}, links = []) => db.transaction(() => {
  const info = db.prepare(`
    INSERT INTO material (name_de, name_en, hersteller, kategorie_id, notiz_de, notiz_en, status)
    VALUES (@name_de, @name_en, @hersteller, @kategorie_id, @notiz_de, @notiz_en, @status)
  `).run({
    name_de: material.name_de,
    name_en: material.name_en ?? null,
    hersteller: material.hersteller ?? null,
    kategorie_id: material.kategorie_id,
    notiz_de: material.notiz_de ?? null,
    notiz_en: material.notiz_en ?? null,
    status: material.status ?? 'entwurf'
  });
  const materialId = Number(info.lastInsertRowid);

  const eigenschaften = new Map(
    db.prepare('SELECT id, kurzwort FROM eigenschaft').all().map(e => [e.kurzwort, e.id])
  );
  const insertWert = db.prepare(`
    INSERT INTO wert (material_id, eigenschaft_id, zahl, text, option_id, ja_nein, einheit, vermerk_de, vermerk_en)
    VALUES (@material_id, @eigenschaft_id, @zahl, @text, @option_id, @ja_nein, @einheit, @vermerk_de, @vermerk_en)
  `);
  for (const [kurzwort, w] of Object.entries(werte)) {
    const eid = eigenschaften.get(kurzwort);
    if (!eid) throw new Error(`Unbekannte Eigenschaft: ${kurzwort}`);
    insertWert.run({
      material_id: materialId,
      eigenschaft_id: eid,
      zahl: w.zahl ?? null,
      text: w.text ?? null,
      option_id: w.option_id ?? null,
      ja_nein: w.ja_nein === undefined || w.ja_nein === null ? null : (w.ja_nein ? 1 : 0),
      einheit: w.einheit ?? null,
      vermerk_de: w.vermerk_de ?? null,
      vermerk_en: w.vermerk_en ?? null
    });
  }

  const insertLink = db.prepare('INSERT INTO link (material_id, beschriftung, url, reihenfolge) VALUES (?, ?, ?, ?)');
  links.forEach((l, i) => insertLink.run(materialId, l.beschriftung, l.url, i));

  return materialId;
})();

// --- Mapping ---

function mapKategorie(k) {
  return { id: k.id, slug: k.slug, icon: k.icon || null, name: { de: k.name_de, en: k.name_en || null }, reihenfolge: k.reihenfolge };
}

function mapEigenschaft(e) {
  return {
    id: e.id,
    kurzwort: e.kurzwort,
    name: { de: e.name_de, en: e.name_en || null },
    typ: e.typ,
    einheit: e.standard_einheit,
    reihenfolge: e.reihenfolge,
    standardSichtbar: !!e.standard_sichtbar,
    filterbar: !!e.filterbar
  };
}

function mapWert(w) {
  const base = {
    einheit: w.einheit,
    vermerk: w.vermerk_de ? { de: w.vermerk_de, en: w.vermerk_en || null } : null
  };
  switch (w.typ) {
    case 'zahl': return { ...base, wert: w.zahl };
    case 'ja_nein': return { ...base, wert: w.ja_nein === null ? null : !!w.ja_nein };
    case 'auswahl': return {
      ...base,
      optionId: w.option_id ?? null,
      wert: w.option_de ? { de: w.option_de, en: w.option_en || null } : null
    };
    default: return { ...base, wert: w.text };
  }
}
