import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashPasswort, anmelden, _intern } from '../lib/auth.js';
import { sicherheitsHeader, fehlerAntwort, CSP } from '../lib/sicherheit.js';
import { anzeigename, ladeUnterstuetzung, legeUnterstuetzerAn, traegeEingangEin, verarbeiteWebhook, oeffentlicheAngaben } from '../lib/unterstuetzung.js';
import { liesVerzeichnis } from '../lib/speicher.js';
import { legeMeldungAn } from '../lib/meldungen.js';
import { FehlerEingabe, anlegenMaterial } from '../lib/admin.js';
import { neuerSpeicher, tempOrdner } from './hilfen.js';

const PASSWORT = 'sicheres-test-passwort-123';

beforeEach(() => {
  _intern.reset();
  process.env.ADMIN_PASSWORD_HASH = hashPasswort(PASSWORT);
});

test('Anmeldung: die Sperre gilt nur für die Adresse mit den Fehlversuchen, nicht für alle', () => {
  for (let i = 0; i < 4; i++) assert.equal(anmelden('falsch', '1.1.1.1').grund, 'falsch');
  assert.equal(anmelden('falsch', '1.1.1.1').grund, 'gesperrt');
  assert.equal(anmelden(PASSWORT, '1.1.1.1').grund, 'gesperrt');   // auch das richtige Passwort hilft dieser Adresse nicht
  assert.equal(anmelden(PASSWORT, '2.2.2.2').ok, true);            // der Betreiber kommt von einer anderen Adresse weiter hinein
});

test('Anmeldung: sehr viele Fehlversuche von vielen Adressen sperren insgesamt; sehr lange Passwörter und Nicht-Texte werden abgelehnt', () => {
  for (let i = 0; i < 60; i++) anmelden('falsch', `10.0.${Math.floor(i / 250)}.${i % 250}`);
  assert.equal(anmelden(PASSWORT, '9.9.9.9').grund, 'gesperrt');
  _intern.reset();
  assert.equal(anmelden('x'.repeat(5000), '1.1.1.1').grund, 'falsch');
  assert.equal(anmelden({ $ne: 1 }, '1.1.1.1').grund, 'falsch');
});

test('Anmeldung: höchstens 20 Sitzungen gleichzeitig, die älteste fällt heraus', () => {
  const tokens = [];
  for (let i = 0; i < 25; i++) tokens.push(anmelden(PASSWORT, `3.3.3.${i}`).token);
  assert.equal(_intern.sitzungen.size, 20);
  assert.ok(!_intern.sitzungen.has(tokens[0]));
  assert.ok(_intern.sitzungen.has(tokens[24]));
});

async function starte() {
  const app = express();
  app.set('query parser', 'simple');
  app.use(sicherheitsHeader);
  app.use(express.json({ limit: '1kb' }));
  app.post('/api/admin/x', (req, res) => res.json({ ok: true }));
  app.get('/', (req, res) => res.send('ok'));
  app.use(fehlerAntwort);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test('Header: Content-Security-Policy ohne Inline-Skripte, kein Einbetten, kein Zwischenspeichern der Admin-Antworten', async () => {
  const basis = await starte();
  const r = await fetch(`${basis}/`);
  assert.equal(r.headers.get('content-security-policy'), CSP);
  assert.match(CSP, /script-src 'self'(;|$)/);
  assert.match(CSP, /frame-ancestors 'none'/);
  assert.doesNotMatch(CSP, /script-src[^;]*unsafe-inline/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(r.headers.get('cache-control'), null);
  const admin = await fetch(`${basis}/api/admin/x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(admin.headers.get('cache-control'), 'no-store');
});

test('Fehler: kaputtes JSON und zu große Anfragen ergeben eine kurze JSON-Antwort ohne Interna', async () => {
  const basis = await starte();
  const kaputt = await fetch(`${basis}/api/admin/x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ kein json' });
  assert.equal(kaputt.status, 400);
  assert.deepEqual(await kaputt.json(), { error: 'Ungültige Anfrage' });
  const gross = await fetch(`${basis}/api/admin/x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a: 'x'.repeat(5000) }) });
  assert.equal(gross.status, 413);
  assert.deepEqual(await gross.json(), { error: 'Die Anfrage ist zu groß.' });
});

test('Anzeigename: Steuer- und Richtungszeichen und Internetadressen werden nicht übernommen', () => {
  assert.equal(anzeigename('  Anna   Müller '), 'Anna Müller');
  assert.equal(anzeigename('Eve‮nohtyp'), 'Evenohtyp');            // Richtungsumkehr entfernt
  assert.equal(anzeigename('A\u0000B​c'), 'ABc');
  assert.equal(anzeigename('Kaufe jetzt auf www.example.org'), null);
  assert.equal(anzeigename('https://example.org'), null);
  assert.equal(anzeigename('   '), null);
  assert.equal(anzeigename('x'.repeat(100)).length, 60);
});

test('Anzeigename: Verwaltung und Melder bekommen eine klare Meldung, Ko-fi-Beiträge zählen trotzdem anonym', () => {
  const { s: db, kat } = neuerSpeicher();
  const einst = ladeUnterstuetzung({ SUPPORT_URL: 'https://ko-fi.com/x', KOFI_VERIFICATION_TOKEN: 't' });
  assert.throws(() => legeUnterstuetzerAn(db, { name: 'www.spam.example', zustimmung: true }), FehlerEingabe);
  assert.throws(() => traegeEingangEin(db, einst, { quelle: 'paypal', datum: '2026-11-10', betrag: '5', name: 'http://x', zustimmung: true }, new Date('2026-11-12')), FehlerEingabe);

  const material = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat, status: 'veroeffentlicht' });
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'x', melder_name: 'https://spam.example' }), /Internetadresse/);
  assert.doesNotThrow(() => legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'x', melder_name: 'Anna' }));

  const body = { data: JSON.stringify({ verification_token: 't', message_id: 'z1', amount: '5', currency: 'EUR', from_name: 'Besuche www.spam.example', is_public: true }) };
  assert.equal(verarbeiteWebhook(db, body, { token: 't', waehrung: 'EUR' }), 'gespeichert');
  const a = oeffentlicheAngaben(db, einst);
  assert.deepEqual(a.unterstuetzer, []);
  assert.equal(a.erreicht, 5);
});

test('Daten: symbolische Links im Datenverzeichnis werden nicht gelesen', (t) => {
  const ordner = tempOrdner();
  mkdirSync(join(ordner, 'materialien'), { recursive: true });
  writeFileSync(join(ordner, 'kategorien.json'), '[{"id":1,"slug":"holz","name_de":"Holz"}]');
  writeFileSync(join(ordner, 'geheim.txt'), 'GEHEIMER INHALT');
  try {
    symlinkSync(join(ordner, 'geheim.txt'), join(ordner, 'unterstuetzer.json'));
    symlinkSync(join(ordner, 'geheim.txt'), join(ordner, 'materialien', 'x-1.json'));
  } catch (e) {
    if (e.code === 'EPERM') return t.skip('Symbolische Links lassen sich hier nicht anlegen');
    throw e;
  }
  const r = liesVerzeichnis(ordner);
  assert.ok(r.fehler.length >= 2);
  assert.ok(r.fehler.every(f => /Symbolische Links/.test(f.text)));
  assert.ok(!JSON.stringify(r.fehler).includes('GEHEIMER'));
});
