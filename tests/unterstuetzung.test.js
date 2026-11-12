import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeUnterstuetzung, oeffentlicheAngaben, verarbeiteWebhook } from '../lib/unterstuetzung.js';
import { neuerSpeicher } from './hilfen.js';

test('Unterstützen: ohne gültige https-Adresse gibt es keinen Bereich', () => {
  assert.equal(ladeUnterstuetzung({}), null);
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'http://ko-fi.com/x' }), null);
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'javascript:alert(1)' }), null);
});

test('Unterstützen: Einstellungen aus der .env, Zahlen mit Komma, Standardwerte', () => {
  const e = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '120,5', SUPPORT_RAISED: '30', SUPPORT_BUTTON_DE: 'Hilf mit' });
  assert.equal(e.ziel, 120.5);
  assert.equal(e.basis, 30);
  assert.equal(e.waehrung, 'EUR');
  assert.equal(e.button.de, 'Hilf mit');
  assert.equal(e.text.de, null);
  assert.equal(e.webhook, false);
  assert.equal(ladeUnterstuetzung({ SUPPORT_URL: 'https://x.de', SUPPORT_GOAL: 'abc' }).ziel, 0);
});

test('Unterstützen: Webhook prüft den Token, zählt jede Nachricht einmal und ignoriert andere Währungen', () => {
  const { s: db } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '100', SUPPORT_RAISED: '10', KOFI_VERIFICATION_TOKEN: 'geheim' });
  const opt = { token: 'geheim', waehrung: 'EUR' };
  const body = (d) => ({ data: JSON.stringify({ verification_token: 'geheim', message_id: 'a1', amount: '5.00', currency: 'EUR', from_name: 'Anna', email: 'a@b.de', ...d }) });

  assert.equal(verarbeiteWebhook(db, body({ verification_token: 'falsch' }), opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, { data: 'kein json' }, opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, {}, opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, body({}), opt), 'gespeichert');
  assert.equal(verarbeiteWebhook(db, body({}), opt), 'doppelt');
  assert.match(verarbeiteWebhook(db, body({ message_id: 'a2', currency: 'USD' }), opt), /^ignoriert/);
  assert.match(verarbeiteWebhook(db, body({ message_id: 'a3', amount: '0' }), opt), /^ignoriert/);
  assert.equal(verarbeiteWebhook(db, body({ message_id: 'a4', amount: '2,50' }), opt), 'gespeichert');

  assert.equal(oeffentlicheAngaben(db, einst).erreicht, 17.5); // 10 von Hand + 5 + 2,5
  assert.equal(oeffentlicheAngaben(db, null), null);
  // keine Namen oder Adressen gespeichert
  assert.deepEqual(Object.keys(db.lokal.lies('unterstuetzung', [])[0]).sort(), ['betrag', 'erhalten_am', 'nachricht_id', 'waehrung']);
});

test('Unterstützen: bei zeitraum monat zählt nur der laufende Kalendermonat (Zeit in Deutschland)', () => {
  const { s: db } = neuerSpeicher();
  db.lokal.schreibe('unterstuetzung', [
    { nachricht_id: 'a', betrag: 10, waehrung: 'EUR', erhalten_am: '2026-10-31 22:30:00' }, // 31.10. 23:30 in Deutschland: noch Oktober
    { nachricht_id: 'b', betrag: 5, waehrung: 'EUR', erhalten_am: '2026-10-31 23:30:00' },  // 1.11. 00:30: November
    { nachricht_id: 'c', betrag: 2.5, waehrung: 'EUR', erhalten_am: '2026-11-12 08:00:00' }
  ]);
  const alle = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '35' });
  const monat = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '35', SUPPORT_PERIOD: 'monat' });
  assert.equal(alle.zeitraum, 'gesamt');
  assert.equal(oeffentlicheAngaben(db, alle, new Date('2026-11-15T12:00:00Z')).erreicht, 17.5);
  assert.equal(oeffentlicheAngaben(db, monat, new Date('2026-11-15T12:00:00Z')).erreicht, 7.5);
  assert.equal(oeffentlicheAngaben(db, monat, new Date('2026-12-01T12:00:00Z')).erreicht, 0); // neuer Monat, Balken leer
});
