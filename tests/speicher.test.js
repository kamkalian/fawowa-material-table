import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Speicher, liesVerzeichnis } from '../lib/speicher.js';
import { Git } from '../lib/git.js';
import { neuerSpeicher, tempOrdner } from './hilfen.js';
import { listMaterialien, listEigenschaften, listKategorien } from '../lib/daten.js';
import { anlegenMaterial, aendereMaterial, setzeWert, setzeLinks, setzeOptionen, FehlerEingabe } from '../lib/admin.js';
import { ladeAusRepo, sendeAnRepo, repoStatus } from '../lib/synchronisation.js';

const git = (verzeichnis, ...args) => execFileSync('git', args, { cwd: verzeichnis, encoding: 'utf8' }).trim();

function neuesRemote() {
  const remote = join(tempOrdner('remote-'), 'daten.git');
  execFileSync('git', ['init', '--bare', '-b', 'main', remote]);
  return remote;
}

function materialMitWerten(s, kat) {
  const id = anlegenMaterial(s, { name_de: 'Pappel Sperrholz', kategorie_id: kat, status: 'veroeffentlicht' });
  setzeWert(s, id, 'staerke', { zahl: 4, vermerk_de: 'ungeprüft', vermerk_en: 'unverified' });
  setzeWert(s, id, 'wasserfest', { ja_nein: false });
  setzeWert(s, id, 'brand', { option_id: s.eigenschaft('brand').optionen[0].id });
  setzeLinks(s, id, [{ beschriftung: 'Datenblatt', url: 'https://example.org/blatt' }]);
  return id;
}

// --- Dateien ---

test('Dateien: eine Datei je Material, Auswahl als Text, Kategorie als Kurzname, keine leeren Felder', () => {
  const { s, kat, verzeichnis } = neuerSpeicher();
  const id = materialMitWerten(s, kat);
  const datei = join(verzeichnis, 'materialien', `pappel-sperrholz-${id}.json`);
  assert.ok(existsSync(datei));
  const inhalt = JSON.parse(readFileSync(datei, 'utf8'));
  assert.equal(inhalt.kategorie, 'holz');
  assert.equal(inhalt.id, id);
  assert.deepEqual(inhalt.werte.brand, { option: 'B1' });
  assert.deepEqual(inhalt.werte.staerke, { zahl: 4, einheit: 'mm', vermerk_de: 'ungeprüft', vermerk_en: 'unverified' });
  assert.deepEqual(inhalt.werte.wasserfest, { ja_nein: false });
  assert.equal('hersteller' in inhalt, false);
  assert.deepEqual(readdirSync(join(verzeichnis, 'materialien')), [`pappel-sperrholz-${id}.json`]);
});

test('Dateien: neu geladen ergibt der Speicher genau dieselben Daten', () => {
  const { s, kat, verzeichnis, ordner } = neuerSpeicher();
  const id = materialMitWerten(s, kat);
  aendereMaterial(s, id, { name_de: 'Umbenannt' });     // die Datei behält ihren Namen, die ID bleibt
  const neu = new Speicher({ verzeichnis, lokal: join(ordner, 'lokal') });
  const { fehler } = neu.laden();
  assert.deepEqual(fehler, []);
  assert.deepEqual(listMaterialien(neu, { alle: true }), listMaterialien(s, { alle: true }));
  assert.deepEqual(listEigenschaften(neu), listEigenschaften(s));
  assert.deepEqual(listKategorien(neu), listKategorien(s));
  assert.equal(neu.material(id).datei, `pappel-sperrholz-${id}.json`);
});

test('Dateien: Änderungen sind alles oder nichts, bei einem Fehler bleibt der alte Stand', () => {
  const { s, kat, verzeichnis } = neuerSpeicher({ mitGit: true });
  const id = materialMitWerten(s, kat);
  const vorher = git(verzeichnis, 'rev-parse', 'HEAD');
  assert.throws(() => s.aendere(() => {
    s.material(id).name_de = 'Kaputt';
    s.protokoll('wird nie committet');
    throw new Error('Abbruch');
  }), /Abbruch/);
  assert.equal(s.material(id).name_de, 'Pappel Sperrholz');
  assert.equal(git(verzeichnis, 'rev-parse', 'HEAD'), vorher);
  assert.equal(git(verzeichnis, 'status', '--porcelain'), '');
});

test('Optionen: eine entfernte Auswahl entfernt sie auch aus den Werten, Umbenennen ändert die Dateien', () => {
  const { s, kat, verzeichnis } = neuerSpeicher();
  const id = materialMitWerten(s, kat);
  const brand = s.eigenschaft('brand');
  const optId = brand.optionen[0].id;
  setzeOptionen(s, brand.id, [{ id: optId, de: 'B1 neu' }, { de: 'B2' }]);
  assert.deepEqual(JSON.parse(readFileSync(join(verzeichnis, 'materialien', s.material(id).datei), 'utf8')).werte.brand, { option: 'B1 neu' });
  setzeOptionen(s, brand.id, [{ de: 'B2' }]);
  assert.equal(s.material(id).werte.brand, undefined);
  assert.throws(() => setzeOptionen(s, brand.id, [{ de: 'X' }, { de: 'X' }]), FehlerEingabe);
});

// --- Prüfung beim Laden ---

function dateienSchreiben(verzeichnis, dateien) {
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    mkdirSync(join(verzeichnis, pfad, '..'), { recursive: true });
    writeFileSync(join(verzeichnis, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt));
  }
}

const GRUND = {
  'kategorien.json': [{ id: 1, slug: 'holz', name_de: 'Holz' }],
  'eigenschaften.json': [
    { id: 1, kurzwort: 'staerke', name_de: 'Stärke', typ: 'zahl', standard_einheit: 'mm' },
    { id: 2, kurzwort: 'brand', name_de: 'Brand', typ: 'auswahl', optionen: [{ id: 1, de: 'B1' }] }
  ]
};

test('Prüfung: ein gültiger Satz Dateien wird ohne Fehler gelesen', () => {
  const ordner = tempOrdner();
  dateienSchreiben(ordner, { ...GRUND, 'materialien/a-1.json': { id: 1, name_de: 'A', kategorie: 'holz', status: 'veroeffentlicht', werte: { staerke: { zahl: 4, einheit: 'mm' }, brand: { option: 'B1' } }, links: [{ beschriftung: 'x', url: 'https://example.org' }] } });
  const r = liesVerzeichnis(ordner);
  assert.deepEqual(r.fehler, []);
  assert.equal(r.daten.materialien.length, 1);
  assert.equal(r.daten.materialien[0].werte.brand.option_id, 1);
});

test('Prüfung: jeder Fehler nennt Datei und Problem', () => {
  const ordner = tempOrdner();
  const gut = { name_de: 'A', kategorie: 'holz' };
  dateienSchreiben(ordner, {
    ...GRUND,
    'materialien/kaputt-1.json': '{ kein json',
    'materialien/ohne-name-2.json': { kategorie: 'holz' },
    'materialien/kategorie-3.json': { name_de: 'B', kategorie: 'gibtsnicht' },
    'materialien/eigenschaft-4.json': { ...gut, id: 4, werte: { gibtsnicht: { zahl: 1 } } },
    'materialien/typ-5.json': { ...gut, id: 5, werte: { staerke: { zahl: 'viel' } } },
    'materialien/falsches-feld-6.json': { ...gut, id: 6, werte: { staerke: { text: 'x' } } },
    'materialien/option-7.json': { ...gut, id: 7, werte: { brand: { option: 'B9' } } },
    'materialien/link-8.json': { ...gut, id: 8, links: [{ beschriftung: 'x', url: 'javascript:alert(1)' }] },
    'materialien/status-9.json': { ...gut, id: 9, status: 'geheim' },
    'materialien/doppelt-10.json': { ...gut, id: 10 },
    'materialien/doppelt-11.json': { ...gut, id: 10 },
    'materialien/readme.txt': 'hallo'
  });
  const { fehler } = liesVerzeichnis(ordner);
  const text = (datei) => fehler.filter(f => f.datei === `materialien/${datei}`).map(f => f.text).join(' | ');
  assert.match(text('kaputt-1.json'), /Kein gültiges JSON/);
  assert.match(text('ohne-name-2.json'), /name_de/);
  assert.match(text('kategorie-3.json'), /Kategorie „gibtsnicht“/);
  assert.match(text('eigenschaft-4.json'), /„gibtsnicht“: diese Eigenschaft gibt es nicht/);
  assert.match(text('typ-5.json'), /muss eine Zahl sein/);
  assert.match(text('falsches-feld-6.json'), /passt nicht zum Typ zahl/);
  assert.match(text('option-7.json'), /„B9“ gibt es bei dieser Eigenschaft nicht/);
  assert.match(text('link-8.json'), /Link braucht/);
  assert.match(text('status-9.json'), /status/);
  assert.match(text('doppelt-11.json'), /ID 10 kommt doppelt vor/);
  assert.match(text('readme.txt'), /Nur .json/);
});

test('Prüfung: fehlende IDs werden vergeben und das Ergebnis wird committet', () => {
  const ordner = tempOrdner();
  const verzeichnis = join(ordner, 'repo');
  const g = new Git({ verzeichnis });
  g.bereitstellen();
  dateienSchreiben(verzeichnis, { ...GRUND, 'materialien/von-hand.json': { name_de: 'Von Hand', kategorie: 'holz', werte: { staerke: { zahl: 3 } } } });
  const s = new Speicher({ verzeichnis, git: g, lokal: join(ordner, 'lokal') });
  const { fehler, ergaenzt } = s.laden();
  assert.deepEqual(fehler, []);
  assert.equal(ergaenzt, true);
  assert.equal(s.materialien[0].id, 1);
  assert.equal(JSON.parse(readFileSync(join(verzeichnis, 'materialien', 'von-hand.json'), 'utf8')).id, 1);
  assert.equal(g.verlauf(1)[0].betreff, 'IDs ergänzt');
});

test('Fehlerhafte Dateien sperren das Schreiben, damit nichts überschrieben oder gelöscht wird', () => {
  const ordner = tempOrdner();
  const verzeichnis = join(ordner, 'repo');
  dateienSchreiben(verzeichnis, { ...GRUND, 'materialien/gut-1.json': { id: 1, name_de: 'Gut', kategorie: 'holz' }, 'materialien/kaputt-2.json': '{ kein json' });
  const s = new Speicher({ verzeichnis, lokal: join(ordner, 'lokal') });
  assert.equal(s.laden().fehler.length, 1);
  assert.throws(() => aendereMaterial(s, 1, { hersteller: 'X' }), /gesperrt/);
  assert.equal(readFileSync(join(verzeichnis, 'materialien', 'kaputt-2.json'), 'utf8'), '{ kein json');
});

// --- Git ---

test('Git: jede Änderung ist ein Commit mit lesbarem Text, mehrere Zeilen landen im Textkörper', () => {
  const { s, kat } = neuerSpeicher({ mitGit: true });
  const id = anlegenMaterial(s, { name_de: 'Pappel', kategorie_id: kat });
  aendereMaterial(s, id, { hersteller: 'ACME', name_en: 'Poplar' });
  const [letzter, vorletzter] = s.git.verlauf(2);
  assert.match(letzter.betreff, /^Material »Pappel«: name_en – → Poplar \(und 1 weitere\)$/);
  assert.match(letzter.text, /hersteller – → ACME/);
  assert.equal(vorletzter.betreff, 'Material »Pappel« angelegt');
  assert.equal(s.git.status().ahead, 0);
});

test('Git: Änderungen werden an das Repo gesendet; ein zweiter Server kann sie klonen', async () => {
  const remote = neuesRemote();
  const { s, kat } = neuerSpeicher({ mitGit: true, remote });
  materialMitWerten(s, kat);
  assert.ok(s.git.status().ahead > 0);
  const r = await s.git.senden();
  assert.equal(r.ok, true);
  assert.equal(s.git.status().ahead, 0);

  const ordner = tempOrdner();
  const zweiter = new Git({ verzeichnis: join(ordner, 'repo'), remote });
  zweiter.bereitstellen();                 // leeres Verzeichnis + Remote = klonen
  const kopie = new Speicher({ verzeichnis: join(ordner, 'repo'), git: zweiter, lokal: join(ordner, 'lokal') });
  assert.deepEqual(kopie.laden().fehler, []);
  assert.deepEqual(listMaterialien(kopie, { alle: true }), listMaterialien(s, { alle: true }));
});

test('Abgleich: neue Commits aus dem Repo werden geladen und geprüft', async () => {
  const remote = neuesRemote();
  const { s, kat } = neuerSpeicher({ mitGit: true, remote });
  materialMitWerten(s, kat);
  await s.git.senden();

  // Jemand ändert das Repo direkt: neues Material von Hand
  const arbeit = join(tempOrdner('arbeit-'), 'repo');
  execFileSync('git', ['clone', '-q', remote, arbeit]);
  writeFileSync(join(arbeit, 'materialien', 'birke.json'), JSON.stringify({ name_de: 'Birke', kategorie: 'holz', status: 'veroeffentlicht', werte: { staerke: { zahl: 6, einheit: 'mm' } } }));
  git(arbeit, '-c', 'user.name=Test', '-c', 'user.email=t@t', 'add', '-A');
  git(arbeit, '-c', 'user.name=Test', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'Birke von Hand');
  git(arbeit, 'push', '-q', 'origin', 'main');

  assert.equal((await ladeAusRepo(s)).ergebnis, 'geladen');
  const birke = s.materialien.find(m => m.name_de === 'Birke');
  assert.ok(birke.id > 0, 'die fehlende ID wurde vergeben');
  assert.equal(birke.werte.staerke.zahl, 6);
  assert.equal((await ladeAusRepo(s)).ergebnis, 'aktuell');
  // die vergebene ID ist nach dem Laden schon committet und wird gesendet
  assert.equal(s.git.verlauf(1)[0].betreff, 'IDs ergänzt');
  assert.equal((await sendeAnRepo(s)).ahead, 0);
});

test('Abgleich: fehlerhafte Dateien im Repo werden nicht übernommen, der alte Stand bleibt aktiv', async () => {
  const remote = neuesRemote();
  const { s, kat, verzeichnis } = neuerSpeicher({ mitGit: true, remote });
  const id = materialMitWerten(s, kat);
  await s.git.senden();
  const kopf = git(verzeichnis, 'rev-parse', 'HEAD');

  const arbeit = join(tempOrdner('arbeit-'), 'repo');
  execFileSync('git', ['clone', '-q', remote, arbeit]);
  writeFileSync(join(arbeit, 'materialien', 'schlecht.json'), JSON.stringify({ name_de: 'Schlecht', kategorie: 'gibtsnicht' }));
  git(arbeit, '-c', 'user.name=Test', '-c', 'user.email=t@t', 'add', '-A');
  git(arbeit, '-c', 'user.name=Test', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'Fehler');
  git(arbeit, 'push', '-q', 'origin', 'main');

  await assert.rejects(ladeAusRepo(s), (e) => {
    assert.ok(e instanceof FehlerEingabe);
    assert.equal(e.status, 422);
    assert.match(e.details[0].text, /Kategorie „gibtsnicht“/);
    return true;
  });
  assert.equal(git(verzeichnis, 'rev-parse', 'HEAD'), kopf);
  assert.ok(!existsSync(join(verzeichnis, 'materialien', 'schlecht.json')));
  assert.equal(s.materialien.length, 1);
  assert.equal(s.material(id).name_de, 'Pappel Sperrholz');
  assert.equal(repoStatus(s).behind, 1);          // der Abstand bleibt sichtbar
});

test('Abgleich: gleichzeitige Änderungen hier und im Repo werden nicht automatisch zusammengeführt', async () => {
  const remote = neuesRemote();
  const { s, kat } = neuerSpeicher({ mitGit: true, remote });
  materialMitWerten(s, kat);
  await s.git.senden();

  const arbeit = join(tempOrdner('arbeit-'), 'repo');
  execFileSync('git', ['clone', '-q', remote, arbeit]);
  writeFileSync(join(arbeit, 'notiz.txt'), 'x');
  git(arbeit, '-c', 'user.name=Test', '-c', 'user.email=t@t', 'add', '-A');
  git(arbeit, '-c', 'user.name=Test', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'Im Repo');
  git(arbeit, 'push', '-q', 'origin', 'main');

  anlegenMaterial(s, { name_de: 'Lokal neu', kategorie_id: kat });            // lokal ebenfalls etwas Neues
  await assert.rejects(ladeAusRepo(s), /nicht automatisch zusammenführen/);
  const r = await s.git.senden();                                              // und senden wird abgelehnt
  assert.equal(r.ok, false);
  assert.match(s.git.pushFehler, /Aus dem Repo laden/);
});

test('Abgleich ohne Repo meldet das klar', async () => {
  const { s } = neuerSpeicher({ mitGit: true });
  await assert.rejects(ladeAusRepo(s), /kein Repository/i);
});
