import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { openDb, createKategorie, createEigenschaft } from '../lib/db.js';
import { ICON_NAMEN, ICON_NACH_SLUG } from '../lib/icons.js';
import { hashPasswort, pruefePasswort, anmelden, sitzungGueltig, _intern } from '../lib/auth.js';
import {
  anlegenMaterial, aendereMaterial, setzeWert, setzeLinks, duplizierMaterial, loescheMaterial,
  anlegenEigenschaft, aendereEigenschaft, setzeOptionen, loescheEigenschaft, fuehreZusammen,
  listProtokoll, FehlerEingabe, getAlleEigenschaften, anlegenKategorie, aendereKategorie,
  loescheKategorie, setzeKategorieReihenfolge, getKategorien
} from '../lib/admin.js';

const PASSWORT = 'sicheres-test-passwort-123';

beforeEach(() => {
  _intern.reset();
  process.env.ADMIN_PASSWORD_HASH = hashPasswort(PASSWORT);
});

function neueDb() {
  const db = openDb(':memory:');
  const kat = createKategorie(db, { slug: 'holz', name_de: 'Holz', name_en: 'Wood', reihenfolge: 1 });
  createEigenschaft(db, { kurzwort: 'staerke', name_de: 'Stärke', typ: 'zahl', standard_einheit: 'mm', reihenfolge: 1, standard_sichtbar: true });
  createEigenschaft(db, { kurzwort: 'gewicht', name_de: 'Gewicht', typ: 'zahl', standard_einheit: 'kg/m²', reihenfolge: 2 });
  createEigenschaft(db, { kurzwort: 'wasserfest', name_de: 'Wasserfest', typ: 'ja_nein', reihenfolge: 3 });
  createEigenschaft(db, { kurzwort: 'brand', name_de: 'Brandklasse', typ: 'auswahl', reihenfolge: 4 });
  const brand = db.prepare("SELECT id FROM eigenschaft WHERE kurzwort = 'brand'").get().id;
  db.prepare('INSERT INTO eigenschaft_option (eigenschaft_id, wert_de, reihenfolge) VALUES (?, ?, 1)').run(brand, 'B1');
  createEigenschaft(db, { kurzwort: 'laenge', name_de: 'Länge', typ: 'zahl', standard_einheit: 'm', reihenfolge: 5 });
  return { db, kat };
}

test('Passwort-Hash prüft korrekt und lehnt Falsches ab', () => {
  const h = hashPasswort('abc-abc-abc-abc');
  assert.equal(pruefePasswort('abc-abc-abc-abc', h), true);
  assert.equal(pruefePasswort('abc-abc-abc-abd', h), false);
  assert.equal(pruefePasswort('x', null), false);
});

test('Anmeldung: Erfolg liefert Sitzung, Falsches wird abgelehnt', () => {
  const ok = anmelden(PASSWORT);
  assert.equal(ok.ok, true);
  assert.equal(sitzungGueltig(ok.token), true);
  assert.equal(anmelden('falsch').grund, 'falsch');
});

test('Nach fünf Fehlversuchen gibt es eine Sperre, auch mit richtigem Passwort', () => {
  for (let i = 0; i < 4; i++) assert.equal(anmelden('falsch').grund, 'falsch');
  assert.equal(anmelden('falsch').grund, 'gesperrt');
  assert.equal(anmelden(PASSWORT).grund, 'gesperrt');
});

test('Ohne Hash ist der Zugang gesperrt und meldet das klar', () => {
  delete process.env.ADMIN_PASSWORD_HASH;
  assert.equal(anmelden(PASSWORT).grund, 'nicht_eingerichtet');
});

test('Material anlegen, ändern und Änderungen werden protokolliert', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat, status: 'veroeffentlicht' });
  aendereMaterial(db, id, { hersteller: 'ACME', name_de: 'Pappel neu' });
  const log = listProtokoll(db);
  assert.ok(log.some(e => e.feld === 'material.name_de' && e.alt === 'Pappel' && e.neu === 'Pappel neu'));
  assert.ok(log.some(e => e.feld === 'material.hersteller' && e.neu === 'ACME'));
});

test('Leerer Name wird abgelehnt, unbekannte Kategorie auch', () => {
  const { db, kat } = neueDb();
  assert.throws(() => anlegenMaterial(db, { name_de: '  ', kategorie_id: kat }), FehlerEingabe);
  assert.throws(() => anlegenMaterial(db, { name_de: 'X', kategorie_id: 999 }), FehlerEingabe);
});

test('Zahlwert mit Einheit, Vermerk und Ablehnung ungültiger Zahlen', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeWert(db, id, 'staerke', { zahl: '4,5', vermerk_de: 'ungeprüft', vermerk_en: 'unverified' });
  const row = db.prepare(`SELECT w.zahl, w.einheit, w.vermerk_de FROM wert w JOIN eigenschaft e ON e.id = w.eigenschaft_id WHERE e.kurzwort='staerke'`).get();
  assert.equal(row.zahl, 4.5);
  assert.equal(row.einheit, 'mm');
  assert.equal(row.vermerk_de, 'ungeprüft');
  assert.throws(() => setzeWert(db, id, 'staerke', { zahl: 'abc' }), FehlerEingabe);
  // ungültige Eingabe löscht nichts
  assert.equal(db.prepare('SELECT COUNT(*) n FROM wert').get().n, 1);
});

test('Leerer Wert löscht den Eintrag; Ja/Nein und Auswahl werden gesetzt', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeWert(db, id, 'wasserfest', { ja_nein: true });
  assert.equal(db.prepare('SELECT ja_nein FROM wert').get().ja_nein, 1);
  const opt = db.prepare('SELECT id FROM eigenschaft_option').get().id;
  setzeWert(db, id, 'brand', { option_id: opt });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM wert').get().n, 2);
  setzeWert(db, id, 'wasserfest', { ja_nein: null });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM wert').get().n, 1);
  assert.throws(() => setzeWert(db, id, 'brand', { option_id: 9999 }), FehlerEingabe);
});

test('Links: https oder http erlaubt, alles andere abgelehnt', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeLinks(db, id, [{ beschriftung: 'Shop', url: 'https://example.org/a' }]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM link').get().n, 1);
  assert.throws(() => setzeLinks(db, id, [{ beschriftung: 'x', url: 'javascript:alert(1)' }]), FehlerEingabe);
  assert.throws(() => setzeLinks(db, id, [{ beschriftung: '', url: 'https://a.b' }]), FehlerEingabe);
});

test('Duplizieren kopiert Werte und Links als Entwurf', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat, status: 'veroeffentlicht' });
  setzeWert(db, id, 'staerke', { zahl: 4 });
  setzeLinks(db, id, [{ beschriftung: 'Shop', url: 'https://a.b' }]);
  const kopie = duplizierMaterial(db, id);
  const row = db.prepare('SELECT status FROM material WHERE id = ?').get(kopie);
  assert.equal(row.status, 'entwurf');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM wert WHERE material_id = ?').get(kopie).n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM link WHERE material_id = ?').get(kopie).n, 1);
});

test('Löschen eines Materials entfernt Werte und Links mit', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeWert(db, id, 'staerke', { zahl: 4 });
  loescheMaterial(db, id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM wert').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM material').get().n, 0);
});

test('Eigenschaft: Kurzwort-Regel, Duplikat und Umbenennen', () => {
  const { db } = neueDb();
  assert.throws(() => anlegenEigenschaft(db, { kurzwort: 'Bad Name', name_de: 'x', typ: 'text' }), FehlerEingabe);
  assert.throws(() => anlegenEigenschaft(db, { kurzwort: 'staerke', name_de: 'x', typ: 'text' }), /schon/);
  const id = anlegenEigenschaft(db, { kurzwort: 'farbe', name_de: 'Farbe', typ: 'text' });
  aendereEigenschaft(db, id, { name_de: 'Farbton', name_en: 'Shade' });
  const e = getAlleEigenschaften(db).find(x => x.id === id);
  assert.equal(e.name.de, 'Farbton');
  assert.equal(e.name.en, 'Shade');
});

test('Eigenschaft löschen verlangt die Anzahl der verlorenen Werte', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeWert(db, id, 'staerke', { zahl: 4 });
  const staerke = db.prepare("SELECT id FROM eigenschaft WHERE kurzwort='staerke'").get().id;
  assert.throws(() => loescheEigenschaft(db, staerke, 0), /verloren/);
  loescheEigenschaft(db, staerke, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM eigenschaft WHERE kurzwort='staerke'").get().n, 0);
});

test('Zusammenführen verschiebt Werte, bei Doppelungen bleibt das Ziel', () => {
  const { db, kat } = neueDb();
  createEigenschaft(db, { kurzwort: 'dicke', name_de: 'Dicke', typ: 'zahl', standard_einheit: 'mm', reihenfolge: 9 });
  const a = anlegenMaterial(db, { name_de: 'A', kategorie_id: kat });
  const b = anlegenMaterial(db, { name_de: 'B', kategorie_id: kat });
  setzeWert(db, a, 'staerke', { zahl: 4 });
  setzeWert(db, b, 'staerke', { zahl: 5 });
  setzeWert(db, a, 'dicke', { zahl: 99 });
  const quelle = db.prepare("SELECT id FROM eigenschaft WHERE kurzwort='staerke'").get().id;
  const ziel = db.prepare("SELECT id FROM eigenschaft WHERE kurzwort='dicke'").get().id;
  fuehreZusammen(db, quelle, ziel);
  const werte = db.prepare('SELECT material_id, zahl FROM wert WHERE eigenschaft_id = ? ORDER BY material_id').all(ziel);
  assert.deepEqual(werte.map(w => w.zahl), [99, 5]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM eigenschaft WHERE kurzwort='staerke'").get().n, 0);
});

test('Kategorie: anlegen mit Icon, ändern, Icon wird geprüft', () => {
  const { db } = neueDb();
  const id = anlegenKategorie(db, { name_de: 'Dämm-Stoffe', icon: 'snowflake' });
  const k = getKategorien(db).find(x => x.id === id);
  assert.equal(k.slug, 'daemm-stoffe');
  assert.equal(k.icon, 'snowflake');
  aendereKategorie(db, id, { icon: 'wind', name_en: 'Insulation' });
  assert.equal(getKategorien(db).find(x => x.id === id).icon, 'wind');
  assert.throws(() => aendereKategorie(db, id, { icon: 'gibt-es-nicht' }), /Icon/);
  // Leeres Icon ergibt das Standard-Icon
  aendereKategorie(db, id, { icon: '' });
  assert.equal(getKategorien(db).find(x => x.id === id).icon, 'circle');
  assert.throws(() => anlegenKategorie(db, { name_de: 'Dämm-Stoffe' }), /schon/);
});

test('Kategorie löschen nur ohne Materialien; Reihenfolge muss vollständig sein', () => {
  const { db, kat } = neueDb();
  const leer = anlegenKategorie(db, { name_de: 'Leer' });
  anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  assert.throws(() => loescheKategorie(db, kat), /verwendet/);
  loescheKategorie(db, leer);
  assert.equal(getKategorien(db).length, 1);
  assert.throws(() => setzeKategorieReihenfolge(db, []), FehlerEingabe);
  setzeKategorieReihenfolge(db, [kat]);
});

test('Alle Icon-Namen haben eine Komponente und bekannte Kategorien ein Standard-Icon', () => {
  const quelle = readFileSync(new URL('../src/shared/CategoryIcon.svelte', import.meta.url), 'utf8');
  for (const name of ICON_NAMEN) assert.ok(quelle.includes(`'${name}'`), `Icon fehlt in CategoryIcon.svelte: ${name}`);
  for (const icon of Object.values(ICON_NACH_SLUG)) assert.ok(ICON_NAMEN.includes(icon), `Vorschlag nicht in der Liste: ${icon}`);
});

test('Migration: Datenbank ohne icon-Spalte bekommt die Spalte und Standard-Icons', () => {
  const pfad = join(tmpdir(), `migration-${Date.now()}.db`);
  const alt = new Database(pfad);
  alt.exec(`CREATE TABLE kategorie (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name_de TEXT NOT NULL, name_en TEXT, reihenfolge INTEGER NOT NULL DEFAULT 0);
    INSERT INTO kategorie (slug, name_de) VALUES ('holz', 'Holz'), ('eigene', 'Eigene');`);
  alt.close();
  const db = openDb(pfad);
  const icons = Object.fromEntries(db.prepare('SELECT slug, icon FROM kategorie').all().map(r => [r.slug, r.icon]));
  assert.equal(icons.holz, 'wood-logs');
  assert.equal(icons.eigene, null);
  db.close();
  rmSync(pfad, { force: true });
  rmSync(`${pfad}-wal`, { force: true });
  rmSync(`${pfad}-shm`, { force: true });
});

test('Migration: frühere Icon-Vorschläge werden einmal ersetzt, spätere Wahl bleibt erhalten', () => {
  const pfad = join(tmpdir(), `migration-icons-${Date.now()}.db`);
  const alt = new Database(pfad);
  alt.exec(`CREATE TABLE kategorie (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name_de TEXT NOT NULL, name_en TEXT, icon TEXT, reihenfolge INTEGER NOT NULL DEFAULT 0);
    INSERT INTO kategorie (slug, name_de, icon) VALUES ('holz', 'Holz', 'mat-holz'), ('metall', 'Metall', 'mat-metall'), ('kunststoff', 'Kunststoff', 'mat-kunststoff'),
      ('schaum-daemmung', 'Schaum', 'gem'), ('verbundplatte', 'Verbundplatte', 'mat-verbund'), ('textil', 'Textil', 'mat-textil'),
      ('staebe-leisten', 'Stäbe', 'mat-staebe'), ('sperrholz', 'Sperrholz', 'mat-sperrholz'), ('eigene', 'Eigene', 'mat-textil');
    PRAGMA user_version = 3;`);
  alt.close();

  // Die farbigen Icons ("mat-…") gibt es nicht mehr: Standard-Symbole, bei fremden Kategorien der Kreis
  let db = openDb(pfad);
  const icon = (slug) => db.prepare('SELECT icon FROM kategorie WHERE slug = ?').get(slug).icon;
  assert.equal(icon('holz'), 'wood-logs');
  assert.equal(icon('metall'), 'metal-beam');
  assert.equal(icon('kunststoff'), 'plastic-bottle');
  assert.equal(icon('verbundplatte'), 'sandwich-panel');
  assert.equal(icon('textil'), 'shirt');
  assert.equal(icon('staebe-leisten'), 'ruler');
  assert.equal(icon('sperrholz'), 'layers');
  assert.equal(icon('schaum-daemmung'), 'gem');     // eigene Wahl bleibt
  assert.equal(icon('eigene'), 'circle');           // Kategorie ohne Vorschlag: neutraler Kreis

  // Wer danach ein anderes Symbol wählt, behält es beim nächsten Start
  db.prepare("UPDATE kategorie SET icon = 'tree-pine' WHERE slug = 'holz'").run();
  db.close();
  db = openDb(pfad);
  assert.equal(icon('holz'), 'tree-pine');
  db.close();

  for (const endung of ['', '-wal', '-shm']) rmSync(`${pfad}${endung}`, { force: true });
});

test('Auswahl-Optionen: setzen und Änderungen protokollieren; Zusammenführen nur gleicher Typen', () => {
  const { db, kat } = neueDb();
  const brand = db.prepare("SELECT id FROM eigenschaft WHERE kurzwort='brand'").get().id;
  setzeOptionen(db, brand, [{ de: 'B1', en: 'B1' }, { de: 'B2' }]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM eigenschaft_option WHERE eigenschaft_id = ?').get(brand).n, 2);
  assert.throws(() => setzeOptionen(db, brand, [{ de: '' }]), FehlerEingabe);
  const staerke = db.prepare("SELECT id FROM eigenschaft WHERE kurzwort='staerke'").get().id;
  assert.throws(() => fuehreZusammen(db, staerke, brand), /gleichen Typs/);
  assert.ok(listProtokoll(db).some(e => e.feld === 'eigenschaft.brand.optionen'));
  void kat;
});
