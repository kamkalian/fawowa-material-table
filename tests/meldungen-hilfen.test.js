import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jaNeinAusText, optionAusText, entwurfAusText, wertDatenAusEntwurf, vorlageAusVorschlag, aktuellText
} from '../src/admin/meldungen-hilfen.js';

const props = [
  { kurzwort: 'gewicht', typ: 'zahl', einheit: 'kg/m²' },
  { kurzwort: 'wasserfest', typ: 'ja_nein', einheit: null },
  { kurzwort: 'brand', typ: 'auswahl', einheit: null, optionen: [{ id: 7, de: 'B1', en: 'B1' }, { id: 8, de: 'Schwer entflammbar', en: 'Flame retardant' }] },
  { kurzwort: 'bemerkung', typ: 'text', einheit: null }
];

test('Ja/Nein wird aus deutschen und englischen Eingaben erkannt', () => {
  assert.equal(jaNeinAusText(' Ja '), 'ja');
  assert.equal(jaNeinAusText('YES'), 'ja');
  assert.equal(jaNeinAusText('nein'), 'nein');
  assert.equal(jaNeinAusText('No'), 'nein');
  assert.equal(jaNeinAusText('vielleicht'), '');
  assert.equal(jaNeinAusText(undefined), '');
});

test('Option wird nach deutschem oder englischem Namen gefunden', () => {
  assert.equal(optionAusText(props[2].optionen, 'schwer entflammbar'), 8);
  assert.equal(optionAusText(props[2].optionen, 'Flame Retardant'), 8);
  assert.equal(optionAusText(props[2].optionen, 'B2'), '');
  assert.equal(optionAusText(props[2].optionen, ''), '');
});

test('Entwurf je Typ: Zahl nimmt die Standard-Einheit, Ja/Nein und Auswahl werden zugeordnet', () => {
  assert.deepEqual(entwurfAusText(props[0], '2,8'), { text: '2,8', option_id: '', ja_nein: '', einheit: 'kg/m²' });
  assert.equal(entwurfAusText(props[0], '2,8', 'g/cm²').einheit, 'g/cm²');
  assert.equal(entwurfAusText(props[1], 'yes').ja_nein, 'ja');
  assert.equal(entwurfAusText(props[2], 'B1').option_id, 7);
  assert.equal(entwurfAusText(props[3], 'Text').text, 'Text');
  assert.equal(entwurfAusText(null, 'x').text, '');
});

test('Daten für die API aus einem Entwurf', () => {
  assert.deepEqual(wertDatenAusEntwurf(props[0], { text: ' 2,8 ', einheit: '' }), { zahl: '2,8', einheit: null });
  assert.deepEqual(wertDatenAusEntwurf(props[1], { ja_nein: 'nein' }), { ja_nein: false });
  assert.deepEqual(wertDatenAusEntwurf(props[1], { ja_nein: '' }), { ja_nein: null });
  assert.deepEqual(wertDatenAusEntwurf(props[2], { option_id: '8' }), { option_id: 8 });
  assert.deepEqual(wertDatenAusEntwurf(props[3], { text: '  ' }), { text: null });
});

test('Vorlage aus einem Vorschlag: Name, Werte nach Typ, Quelle als Link, Start als Entwurf', () => {
  const meldung = {
    quelle: 'https://shop.example/birke',
    inhalt: { name: 'Birke', hersteller: 'ACME', kategorie_id: 3, werte: [
      { eigenschaft: 'gewicht', wert: '3,1', einheit: null },
      { eigenschaft: 'wasserfest', wert: 'ja' },
      { eigenschaft: 'unbekannt', wert: 'x' }
    ] }
  };
  const v = vorlageAusVorschlag(meldung, props);
  assert.equal(v.name_de, 'Birke');
  assert.equal(v.hersteller, 'ACME');
  assert.equal(v.kategorie_id, 3);
  assert.equal(v.status, 'entwurf');
  assert.equal(v.werte.gewicht.text, '3,1');
  assert.equal(v.werte.gewicht.einheit, 'kg/m²');
  assert.equal(v.werte.wasserfest.ja_nein, 'ja');
  assert.ok(!('unbekannt' in v.werte));
  assert.deepEqual(v.links, [{ beschriftung: 'Quelle', url: 'https://shop.example/birke' }]);
});

test('Anzeige des aktuellen Werts', () => {
  assert.equal(aktuellText(null), '–');
  assert.equal(aktuellText({ zahl: 2.5, text: null, ja_nein: null, option: null, einheit: 'kg/m²' }), '2.5 kg/m²');
  assert.equal(aktuellText({ zahl: null, text: null, ja_nein: false, option: null, einheit: null }), 'nein');
  assert.equal(aktuellText({ zahl: null, text: null, ja_nein: null, option: 'B1', einheit: null }), 'B1');
});
