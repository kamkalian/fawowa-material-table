import test from 'node:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { liesVerzeichnis } from '../lib/speicher.js';
import assert from 'node:assert/strict';
import {
  ladeUnterstuetzung, ladePoweredBy, oeffentlicheAngaben, verarbeiteWebhook, uebersichtUnterstuetzung,
  traegeEingangEin, aendereEingang, loescheEingang, aendereUnterstuetzer, loescheUnterstuetzer, legeUnterstuetzerAn, uebernehmeLokaleUnterstuetzer, istWiederkehrend
} from '../lib/unterstuetzung.js';
import { FehlerEingabe } from '../lib/fehler.js';
import { neuerSpeicher } from './hilfen.js';

const BANK = { SUPPORT_BANK_HOLDER: 'Kurm Industries', SUPPORT_BANK_IBAN: 'DE00 0000 0000 0000 0000 00', SUPPORT_BANK_REFERENCE: 'Materialdatenbank' };
const JETZT = new Date('2026-11-15T12:00:00Z');

test('Unterstützen: ohne Zahlungsweg ist der Bereich nicht aktiv, nur https gilt', () => {
  assert.equal(ladeUnterstuetzung({}).aktiv, false);
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'http://ko-fi.com/x' }).aktiv, false);
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'javascript:alert(1)', SUPPORT_PAYPAL_URL: 'ftp://x' }).aktiv, false);
  assert.equal(ladeUnterstuetzung({ SUPPORT_PAYPAL_URL: 'https://paypal.me/x' }).aktiv, true);
  assert.equal(ladeUnterstuetzung({ SUPPORT_BANK_HOLDER: 'A' }).aktiv, false); // IBAN fehlt
  assert.equal(ladeUnterstuetzung(BANK).aktiv, true);
});

test('Unterstützen: Einstellungen aus der .env, Zahlen mit Komma, Schwellen und Standardwerte', () => {
  const e = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '120,5' });
  assert.equal(e.ziel, 120.5);
  assert.equal(e.waehrung, 'EUR');
  assert.equal(e.webhook, false);
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'https://x.de', SUPPORT_GOAL: 'abc' }).ziel, 0);
  assert.deepEqual(ladePoweredBy({ POWERED_BY: 'Kurm Industries', POWERED_BY_URL: 'https://kurm-industries.de' }), { name: 'Kurm Industries', url: 'https://kurm-industries.de' });
  assert.deepEqual(ladePoweredBy({ POWERED_BY: 'Kurm Industries', POWERED_BY_URL: 'http://x' }), { name: 'Kurm Industries', url: null });
  assert.equal(ladePoweredBy({}), null);
});

test('Webhook: prüft den Token, zählt jede Nachricht einmal und ignoriert andere Währungen', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '100', KOFI_VERIFICATION_TOKEN: 'geheim' });
  const opt = { token: 'geheim', waehrung: 'EUR' };
  const body = (d) => ({ data: JSON.stringify({ verification_token: 'geheim', message_id: 'a1', amount: '5.00', currency: 'EUR', from_name: 'Anna', email: 'a@b.de', is_public: false, ...d }) });

  assert.equal(verarbeiteWebhook(db, body({ verification_token: 'falsch' }), opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, { data: 'kein json' }, opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, {}, opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, body({}), opt, JETZT), 'gespeichert');
  assert.equal(verarbeiteWebhook(db, body({}), opt, JETZT), 'doppelt');
  assert.match(verarbeiteWebhook(db, body({ message_id: 'a2', currency: 'USD' }), opt), /^ignoriert/);
  assert.match(verarbeiteWebhook(db, body({ message_id: 'a3', amount: '0' }), opt), /^ignoriert/);
  assert.equal(verarbeiteWebhook(db, body({ message_id: 'a4', amount: '2,50' }), opt, JETZT), 'gespeichert');

  assert.equal(oeffentlicheAngaben(db, einst, JETZT).erreicht, 7.5);
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer, []); // nicht öffentlich: kein Name, keine Person
  assert.equal(oeffentlicheAngaben(db, ladeUnterstuetzung({}), JETZT), null);
  // nichts außer Betrag, Zeit, Weg und Nummer gespeichert: keine Namen, E-Mail oder Nachrichten
  const datei = JSON.stringify(db.lokal.lies('unterstuetzung', null));
  assert.ok(!/Anna|a@b\.de/.test(datei));
});

test('Webhook: ein öffentlicher Beitrag zeigt den Namen ohne Abzeichen, mehrere Beträge derselben Person gehören zusammen', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', KOFI_VERIFICATION_TOKEN: 't' });
  const opt = { token: 't', waehrung: 'EUR' };
  const body = (d) => ({ data: JSON.stringify({ verification_token: 't', currency: 'EUR', is_public: true, ...d }) });
  verarbeiteWebhook(db, body({ message_id: 'x1', amount: '6', from_name: 'Berta' }), opt, JETZT);
  verarbeiteWebhook(db, body({ message_id: 'x2', amount: '5', from_name: 'berta' }), opt, JETZT); // gleiche Person, andere Schreibweise
  verarbeiteWebhook(db, body({ message_id: 'x3', amount: '200', from_name: 'Carl' }), opt, JETZT);
  verarbeiteWebhook(db, body({ message_id: 'x4', amount: '3', from_name: 'Dora', is_public: false }), opt, JETZT);
  const a = oeffentlicheAngaben(db, einst, JETZT);
  assert.deepEqual(a.unterstuetzer, [{ name: 'Berta', abzeichen: [] }, { name: 'Carl', abzeichen: [] }]); // kein Abzeichen von selbst, Dora nicht öffentlich
  assert.equal(a.erreicht, 214);
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer.find(u => u.name === 'Berta').gesamt, 11);
  // öffentlich sind nur Name und Abzeichen, nie ein Betrag
  assert.ok(!JSON.stringify(a.unterstuetzer).match(/\d/));
});

test('Von Hand eintragen: anonym, mit Zustimmung, bestehende Person ergänzen; Name nur mit Zustimmung', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ ...BANK, SUPPORT_GOAL: '35' });
  const ein = (d) => traegeEingangEin(db, einst, { quelle: 'ueberweisung', datum: '2026-11-10', ...d }, JETZT);

  ein({ betrag: '20' });                                                  // anonym
  assert.throws(() => ein({ betrag: '5', name: 'Emil' }), FehlerEingabe);   // Name ohne Zustimmung
  ein({ betrag: '5', name: 'Emil', zustimmung: true });
  ein({ betrag: '6,5', name: 'emil', zustimmung: true });                  // gleiche Person
  const u = uebersichtUnterstuetzung(db, einst, JETZT);
  assert.equal(u.unterstuetzer.length, 1);
  assert.equal(u.unterstuetzer[0].gesamt, 11.5);
  assert.deepEqual(u.unterstuetzer[0].abzeichen, []);
  assert.equal(u.unterstuetzer[0].zustimmung_art, 'manuell');
  assert.equal(u.erreicht, 31.5);
  ein({ betrag: '1', unterstuetzer_id: u.unterstuetzer[0].id, quelle: 'paypal' });
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer[0].anzahl, 3);

  for (const schlecht of [{ betrag: '0' }, { betrag: 'viel' }, { betrag: '5', datum: '2026-13-40' }, { betrag: '5', datum: '2027-12-01' }, { betrag: '5', quelle: 'kofi' }, { betrag: '5', quelle: 'bar' }, { betrag: '5', unterstuetzer_id: 99 }]) {
    assert.throws(() => ein(schlecht), FehlerEingabe, JSON.stringify(schlecht));
  }
});

test('Verwalten: Eingang ändern und löschen, Person umbenennen und entfernen (Beträge bleiben anonym im Balken)', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ ...BANK, SUPPORT_GOAL: '35' });
  const id = traegeEingangEin(db, einst, { quelle: 'paypal', datum: '2026-11-10', betrag: '12', name: 'Fritz', zustimmung: true }, JETZT);
  let u = uebersichtUnterstuetzung(db, einst, JETZT);
  aendereEingang(db, einst, id, { betrag: '15', datum: '2026-11-11', quelle: 'sonstige' }, JETZT);
  u = uebersichtUnterstuetzung(db, einst, JETZT);
  assert.equal(u.eingaenge[0].betrag, 15);
  assert.equal(u.eingaenge[0].quelle, 'sonstige');
  assert.throws(() => aendereEingang(db, einst, 999, { betrag: 1 }, JETZT), FehlerEingabe);

  aendereUnterstuetzer(db, u.unterstuetzer[0].id, { name: 'Fritz M.' });
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer[0].name, 'Fritz M.');
  assert.throws(() => aendereUnterstuetzer(db, u.unterstuetzer[0].id, { name: '' }), FehlerEingabe);

  loescheUnterstuetzer(db, u.unterstuetzer[0].id);
  u = uebersichtUnterstuetzung(db, einst, JETZT);
  assert.equal(u.unterstuetzer.length, 0);
  assert.equal(u.erreicht, 15);                       // der Betrag bleibt, anonym
  assert.equal(u.eingaenge[0].unterstuetzer_id, null);
  assert.ok(!JSON.stringify(db.lokal.lies('unterstuetzung', null)).includes('Fritz'));

  loescheEingang(db, id);
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).erreicht, 0);
  assert.throws(() => loescheEingang(db, id), FehlerEingabe);
});

test('Balken: bei zeitraum monat zählt nur der laufende Kalendermonat (Zeit in Deutschland), Abzeichen zählen alles', () => {
  const { s: db } = neuerSpeicher();
  db.lokal.schreibe('unterstuetzung', {
    unterstuetzer: [{ id: 1, name: 'Gerda', zustimmung_am: '2026-10-01 10:00:00', zustimmung_art: 'manuell' }],
    eingaenge: [
      { id: 1, betrag: 10, waehrung: 'EUR', datum: '2026-10-31 22:30:00', quelle: 'ueberweisung', unterstuetzer_id: 1, nachricht_id: null }, // 31.10. 23:30 deutsche Zeit: Oktober
      { id: 2, betrag: 5, waehrung: 'EUR', datum: '2026-10-31 23:30:00', quelle: 'ueberweisung', unterstuetzer_id: 1, nachricht_id: null },  // 1.11. 00:30: November
      { id: 3, betrag: 2.5, waehrung: 'EUR', datum: '2026-11-12 08:00:00', quelle: 'paypal', unterstuetzer_id: null, nachricht_id: null }
    ]
  });
  uebernehmeLokaleUnterstuetzer(db);
  const alle = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '35' });
  const monat = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '35', SUPPORT_PERIOD: 'monat' });
  assert.equal(alle.zeitraum, 'gesamt');
  assert.equal(oeffentlicheAngaben(db, alle, JETZT).erreicht, 17.5);
  assert.equal(oeffentlicheAngaben(db, monat, JETZT).erreicht, 7.5);
  assert.equal(oeffentlicheAngaben(db, monat, new Date('2026-12-01T12:00:00Z')).erreicht, 0); // neuer Monat, Balken leer
  // Gerda bleibt in der Liste, auch wenn der Balken schon zurückgesetzt wurde
  assert.deepEqual(oeffentlicheAngaben(db, monat, new Date('2026-12-01T12:00:00Z')).unterstuetzer, [{ name: 'Gerda', abzeichen: [] }]);
});

test('Altes Format: eine Liste von Ko-fi-Beträgen wird übernommen', () => {
  const { s: db } = neuerSpeicher();
  db.lokal.schreibe('unterstuetzung', [{ nachricht_id: 'alt1', betrag: 5, waehrung: 'EUR', erhalten_am: '2026-11-12 08:00:00' }]);
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_PERIOD: 'monat' });
  assert.equal(oeffentlicheAngaben(db, einst, JETZT).erreicht, 5);
  assert.equal(verarbeiteWebhook(db, { data: JSON.stringify({ verification_token: 't', message_id: 'alt1', amount: '5', currency: 'EUR' }) }, { token: 't', waehrung: 'EUR' }), 'doppelt');
});

test('Abzeichen: nur von Hand, mehrere je Person, nur aus der Auswahl; auch Personen ohne Geld', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ ...BANK });
  const ein = (name) => traegeEingangEin(db, einst, { quelle: 'paypal', datum: '2026-11-10', betrag: '500', name, zustimmung: true }, JETZT);
  ein('Zeno'); ein('Alma'); ein('Mira');
  // auch 500 € geben von selbst kein Abzeichen
  assert.ok(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer.every(u => u.abzeichen.length === 0));
  const id = (name) => uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer.find(u => u.name === name).id;
  aendereUnterstuetzer(db, id('Zeno'), { abzeichen: ['grosszuegig', 'wiederkehrend', 'wiederkehrend'] });
  aendereUnterstuetzer(db, id('Mira'), { abzeichen: ['kaffee'] });
  // Person ohne Geldeingang, hilft mit Ideen
  const ideen = legeUnterstuetzerAn(db, { name: 'Ida', zustimmung: true, abzeichen: ['ideengeber'] }, JETZT);
  assert.ok(ideen > 0);
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer, [
    { name: 'Mira', abzeichen: ['kaffee'] },
    { name: 'Zeno', abzeichen: ['wiederkehrend', 'grosszuegig'] },   // Reihenfolge wie in der Auswahl, ohne Doppelte
    { name: 'Ida', abzeichen: ['ideengeber'] },
    { name: 'Alma', abzeichen: [] }
  ]);
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer.find(u => u.name === 'Ida').gesamt, 0);
  assert.throws(() => aendereUnterstuetzer(db, id('Zeno'), { abzeichen: ['gold'] }), FehlerEingabe);
  assert.throws(() => aendereUnterstuetzer(db, id('Zeno'), { abzeichen: 'kaffee' }), FehlerEingabe);
  assert.throws(() => legeUnterstuetzerAn(db, { name: 'Ida', zustimmung: true }, JETZT), FehlerEingabe);   // gibt es schon
  assert.throws(() => legeUnterstuetzerAn(db, { name: 'Neu' }, JETZT), FehlerEingabe);                    // ohne Zustimmung
  aendereUnterstuetzer(db, id('Zeno'), { abzeichen: [] });
  assert.deepEqual(uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer.find(u => u.name === 'Zeno').abzeichen, []);
});

test('Übernahme aus der lokalen Datei: ein Text oder ein entferntes Abzeichen wird bereinigt', () => {
  const { s: db } = neuerSpeicher();
  db.lokal.schreibe('unterstuetzung', {
    unterstuetzer: [
      { id: 1, name: 'Einzeln', abzeichen: 'kaffee', zustimmung_am: '2026-11-01 10:00:00', zustimmung_art: 'manuell' },
      { id: 2, name: 'Alt', abzeichen: 'berg', zustimmung_am: '2026-11-01 10:00:00', zustimmung_art: 'manuell' },
      { id: 3, name: 'Ohne', zustimmung_am: '2026-11-01 10:00:00', zustimmung_art: 'manuell' }
    ],
    eingaenge: []
  });
  uebernehmeLokaleUnterstuetzer(db);
  const einst = ladeUnterstuetzung({ ...BANK });
  const u = Object.fromEntries(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer.map(x => [x.name, x.abzeichen]));
  assert.deepEqual(u, { Einzeln: ['kaffee'], Alt: [], Ohne: [] });
});

test('Name nachtragen: ein anonymer Ko-fi-Eingang bekommt mit Zustimmung einen Namen, auch wieder anonym machbar', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', KOFI_VERIFICATION_TOKEN: 't' });
  verarbeiteWebhook(db, { data: JSON.stringify({ verification_token: 't', message_id: 'k1', amount: '5', currency: 'EUR', from_name: 'Privat', is_public: false }) }, { token: 't', waehrung: 'EUR' }, JETZT);
  const eingang = () => uebersichtUnterstuetzung(db, einst, JETZT).eingaenge[0];
  assert.equal(eingang().unterstuetzer_id, null);
  assert.throws(() => aendereEingang(db, einst, eingang().id, { name: 'Hanna' }), FehlerEingabe);
  assert.throws(() => aendereEingang(db, einst, eingang().id, { name: 'Hanna', zustimmung: false }), FehlerEingabe);
  aendereEingang(db, einst, eingang().id, { name: 'Hanna', zustimmung: true }, JETZT);
  assert.equal(eingang().unterstuetzer_name, 'Hanna');
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer, [{ name: 'Hanna', abzeichen: [] }]);
  assert.ok(!JSON.stringify(db.lokal.lies('unterstuetzung', null)).includes('Privat')); // der Ko-fi-Name wurde nie gespeichert
  aendereEingang(db, einst, eingang().id, { unterstuetzer_id: null }, JETZT);
  assert.equal(eingang().unterstuetzer_id, null);
  assert.throws(() => aendereEingang(db, einst, eingang().id, { unterstuetzer_id: 99 }, JETZT), FehlerEingabe);
});

test('Repo: Unterstützer stehen mit Namen und Abzeichen im Daten-Repo, Beträge nie; jede Änderung ist ein Commit', () => {
  const { s: db, verzeichnis } = neuerSpeicher({ mitGit: true });
  const einst = ladeUnterstuetzung({ ...BANK });
  traegeEingangEin(db, einst, { quelle: 'ueberweisung', datum: '2026-11-10', betrag: '123,45', name: 'Olga', zustimmung: true }, JETZT);
  const id = legeUnterstuetzerAn(db, { name: 'Ida', zustimmung: true, abzeichen: ['ideengeber'] }, JETZT);
  aendereUnterstuetzer(db, id, { abzeichen: ['ideengeber', 'datenpfleger'] });

  const datei = JSON.parse(readFileSync(join(verzeichnis, 'unterstuetzer.json'), 'utf8'));
  assert.deepEqual(datei.map(u => [u.name, u.abzeichen]), [['Olga', []], ['Ida', ['ideengeber', 'datenpfleger']]]);
  assert.ok(!JSON.stringify(datei).includes('123') && !readdirSync(verzeichnis).some(f => f.includes('eingang')));   // kein Betrag im Repo
  const betreffe = db.git.verlauf(10).map(c => c.betreff);
  assert.ok(betreffe.some(b => b.includes('Unterstützer »Ida«: Abzeichen ideengeber → ideengeber, datenpfleger')), betreffe.join(' | '));
  assert.ok(betreffe.some(b => b.includes('Unterstützer »Olga« angelegt')));
  // lokal liegen nur die Eingänge
  assert.ok(!JSON.stringify(db.lokal.lies('unterstuetzung', null)).includes('Olga'));

  // neu laden aus den Dateien: dasselbe
  const r = liesVerzeichnis(verzeichnis);
  assert.deepEqual(r.fehler, []);
  assert.deepEqual(r.daten.unterstuetzer.map(u => u.name), ['Olga', 'Ida']);
});

test('Repo: Änderungen von Hand im Repo sind nach dem Laden sichtbar; Fehler werden benannt', () => {
  const { s: db, verzeichnis } = neuerSpeicher({ mitGit: true });
  const einst = ladeUnterstuetzung({ ...BANK });
  legeUnterstuetzerAn(db, { name: 'Ida', zustimmung: true }, JETZT);
  const pfad = join(verzeichnis, 'unterstuetzer.json');

  // jemand ändert die Datei im Repo: Abzeichen ergänzt, neue Person ohne ID
  writeFileSync(pfad, JSON.stringify([{ id: 1, name: 'Ida', abzeichen: ['botschafter'] }, { name: 'Neu' }]));
  const r = liesVerzeichnis(verzeichnis);
  assert.deepEqual(r.fehler, []);
  assert.equal(r.ergaenzt, true);
  db.ersetze(r.daten);
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer, [{ name: 'Ida', abzeichen: ['botschafter'] }, { name: 'Neu', abzeichen: [] }]);
  assert.equal(r.daten.unterstuetzer.find(u => u.name === 'Neu').id, 2);

  for (const [inhalt, muster] of [
    ['{ kein json', /Kein gültiges JSON/],
    ['{}', /Liste/],
    [JSON.stringify([{ abzeichen: [] }]), /name/],
    [JSON.stringify([{ name: 'A' }, { name: 'a' }]), /doppelt/],
    [JSON.stringify([{ name: 'A', abzeichen: ['gold'] }]), /abzeichen/],
    [JSON.stringify([{ id: 4, name: 'A' }, { id: 4, name: 'B' }]), /doppelt/],
    [JSON.stringify([{ name: 'A', zustimmung_art: 'egal' }]), /zustimmung_art/]
  ]) {
    writeFileSync(pfad, inhalt);
    const f = liesVerzeichnis(verzeichnis).fehler;
    assert.ok(f.length && f.every(x => x.datei === 'unterstuetzer.json') && muster.test(f[0].text), `${inhalt}: ${JSON.stringify(f)}`);
  }
});

test('Repo: Eingänge einer im Repo gelöschten Person bleiben anonym, die ID wird nicht wiederverwendet', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ ...BANK });
  traegeEingangEin(db, einst, { quelle: 'paypal', datum: '2026-11-10', betrag: '20', name: 'Karl', zustimmung: true }, JETZT);
  db.ersetze({ ...db, kategorien: db.kategorien, eigenschaften: db.eigenschaften, materialien: db.materialien, unterstuetzer: [] }); // wie nach dem Löschen im Repo
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).eingaenge[0].unterstuetzer_name, null);
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).erreicht, 20);
  const neu = legeUnterstuetzerAn(db, { name: 'Lena', zustimmung: true }, JETZT);
  assert.ok(neu > 1);                                                                               // 1 gehörte Karl
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).eingaenge[0].unterstuetzer_name, null);   // der Eingang wurde nicht Lena zugeordnet
});

test('Wiederkehrend: Abo-Zahlung oder Geld in aufeinanderfolgenden Monaten, mehrere im selben Monat zählen einmal', () => {
  const e = (datum, extra = {}) => ({ datum: datum + ' 12:00:00', ...extra });
  assert.equal(istWiederkehrend([]), false);
  assert.equal(istWiederkehrend([e('2026-10-05')]), false);
  assert.equal(istWiederkehrend([e('2026-10-05'), e('2026-10-20'), e('2026-10-31')]), false);   // drei Mal im selben Monat
  assert.equal(istWiederkehrend([e('2026-10-05'), e('2026-12-05')]), false);                    // ein Monat dazwischen fehlt
  assert.equal(istWiederkehrend([e('2026-10-05'), e('2026-11-05')]), true);
  assert.equal(istWiederkehrend([e('2026-12-20'), e('2027-01-02')]), true);                     // über den Jahreswechsel
  assert.equal(istWiederkehrend([e('2026-10-05'), e('2026-11-05')], 3), false);
  assert.equal(istWiederkehrend([e('2026-10-05'), e('2026-11-05'), e('2026-12-05')], 3), true);
  assert.equal(istWiederkehrend([e('2026-10-05', { abo: true })]), true);
  assert.equal(istWiederkehrend([e('2026-10-31 22:30:00'.slice(0, 10)), e('2026-11-01')]), true);
});

test('Wiederkehrend: Ko-fi-Beiträge in zwei Monaten vergeben das Abzeichen automatisch einmal, von Hand entfernt bleibt es entfernt', () => {
  const { s: db } = neuerSpeicher({ mitGit: true });
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', KOFI_VERIFICATION_TOKEN: 't' });
  const opt = { token: 't', waehrung: 'EUR' };
  const tip = (id, d = {}) => ({ data: JSON.stringify({ verification_token: 't', message_id: id, amount: '3', currency: 'EUR', from_name: 'Rita', is_public: true, ...d }) });
  const abz = () => oeffentlicheAngaben(db, einst, JETZT).unterstuetzer.find(u => u.name === 'Rita')?.abzeichen;

  verarbeiteWebhook(db, tip('r1'), opt, new Date('2026-10-10T10:00:00Z'));
  assert.deepEqual(abz(), []);                                              // angelegt, ein Beitrag: noch nicht wiederkehrend
  verarbeiteWebhook(db, tip('r2'), opt, new Date('2026-10-20T10:00:00Z'));
  assert.deepEqual(abz(), []);                                              // derselbe Monat
  verarbeiteWebhook(db, tip('r3'), opt, new Date('2026-11-10T10:00:00Z'));
  assert.deepEqual(abz(), ['wiederkehrend']);
  assert.ok(db.git.verlauf(10).some(c => c.betreff.includes('Abzeichen Wiederkehrend automatisch vergeben')));

  const id = uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer[0].id;
  aendereUnterstuetzer(db, id, { abzeichen: [] });                          // von Hand entfernt
  verarbeiteWebhook(db, tip('r4'), opt, new Date('2026-12-10T10:00:00Z'));
  assert.deepEqual(abz(), []);                                              // wird nicht wieder vergeben
});

test('Wiederkehrend: ein Ko-fi-Abo vergibt das Abzeichen sofort, anonyme Beiträge bleiben ohne Person', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', KOFI_VERIFICATION_TOKEN: 't' });
  const opt = { token: 't', waehrung: 'EUR' };
  const tip = (id, d) => ({ data: JSON.stringify({ verification_token: 't', message_id: id, amount: '5', currency: 'EUR', ...d }) });
  verarbeiteWebhook(db, tip('a1', { from_name: 'Sven', is_public: true, is_subscription_payment: true, type: 'Subscription' }), opt, JETZT);
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer, [{ name: 'Sven', abzeichen: ['wiederkehrend'] }]);
  // nicht öffentlich: keine Person, deshalb auch kein Abzeichen
  verarbeiteWebhook(db, tip('a2', { from_name: 'Geheim', is_public: false, is_subscription_payment: true }), opt, JETZT);
  assert.equal(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer.length, 1);
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).eingaenge.find(e => e.nachricht_id === 'a2').unterstuetzer_id, null);
});

test('Wiederkehrend: auch von Hand eingetragene und nachträglich zugeordnete Eingänge zählen', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ ...BANK, KOFI_VERIFICATION_TOKEN: 't', SUPPORT_URL: 'https://ko-fi.com/x' });
  const ein = (d) => traegeEingangEin(db, einst, { quelle: 'ueberweisung', betrag: '5', ...d }, JETZT);
  ein({ datum: '2026-10-15', name: 'Uwe', zustimmung: true });
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer[0].abzeichen, []);
  ein({ datum: '2026-11-03', name: 'uwe', zustimmung: true });
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer[0].abzeichen, ['wiederkehrend']);

  // zwei anonyme Ko-fi-Eingänge in zwei Monaten werden einer Person zugeordnet
  const opt = { token: 't', waehrung: 'EUR' };
  const tip = (id) => ({ data: JSON.stringify({ verification_token: 't', message_id: id, amount: '2', currency: 'EUR', from_name: 'x', is_public: false }) });
  verarbeiteWebhook(db, tip('k1'), opt, new Date('2026-09-10T10:00:00Z'));
  verarbeiteWebhook(db, tip('k2'), opt, new Date('2026-10-10T10:00:00Z'));
  const anonym = uebersichtUnterstuetzung(db, einst, JETZT).eingaenge.filter(e => e.quelle === 'kofi');
  assert.equal(anonym.length, 2);
  const neu = legeUnterstuetzerAn(db, { name: 'Vera', zustimmung: true }, JETZT);
  for (const e of anonym) aendereEingang(db, einst, e.id, { unterstuetzer_id: neu }, JETZT);
  assert.deepEqual(oeffentlicheAngaben(db, einst, JETZT).unterstuetzer.find(u => u.name === 'Vera').abzeichen, ['wiederkehrend']);
});

test('Kontaktadresse für Unterstützer: nur eine gültige E-Mail-Adresse wird öffentlich', () => {
  const { s: db } = neuerSpeicher();
  const mit = (adresse) => oeffentlicheAngaben(db, ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_CONTACT_EMAIL: adresse }), JETZT).kontakt;
  assert.equal(mit('kontakt@kurm-industries.de'), 'kontakt@kurm-industries.de');
  assert.equal(mit(' kontakt@kurm-industries.de '), 'kontakt@kurm-industries.de');
  for (const schlecht of ['kein mail', 'a@b', '<script>@x.de', 'a b@c.de', '']) assert.equal(mit(schlecht), null, schlecht);
});
