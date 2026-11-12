import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefeUrl, istPrivateAdresse, pruefeAlleLinks } from '../lib/linkpruefung.js';
import { openDb } from '../lib/db.js';

const oeffentlich = async () => ['93.184.216.34'];
const antwort = (status, location) => ({ status, headers: { get: (n) => (n === 'location' ? location ?? null : null) } });
const mitStatus = (...status) => {
  const aufrufe = [];
  const fetchFn = async (url, opt) => { aufrufe.push(`${opt.method} ${url}`); return status.length > 1 ? status.shift() : status[0]; };
  return { fetchFn, aufrufe };
};

test('Link-Prüfung: private und lokale Adressen werden erkannt', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1', '169.254.1.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(istPrivateAdresse(ip), true, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::1111']) assert.equal(istPrivateAdresse(ip), false, ip);
});

test('Link-Prüfung: 200 ist ok, 404 und 500 sind kaputt, 403 und 429 unklar', async () => {
  const pruefe = (s) => pruefeUrl('https://example.org/a', { fetchFn: mitStatus(antwort(s)).fetchFn, aufloesen: oeffentlich });
  assert.equal(await pruefe(200), 'ok');
  assert.equal(await pruefe(404), 'kaputt');
  assert.equal(await pruefe(500), 'kaputt');
  assert.equal(await pruefe(429), 'unklar');
});

test('Link-Prüfung: bei HEAD-Fehler wird GET versucht, Umleitungen werden verfolgt', async () => {
  const { fetchFn, aufrufe } = mitStatus(antwort(405), antwort(301, '/neu'), antwort(200));
  assert.equal(await pruefeUrl('https://example.org/alt', { fetchFn, aufloesen: oeffentlich }), 'ok');
  assert.deepEqual(aufrufe, ['HEAD https://example.org/alt', 'GET https://example.org/alt', 'HEAD https://example.org/neu']);
});

test('Link-Prüfung: Umleitung ins lokale Netz, falsches Schema, Endlosschleife und Netzwerkfehler sind kaputt', async () => {
  const aufloesen = async (h) => (h === 'intern.example' ? ['10.0.0.1'] : ['93.184.216.34']);
  const umleitung = mitStatus(antwort(302, 'http://intern.example/'));
  assert.equal(await pruefeUrl('https://example.org/', { fetchFn: umleitung.fetchFn, aufloesen }), 'kaputt');
  assert.equal(umleitung.aufrufe.length, 1);                                    // das interne Ziel wurde nie abgefragt
  assert.equal(await pruefeUrl('ftp://example.org/', { fetchFn: mitStatus(antwort(200)).fetchFn, aufloesen }), 'kaputt');
  assert.equal(await pruefeUrl('http://localhost:3000/', { fetchFn: mitStatus(antwort(200)).fetchFn, aufloesen }), 'kaputt');
  assert.equal(await pruefeUrl('https://example.org/', { fetchFn: mitStatus(antwort(302, '/')).fetchFn, aufloesen }), 'kaputt');
  assert.equal(await pruefeUrl('https://example.org/', { fetchFn: async () => { throw new Error('ECONNREFUSED'); }, aufloesen }), 'kaputt');
  assert.equal(await pruefeUrl('kein link', { fetchFn: mitStatus(antwort(200)).fetchFn, aufloesen }), 'kaputt');
});

test('Link-Prüfung: Ergebnisse werden in der Datenbank gespeichert', async () => {
  const db = openDb(':memory:');
  const k = db.prepare("INSERT INTO kategorie (slug, name_de) VALUES ('t', 'T')").run().lastInsertRowid;
  const m = db.prepare("INSERT INTO material (name_de, kategorie_id, status) VALUES ('M', ?, 'veroeffentlicht')").run(k).lastInsertRowid;
  const insert = db.prepare('INSERT INTO link (material_id, beschriftung, url) VALUES (?, ?, ?)');
  insert.run(m, 'gut', 'https://example.org/gut');
  insert.run(m, 'weg', 'https://example.org/weg');
  const fetchFn = async (url) => antwort(String(url).endsWith('gut') ? 200 : 404);
  assert.deepEqual(await pruefeAlleLinks(db, { fetchFn, aufloesen: oeffentlich }), { ok: 1, unklar: 0, kaputt: 1 });
  assert.deepEqual(db.prepare('SELECT beschriftung, status FROM link ORDER BY id').all().map(l => [l.beschriftung, l.status]), [['gut', 'ok'], ['weg', 'kaputt']]);
});
