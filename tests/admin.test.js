import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { neuerSpeicher } from './hilfen.js';
import { serialisiere } from '../lib/speicher.js';
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
  const { s, kat } = neuerSpeicher({ mitGit: true });
  return { db: s, kat };
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

test('Material anlegen, ändern und jede Änderung wird als Commit protokolliert', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat, status: 'veroeffentlicht' });
  aendereMaterial(db, id, { hersteller: 'ACME', name_de: 'Pappel neu' });
  const log = listProtokoll(db);
  assert.ok(log[0].betreff.startsWith('Material »Pappel«: name_de Pappel → Pappel neu'), log[0].betreff);
  assert.ok(log[0].text.includes('hersteller – → ACME'));
  assert.ok(log.some(e => e.betreff === 'Material »Pappel« angelegt'));
  assert.equal(db.git.status().ahead, 0);   // ohne Remote gibt es keinen Abstand
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
  const w = db.material(id).werte.staerke;
  assert.equal(w.zahl, 4.5);
  assert.equal(w.einheit, 'mm');
  assert.equal(w.vermerk_de, 'ungeprüft');
  assert.throws(() => setzeWert(db, id, 'staerke', { zahl: 'abc' }), FehlerEingabe);
  // ungültige Eingabe löscht nichts
  assert.equal(Object.keys(db.material(id).werte).length, 1);
});

test('Leerer Wert löscht den Eintrag; Ja/Nein und Auswahl werden gesetzt', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeWert(db, id, 'wasserfest', { ja_nein: true });
  assert.equal(db.material(id).werte.wasserfest.ja_nein, true);
  const opt = db.eigenschaft('brand').optionen[0].id;
  setzeWert(db, id, 'brand', { option_id: opt });
  assert.equal(Object.keys(db.material(id).werte).length, 2);
  setzeWert(db, id, 'wasserfest', { ja_nein: null });
  assert.equal(Object.keys(db.material(id).werte).length, 1);
  assert.throws(() => setzeWert(db, id, 'brand', { option_id: 9999 }), FehlerEingabe);
});

test('Links: https oder http erlaubt, alles andere abgelehnt', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeLinks(db, id, [{ beschriftung: 'Shop', url: 'https://example.org/a' }]);
  assert.equal(db.material(id).links.length, 1);
  assert.throws(() => setzeLinks(db, id, [{ beschriftung: 'x', url: 'javascript:alert(1)' }]), FehlerEingabe);
  assert.throws(() => setzeLinks(db, id, [{ beschriftung: '', url: 'https://a.b' }]), FehlerEingabe);
});

test('Duplizieren kopiert Werte und Links als Entwurf', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat, status: 'veroeffentlicht' });
  setzeWert(db, id, 'staerke', { zahl: 4 });
  setzeLinks(db, id, [{ beschriftung: 'Shop', url: 'https://a.b' }]);
  const kopie = duplizierMaterial(db, id);
  const k = db.material(kopie);
  assert.equal(k.status, 'entwurf');
  assert.equal(Object.keys(k.werte).length, 1);
  assert.equal(k.links.length, 1);
  assert.notEqual(k.datei, db.material(id).datei);
  // die Kopie ist unabhängig vom Original
  setzeWert(db, kopie, 'staerke', { zahl: 99 });
  assert.equal(db.material(id).werte.staerke.zahl, 4);
});

test('Löschen eines Materials entfernt Werte und Links mit', () => {
  const { db, kat } = neueDb();
  const id = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat });
  setzeWert(db, id, 'staerke', { zahl: 4 });
  loescheMaterial(db, id);
  assert.equal(db.materialien.length, 0);
  assert.ok(!existsSync(join(db.verzeichnis, 'materialien', `pappel-${id}.json`)), 'die Datei ist gelöscht');
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
  const staerke = db.eigenschaft('staerke').id;
  assert.throws(() => loescheEigenschaft(db, staerke, 0), /verloren/);
  loescheEigenschaft(db, staerke, 1);
  assert.equal(db.eigenschaft('staerke'), null);
  assert.deepEqual(db.material(id).werte, {});
});

test('Zusammenführen verschiebt Werte, bei Doppelungen bleibt das Ziel', () => {
  const { db, kat } = neueDb();
  anlegenEigenschaft(db, { kurzwort: 'dicke', name_de: 'Dicke', typ: 'zahl', standard_einheit: 'mm' });
  const a = anlegenMaterial(db, { name_de: 'A', kategorie_id: kat });
  const b = anlegenMaterial(db, { name_de: 'B', kategorie_id: kat });
  setzeWert(db, a, 'staerke', { zahl: 4 });
  setzeWert(db, b, 'staerke', { zahl: 5 });
  setzeWert(db, a, 'dicke', { zahl: 99 });
  fuehreZusammen(db, db.eigenschaft('staerke').id, db.eigenschaft('dicke').id);
  assert.deepEqual([db.material(a).werte.dicke.zahl, db.material(b).werte.dicke.zahl], [99, 5]);
  assert.equal(db.eigenschaft('staerke'), null);
});

test('Kategorie: anlegen mit Icon, ändern, Icon wird geprüft', () => {
  const { db } = neueDb();
  const id = anlegenKategorie(db, { name_de: 'Dämm-Stoffe', icon: 'foam-bubbles' });
  const k = getKategorien(db).find(x => x.id === id);
  assert.equal(k.slug, 'daemm-stoffe');
  assert.equal(k.icon, 'foam-bubbles');
  aendereKategorie(db, id, { icon: 'tree-rings', name_en: 'Insulation' });
  assert.equal(getKategorien(db).find(x => x.id === id).icon, 'tree-rings');
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
  const quelle = readFileSync(new URL('../src/shared/Icon.svelte', import.meta.url), 'utf8');
  for (const name of ICON_NAMEN) assert.ok(quelle.includes(`'${name}'`), `Icon fehlt in Icon.svelte: ${name}`);
  // Alle Kategorie-Icons sind selbst gezeichnet: keine Bibliothek im Icon-Baustein
  assert.ok(!/lucide/i.test(quelle), 'CategoryIcon.svelte darf keine Icon-Bibliothek einbinden');
  for (const icon of Object.values(ICON_NACH_SLUG)) assert.ok(ICON_NAMEN.includes(icon), `Vorschlag nicht in der Liste: ${icon}`);
});


test('Mehrfachauswahl: mehrere Auswahlen je Wert, Datei mit Liste, Umschalten nur ohne Mehrfachwerte', () => {
  const { db, kat } = neueDb();
  const e = anlegenEigenschaft(db, { kurzwort: 'material', name_de: 'Material', typ: 'auswahl', mehrfach: true });
  setzeOptionen(db, e, [{ de: 'GFK' }, { de: 'Schaum' }, { de: 'Holz' }]);
  const [gfk, schaum, holz] = db.eigenschaft('material').optionen.map(o => o.id);
  const id = anlegenMaterial(db, { name_de: 'Verbund', kategorie_id: kat });

  setzeWert(db, id, 'material', { option_ids: [gfk, schaum, gfk] });
  assert.deepEqual(db.material(id).werte.material.option_ids, [gfk, schaum]);
  assert.throws(() => setzeWert(db, id, 'material', { option_ids: [9999] }), FehlerEingabe);

  // Entfernt man eine Option, bleibt der Rest erhalten
  setzeOptionen(db, e, [{ id: gfk, de: 'GFK' }, { id: holz, de: 'Holz' }]);
  assert.deepEqual(db.material(id).werte.material.option_ids, [gfk]);
  setzeWert(db, id, 'material', { option_ids: [gfk, holz] });

  // Schreiben und wieder lesen
  const dateien = serialisiere(db);
  const datei = JSON.parse([...dateien].find(([p]) => p.startsWith('materialien/'))[1]);
  assert.deepEqual(datei.werte.material, { optionen: ['GFK', 'Holz'] });

  // Bei einfachen Auswahlen sind mehrere nicht erlaubt; zurückstellen geht erst mit höchstens einer
  assert.throws(() => setzeWert(db, id, 'brand', { option_ids: [1, 2] }), FehlerEingabe);
  assert.throws(() => aendereEigenschaft(db, e, { mehrfach: false }), FehlerEingabe);
  setzeWert(db, id, 'material', { option_ids: [holz] });
  aendereEigenschaft(db, e, { mehrfach: false });
  assert.equal(db.eigenschaft('material').mehrfach, false);
  assert.throws(() => aendereEigenschaft(db, db.eigenschaft('wasserfest').id, { mehrfach: true }), FehlerEingabe);
});
