import test from 'node:test';
import assert from 'node:assert/strict';
import { ladeUnterstuetzung, oeffentlicheAngaben, verarbeiteWebhook } from '../lib/unterstuetzung.js';
import { openDb } from '../lib/db.js';

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
  const db = openDb(':memory:');
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', SUPPORT_GOAL: '100', SUPPORT_RAISED: '10', KOFI_VERIFICATION_TOKEN: 'geheim' });
  const opt = { token: 'geheim', waehrung: 'EUR' };
  const body = (d) => ({ data: JSON.stringify({ verification_token: 'geheim', message_id: 'a1', amount: '5.00', currency: 'EUR', from_name: 'Anna', email: 'a@b.de', ...d }) });

  assert.equal(verarbeiteWebhook(db, body({ verification_token: 'falsch' }), opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, { data: 'kein json' }, opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, {}, opt), 'ungueltig');
  assert.equal(verarbeiteWebhook(db, body({}), opt), 'gespeichert');
  assert.equal(verarbeiteWebhook(db, body({}), opt), 'doppelt');
  assert.equal(verarbeiteWebhook(db, body({ message_id: 'a2', currency: 'USD' }), opt), 'ignoriert');
  assert.equal(verarbeiteWebhook(db, body({ message_id: 'a3', amount: '0' }), opt), 'ignoriert');
  assert.equal(verarbeiteWebhook(db, body({ message_id: 'a4', amount: '2,50' }), opt), 'gespeichert');

  assert.equal(oeffentlicheAngaben(db, einst).erreicht, 17.5); // 10 von Hand + 5 + 2,5
  assert.equal(oeffentlicheAngaben(db, null), null);
  // keine Namen oder Adressen in der Datenbank
  assert.deepEqual(Object.keys(db.prepare('SELECT * FROM unterstuetzung').get()).sort(), ['betrag', 'erhalten_am', 'nachricht_id', 'waehrung']);
});
