import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ladeUnterstuetzung, ladePoweredBy, oeffentlicheAngaben, verarbeiteWebhook, stufeFuer, uebersichtUnterstuetzung,
  traegeEingangEin, aendereEingang, loescheEingang, benenneUnterstuetzer, loescheUnterstuetzer
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
  const e = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '120,5', SUPPORT_BADGE_GOLD: '75' });
  assert.equal(e.ziel, 120.5);
  assert.equal(e.waehrung, 'EUR');
  assert.equal(e.webhook, false);
  assert.deepEqual(e.schwellen, { bronze: 1, silber: 10, gold: 75, platin: 150 });
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'https://x.de', SUPPORT_GOAL: 'abc' }).ziel, 0);
  assert.deepEqual(ladePoweredBy({ POWERED_BY: 'Kurm Industries', POWERED_BY_URL: 'https://kurm-industries.de' }), { name: 'Kurm Industries', url: 'https://kurm-industries.de' });
  assert.deepEqual(ladePoweredBy({ POWERED_BY: 'Kurm Industries', POWERED_BY_URL: 'http://x' }), { name: 'Kurm Industries', url: null });
  assert.equal(ladePoweredBy({}), null);
});

test('Abzeichen: die höchste erreichte Stufe, ohne Betrag keine', () => {
  const sw = { bronze: 1, silber: 10, gold: 50, platin: 150 };
  assert.equal(stufeFuer(0, sw), null);
  assert.equal(stufeFuer(0.5, sw), null);
  assert.equal(stufeFuer(1, sw), 'bronze');
  assert.equal(stufeFuer(9.99, sw), 'bronze');
  assert.equal(stufeFuer(10, sw), 'silber');
  assert.equal(stufeFuer(50, sw), 'gold');
  assert.equal(stufeFuer(1000, sw), 'platin');
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

test('Webhook: ein öffentlicher Beitrag zeigt den Namen, mehrere Beträge derselben Person addieren sich zum Abzeichen', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', KOFI_VERIFICATION_TOKEN: 't' });
  const opt = { token: 't', waehrung: 'EUR' };
  const body = (d) => ({ data: JSON.stringify({ verification_token: 't', currency: 'EUR', is_public: true, ...d }) });
  verarbeiteWebhook(db, body({ message_id: 'x1', amount: '6', from_name: 'Berta' }), opt, JETZT);
  verarbeiteWebhook(db, body({ message_id: 'x2', amount: '5', from_name: 'berta' }), opt, JETZT); // gleiche Person, andere Schreibweise
  verarbeiteWebhook(db, body({ message_id: 'x3', amount: '200', from_name: 'Carl' }), opt, JETZT);
  verarbeiteWebhook(db, body({ message_id: 'x4', amount: '3', from_name: 'Dora', is_public: false }), opt, JETZT);
  const a = oeffentlicheAngaben(db, einst, JETZT);
  assert.deepEqual(a.unterstuetzer, [{ name: 'Carl', stufe: 'platin' }, { name: 'Berta', stufe: 'silber' }]);
  assert.equal(a.erreicht, 214);
  // öffentlich sind nur Name und Stufe, nie ein Betrag
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
  assert.equal(u.unterstuetzer[0].stufe, 'silber');
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

  benenneUnterstuetzer(db, u.unterstuetzer[0].id, 'Fritz M.');
  assert.equal(uebersichtUnterstuetzung(db, einst, JETZT).unterstuetzer[0].name, 'Fritz M.');
  assert.throws(() => benenneUnterstuetzer(db, u.unterstuetzer[0].id, ''), FehlerEingabe);

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
  const alle = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '35' });
  const monat = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '35', SUPPORT_PERIOD: 'monat' });
  assert.equal(alle.zeitraum, 'gesamt');
  assert.equal(oeffentlicheAngaben(db, alle, JETZT).erreicht, 17.5);
  assert.equal(oeffentlicheAngaben(db, monat, JETZT).erreicht, 7.5);
  assert.equal(oeffentlicheAngaben(db, monat, new Date('2026-12-01T12:00:00Z')).erreicht, 0); // neuer Monat, Balken leer
  // Gerda hat insgesamt 15 € gegeben: Silber, auch wenn der Balken schon zurückgesetzt wurde
  assert.deepEqual(oeffentlicheAngaben(db, monat, new Date('2026-12-01T12:00:00Z')).unterstuetzer, [{ name: 'Gerda', stufe: 'silber' }]);
});

test('Altes Format: eine Liste von Ko-fi-Beträgen wird übernommen', () => {
  const { s: db } = neuerSpeicher();
  db.lokal.schreibe('unterstuetzung', [{ nachricht_id: 'alt1', betrag: 5, waehrung: 'EUR', erhalten_am: '2026-11-12 08:00:00' }]);
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_PERIOD: 'monat' });
  assert.equal(oeffentlicheAngaben(db, einst, JETZT).erreicht, 5);
  assert.equal(verarbeiteWebhook(db, { data: JSON.stringify({ verification_token: 't', message_id: 'alt1', amount: '5', currency: 'EUR' }) }, { token: 't', waehrung: 'EUR' }), 'doppelt');
});
