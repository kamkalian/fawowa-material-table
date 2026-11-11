import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, buildSearch, emptyState } from '../src/public/lib/url.js';
import {
  filterMaterials, sortMaterials, filterLabel, gruppiere, alsEinzelne, gruppenWert, gruppenHatVermerk, gruppenSchluessel
} from '../src/public/lib/filter.js';

const props = [
  { kurzwort: 'staerke', name: { de: 'Stärke', en: 'Thickness' }, typ: 'zahl', einheit: 'mm', filterbar: true, standardSichtbar: true, reihenfolge: 1 },
  { kurzwort: 'gewicht', name: { de: 'Flächengewicht', en: 'Area weight' }, typ: 'zahl', einheit: 'kg/m²', filterbar: true, standardSichtbar: true, reihenfolge: 2 },
  { kurzwort: 'waermewert', name: { de: 'Wärmewert', en: 'Thermal value' }, typ: 'zahl', einheit: 'W/(m·K)', filterbar: true, standardSichtbar: true, reihenfolge: 3 },
  { kurzwort: 'wasserfest', name: { de: 'Wasserfest', en: 'Waterproof' }, typ: 'ja_nein', einheit: null, filterbar: true, standardSichtbar: false, reihenfolge: 4 },
  { kurzwort: 'brand', name: { de: 'Brandklasse', en: 'Fire class' }, typ: 'auswahl', einheit: null, filterbar: true, standardSichtbar: false, reihenfolge: 5,
    optionen: [{ id: 7, de: 'B1', en: 'B1' }, { id: 8, de: 'B2', en: 'B2' }] },
  { kurzwort: 'bemerkung', name: { de: 'Bemerkung', en: 'Remark' }, typ: 'text', einheit: null, filterbar: true, standardSichtbar: false, reihenfolge: 6 },
  { kurzwort: 'intern', name: { de: 'Intern', en: 'Internal' }, typ: 'text', einheit: null, filterbar: false, standardSichtbar: false, reihenfolge: 7 }
];

const materials = [
  { id: 1, name: { de: 'Sperrholz Birke', en: 'Birch plywood' }, hersteller: 'A', kategorie: { slug: 'sperrholz', name: { de: 'Sperrholz', en: 'Plywood' } },
    werte: { staerke: { wert: 4, einheit: 'mm' }, gewicht: { wert: 2.5, einheit: 'kg/m²' }, wasserfest: { wert: true }, brand: { wert: { de: 'B1', en: 'B1' }, optionId: 7 } } },
  { id: 2, name: { de: 'Sperrholz Kiefer', en: 'Sperrholz Kiefer' }, hersteller: null, kategorie: { slug: 'sperrholz', name: { de: 'Sperrholz', en: 'Plywood' } },
    werte: { staerke: { wert: 10, einheit: 'mm' }, gewicht: { wert: 6, einheit: 'kg/m²' }, wasserfest: { wert: false }, brand: { wert: { de: 'B2', en: 'B2' }, optionId: 8 } } },
  { id: 3, name: { de: 'Schaum', en: null }, hersteller: null, kategorie: { slug: 'schaum', name: { de: 'Schaum', en: 'Foam' } },
    werte: { staerke: { wert: 20, einheit: 'mm' }, gewicht: { wert: 0.3, einheit: 'kg/m²' }, waermewert: { wert: 0.04, einheit: 'W/(m·K)' }, bemerkung: { wert: 'Testhinweis' } } },
  { id: 4, name: { de: 'Wabe', en: null }, hersteller: null, kategorie: { slug: 'schaum', name: { de: 'Schaum', en: 'Foam' } },
    werte: { staerke: { wert: 8, einheit: 'mm' }, waermewert: { wert: 3.3, einheit: 'W/(m²K)' } } }
];

test('leere Adresse ergibt Standardzustand', () => {
  const { state, fehler } = parseSearch('', props);
  assert.deepEqual(fehler, []);
  assert.equal(state.q, '');
  assert.deepEqual(state.filters, []);
  assert.equal(state.sort, null);
  assert.equal(state.cols, null);
  assert.equal(state.lang, 'de');
});

test('Beispiel aus dem Plan wird gelesen und wieder geschrieben', () => {
  const url = '?q=sperrholz&f=gewicht:bis:3&f=staerke:4..10&f=wasserfest:ja&sort=-gewicht&cols=staerke,gewicht,waermewert&lang=en&m=2';
  const { state, fehler } = parseSearch(url, props);
  assert.deepEqual(fehler, []);
  assert.equal(state.q, 'sperrholz');
  assert.equal(state.filters.length, 3);
  assert.deepEqual(state.sort, { key: 'gewicht', dir: 'desc' });
  assert.deepEqual(state.cols, ['staerke', 'gewicht', 'waermewert']);
  assert.equal(state.lang, 'en');
  assert.equal(state.m, 2);
  assert.equal(buildSearch(state, props), url);
});

test('Adresse lässt sich mit Sonderzeichen im Text wieder lesen', () => {
  const state = { ...emptyState(), filters: [{ kw: 'bemerkung', op: 'enthaelt', text: 'a&b c:d' }] };
  const url = buildSearch(state, props);
  assert.deepEqual(parseSearch(url, props).state.filters, state.filters);
});

test('Filter-Formate: bis, ab, ist, von..bis, enthält, Auswahl, ja/nein', () => {
  const f = (s) => parseSearch(`?f=${s}`, props).state.filters[0];
  assert.deepEqual(f('gewicht:ab:2'), { kw: 'gewicht', op: 'ab', a: 2, unit: 'kg/m²' });
  assert.deepEqual(f('gewicht:ist:2.5'), { kw: 'gewicht', op: 'ist', a: 2.5, unit: 'kg/m²' });
  assert.deepEqual(f('staerke:4..10'), { kw: 'staerke', op: 'von', a: 4, b: 10, unit: 'mm' });
  assert.deepEqual(f('bemerkung:enthaelt:a:b'), { kw: 'bemerkung', op: 'enthaelt', text: 'a:b' });
  assert.deepEqual(f('brand:in:7,8'), { kw: 'brand', op: 'in', ids: [7, 8] });
  assert.deepEqual(f('wasserfest:nein'), { kw: 'wasserfest', op: 'nein', ja: false });
});

test('Einheit im Filter wird übernommen und in der Adresse nur bei Abweichung geschrieben', () => {
  const { state } = parseSearch('?f=waermewert:bis:0.05:W/(m²K)', props);
  assert.equal(state.filters[0].unit, 'W/(m²K)');
  const { state: s2 } = parseSearch('?f=waermewert:bis:0.05', props);
  assert.equal(buildSearch(s2, props), '?f=waermewert:bis:0.05&lang=de');
});

test('Ungültige oder unbekannte Teile werden ignoriert und gemeldet', () => {
  const { state, fehler } = parseSearch('?f=unbekannt:bis:3&f=staerke:bis:abc&f=intern:enthaelt:x&f=staerke:10..4&sort=quatsch&cols=gewicht,nope&f=brand:in:99', props);
  assert.deepEqual(state.filters, []);
  assert.equal(state.cols.join(','), 'gewicht');
  assert.equal(fehler.length, 7);
});

test('Komma als Dezimaltrenner in der Adresse wird akzeptiert', () => {
  const { state } = parseSearch('?f=gewicht:bis:2,5', props);
  assert.equal(state.filters[0].a, 2.5);
});

test('Suche trifft Name (de und en) und Hersteller, ohne Groß-/Kleinschreibung', () => {
  const r = (q) => filterMaterials(materials, { ...emptyState(), q }).map(m => m.id);
  assert.deepEqual(r('BIRCH'), [1]);
  assert.deepEqual(r('a'), [1, 3, 4]);
  assert.deepEqual(r('sperrholz'), [1, 2]);
});

test('Kategorien: aus der Adresse lesen, filtern, wieder schreiben', () => {
  const { state, fehler } = parseSearch('?cat=sperrholz,schaum&lang=de', props, ['sperrholz', 'schaum', 'metall']);
  assert.deepEqual(fehler, []);
  assert.deepEqual(state.cats, ['sperrholz']); // nur die erste Kategorie
  assert.equal(buildSearch(state, props), '?cat=sperrholz&lang=de'); // nur eine Kategorie

  const ids = (cats, q = '') => filterMaterials(materials, { ...emptyState(), cats, q }).map(m => m.id);
  assert.deepEqual(ids([]), [1, 2, 3, 4]);          // keine Auswahl: alle
  assert.deepEqual(ids(['sperrholz']), [1, 2]);
  assert.deepEqual(ids(['sperrholz', 'schaum']), [1, 2, 3, 4]);
  assert.deepEqual(ids(['schaum'], 'wabe'), [4]);   // zusammen mit der Suche
  assert.deepEqual(ids(['metall']), []);            // Kategorie ohne Treffer
});

test('Kategorien: unbekannte Kurznamen werden ignoriert und doppelte zusammengefasst', () => {
  const { state, fehler } = parseSearch('?cat=holz,gibtsnicht,holz', props, ['holz', 'metall']);
  assert.deepEqual(state.cats, ['holz']);
  assert.deepEqual(fehler, ['cat=gibtsnicht']);
  // Ohne Liste bekannter Kategorien wird nichts verworfen
  assert.deepEqual(parseSearch('?cat=irgendwas', props).state.cats, ['irgendwas']);
});

test('Zahlenfilter berücksichtigt nur Werte in der gewählten Einheit', () => {
  const st = (filters) => ({ ...emptyState(), filters });
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'waermewert', op: 'bis', a: 0.05, unit: 'W/(m·K)' }])).map(m => m.id), [3]);
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'waermewert', op: 'bis', a: 0.05, unit: 'W/(m²K)' }])).map(m => m.id), []);
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'staerke', op: 'von', a: 4, b: 10, unit: 'mm' }])).map(m => m.id), [1, 2, 4]);
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'gewicht', op: 'ab', a: 2, unit: 'kg/m²' }])).map(m => m.id), [1, 2]);
});

test('Ja/Nein, Auswahl und Text filtern richtig; fehlende Werte fallen raus', () => {
  const st = (filters) => ({ ...emptyState(), filters });
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'wasserfest', op: 'nein', ja: false }])).map(m => m.id), [2]);
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'brand', op: 'in', ids: [8] }])).map(m => m.id), [2]);
  assert.deepEqual(filterMaterials(materials, st([{ kw: 'bemerkung', op: 'enthaelt', text: 'TEST' }])).map(m => m.id), [3]);
});

test('Sortierung: leere Werte immer am Ende, auch absteigend', () => {
  const asc = sortMaterials(materials, { key: 'gewicht', dir: 'asc' }, props, 'de').map(m => m.id);
  const desc = sortMaterials(materials, { key: 'gewicht', dir: 'desc' }, props, 'de').map(m => m.id);
  assert.deepEqual(asc, [3, 1, 2, 4]);
  assert.deepEqual(desc, [2, 1, 3, 4]);
});

test('Sortierung nach Name ist numerisch aufsteigend und nicht veränderlich', () => {
  const input = [...materials];
  const out = sortMaterials(input, { key: 'name', dir: 'asc' }, props, 'de');
  assert.equal(input[0].id, 1);
  assert.equal(out.length, 4);
});

test('Chip-Beschreibung nennt Name, Bedingung, Wert und Einheit', () => {
  const prop = props.find(p => p.kurzwort === 'gewicht');
  assert.equal(filterLabel({ kw: 'gewicht', op: 'bis', a: 3, unit: 'kg/m²' }, prop, 'de'), 'Flächengewicht höchstens 3 kg/m²');
  assert.equal(filterLabel({ kw: 'gewicht', op: 'von', a: 1, b: 2.5, unit: 'kg/m²' }, prop, 'en'), 'Area weight 1–2.5 kg/m²');
});

// --- Gruppieren gleichnamiger Materialien ---

const kat = (slug) => ({ slug, icon: null, name: { de: slug, en: slug } });
const mat = (id, name, slug, werte = {}) => ({ id, name: { de: name, en: null }, hersteller: null, kategorie: kat(slug), werte });
const zahl = (wert, einheit, vermerk = null) => ({ wert, einheit, vermerk });

test('Gruppieren: gleiche Namen (ohne Groß-/Kleinschreibung und doppelte Leerzeichen) werden zusammengefasst', () => {
  const rows = [
    mat(1, 'Pappelsperrholz', 'holz'), mat(2, 'Kiefer', 'holz'),
    mat(3, 'pappelsperrholz', 'holz'), mat(4, ' Pappel  Sperrholz ', 'holz'), mat(5, 'PAPPELSPERRHOLZ ', 'holz')
  ];
  const items = gruppiere(rows);
  assert.equal(items.length, 3);                          // Pappelsperrholz (3), Kiefer, "Pappel Sperrholz"
  assert.equal(items[0].typ, 'gruppe');
  assert.deepEqual(items[0].mitglieder.map(m => m.id), [1, 3, 5]);
  assert.equal(items[1].typ, 'einzel');
  assert.equal(items[1].material.id, 2);
  assert.equal(items[2].material.id, 4);                  // anderer Name wegen Leerzeichen mitten im Wort
});

test('Gruppieren: die Gruppe steht an der Stelle ihres ersten Mitglieds, die Reihenfolge der Mitglieder bleibt', () => {
  const rows = [mat(1, 'Kiefer', 'holz'), mat(2, 'Birke', 'holz'), mat(3, 'Kiefer', 'holz'), mat(4, 'Birke', 'holz')];
  const items = gruppiere(rows);
  assert.deepEqual(items.map(i => i.key ?? i.material.id), ['holz|kiefer', 'holz|birke']);
  assert.deepEqual(items[1].mitglieder.map(m => m.id), [2, 4]);
});

test('Gruppieren: gleicher Name in verschiedenen Kategorien bleibt getrennt; ohne Gruppierung alles einzeln', () => {
  const rows = [mat(1, 'Platte', 'holz'), mat(2, 'Platte', 'metall')];
  assert.deepEqual(gruppiere(rows).map(i => i.typ), ['einzel', 'einzel']);
  assert.notEqual(gruppenSchluessel(rows[0]), gruppenSchluessel(rows[1]));
  const einzeln = alsEinzelne([mat(1, 'A', 'holz'), mat(2, 'A', 'holz')]);
  assert.deepEqual(einzeln.map(i => i.typ), ['einzel', 'einzel']);
  assert.deepEqual(gruppiere([]), []);
});

test('Gruppenzeile: Zahlen als Bereich, gleiche Werte einzeln, verschiedene Einheiten und Abweichungen als …', () => {
  const stark = props.find(p => p.kurzwort === 'staerke');
  const wasser = props.find(p => p.kurzwort === 'wasserfest');
  const gruppe = [
    mat(1, 'X', 'holz', { staerke: zahl(4, 'mm'), gewicht: zahl(2, 'kg/m²'), wasserfest: { wert: true } }),
    mat(2, 'X', 'holz', { staerke: zahl(10, 'mm'), gewicht: zahl(2, 'kg/m²'), wasserfest: { wert: true } }),
    mat(3, 'X', 'holz', { staerke: zahl(6.5, 'mm'), gewicht: zahl(3, 'g/cm²'), wasserfest: { wert: false } })
  ];
  assert.equal(gruppenWert(stark, gruppe, 'de'), '4–10 mm');
  assert.equal(gruppenWert(stark, gruppe, 'en'), '4–10 mm');
  assert.equal(gruppenWert(stark, [gruppe[0], gruppe[0]], 'de'), '4 mm');
  assert.equal(gruppenWert(props.find(p => p.kurzwort === 'gewicht'), gruppe, 'de'), '…');   // verschiedene Einheiten
  assert.equal(gruppenWert(wasser, gruppe, 'de'), '…');                                        // nicht einheitlich
  assert.equal(gruppenWert(wasser, gruppe.slice(0, 2), 'de'), 'ja');
  assert.equal(gruppenWert(props.find(p => p.kurzwort === 'waermewert'), gruppe, 'de'), null); // kein Mitglied hat einen Wert
  assert.equal(gruppenWert(stark, [mat(1, 'X', 'holz', { staerke: zahl(1234.5, 'mm') }), mat(2, 'X', 'holz', { staerke: zahl(2000, 'mm') })], 'de'), '1.234,5–2.000 mm');
});

test('Gruppenzeile: Zahlen mit Wert nur bei einem Teil der Mitglieder zeigen trotzdem den Bereich, Text nur bei Übereinstimmung aller', () => {
  const stark = props.find(p => p.kurzwort === 'staerke');
  const wasser = props.find(p => p.kurzwort === 'wasserfest');
  const gruppe = [mat(1, 'X', 'holz', { staerke: zahl(4, 'mm'), wasserfest: { wert: true } }), mat(2, 'X', 'holz', {})];
  assert.equal(gruppenWert(stark, gruppe, 'de'), '4 mm');
  assert.equal(gruppenWert(wasser, gruppe, 'de'), '…');
});

test('Gruppenzeile: Vermerk "ungeprüft" eines Mitglieds wird erkannt', () => {
  const stark = props.find(p => p.kurzwort === 'staerke');
  const mit = [mat(1, 'X', 'holz', { staerke: zahl(4, 'mm') }), mat(2, 'X', 'holz', { staerke: zahl(5, 'mm', { de: 'ungeprüft' }) })];
  assert.equal(gruppenHatVermerk(stark, mit), true);
  assert.equal(gruppenHatVermerk(stark, [mit[0]]), false);
});

test('Adresse: flat=1 schaltet die Gruppierung aus und wird wieder geschrieben, Standard ist gruppiert', () => {
  assert.equal(parseSearch('', props).state.flat, false);
  const { state } = parseSearch('?flat=1&lang=de', props);
  assert.equal(state.flat, true);
  assert.equal(buildSearch(state, props), '?flat=1&lang=de');
  assert.equal(buildSearch({ ...state, flat: false }, props), '?lang=de');
});

// --- Gruppieren nach Unterstrich-Teilen ---

const ids = (items) => items.map(i => (i.typ === 'gruppe' ? { k: i.key, l: i.label, n: i.mitglieder.length, c: ids(i.kinder) } : i.material.id));

test('Unterstriche: gemeinsame Anfangsteile bilden verschachtelte Gruppen', () => {
  const rows = [
    mat(1, 'Holz_Pappel_4mm', 'holz'), mat(2, 'Holz_Kiefer', 'holz'), mat(3, 'Holz_Pappel_10mm', 'holz'), mat(4, 'Birke', 'holz')
  ];
  assert.deepEqual(ids(gruppiere(rows)), [
    { k: 'holz|holz', l: 'Holz', n: 3, c: [{ k: 'holz|holz_pappel', l: 'Pappel', n: 2, c: [1, 3] }, 2] },
    4
  ]);
});

test('Unterstriche: Ketten ohne Verzweigung werden zu einem Namen zusammengezogen', () => {
  const rows = [mat(1, 'Holz_Pappel_4mm', 'holz'), mat(2, 'Holz_Pappel_10mm', 'holz')];
  assert.deepEqual(ids(gruppiere(rows)), [{ k: 'holz|holz_pappel', l: 'Holz_Pappel', n: 2, c: [1, 2] }]);
});

test('Unterstriche: ein Material, dessen Name der Gruppenname ist, steht in der Gruppe; Kategorien bleiben getrennt', () => {
  const rows = [mat(1, 'Holz', 'holz'), mat(2, 'Holz_Kiefer', 'holz'), mat(3, 'Holz_Kiefer', 'metall')];
  assert.deepEqual(ids(gruppiere(rows)), [{ k: 'holz|holz', l: 'Holz', n: 2, c: [1, 2] }, 3]);
});

test('Unterstriche: Groß-/Kleinschreibung, Leerzeichen und doppelte Unterstriche stören nicht', () => {
  const rows = [mat(1, 'holz_ Kiefer', 'holz'), mat(2, 'Holz__kiefer', 'holz')];
  assert.deepEqual(ids(gruppiere(rows)), [{ k: 'holz|holz_kiefer', l: 'holz_Kiefer', n: 2, c: [1, 2] }]);
});
