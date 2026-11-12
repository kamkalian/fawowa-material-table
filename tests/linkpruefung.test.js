import test from 'node:test';
import assert from 'node:assert/strict';
import { pruefeUrl, istPrivateAdresse, pruefeAlleLinks } from '../lib/linkpruefung.js';
const sofort = async () => {};
import { neuerSpeicher } from './hilfen.js';
import { anlegenMaterial, setzeLinks } from '../lib/admin.js';

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
  const pruefe = (s) => pruefeUrl('https://example.org/a', { fetchFn: mitStatus(antwort(s)).fetchFn, aufloesen: oeffentlich, warte: sofort });
  assert.equal(await pruefe(200), 'ok');
  assert.equal(await pruefe(404), 'kaputt');
  assert.equal(await pruefe(500), 'kaputt');
  assert.equal(await pruefe(429), 'unklar');
});

test('Link-Prüfung: bei HEAD-Fehler wird GET versucht, Umleitungen werden verfolgt', async () => {
  const { fetchFn, aufrufe } = mitStatus(antwort(405), antwort(301, '/neu'), antwort(200));
  assert.equal(await pruefeUrl('https://example.org/alt', { fetchFn, aufloesen: oeffentlich, warte: sofort }), 'ok');
  assert.deepEqual(aufrufe, ['HEAD https://example.org/alt', 'GET https://example.org/alt', 'HEAD https://example.org/neu']);
});

test('Link-Prüfung: Umleitung ins lokale Netz, falsches Schema, Endlosschleife und Netzwerkfehler sind kaputt', async () => {
  const aufloesen = async (h) => (h === 'intern.example' ? ['10.0.0.1'] : ['93.184.216.34']);
  const umleitung = mitStatus(antwort(302, 'http://intern.example/'));
  assert.equal(await pruefeUrl('https://example.org/', { fetchFn: umleitung.fetchFn, aufloesen, warte: sofort }), 'kaputt');
  assert.ok(umleitung.aufrufe.every(a => !a.includes('intern.example')));       // das interne Ziel wurde nie abgefragt (nur die erste Adresse, wiederholt)
  assert.equal(await pruefeUrl('ftp://example.org/', { fetchFn: mitStatus(antwort(200)).fetchFn, aufloesen, warte: sofort }), 'kaputt');
  assert.equal(await pruefeUrl('http://localhost:3000/', { fetchFn: mitStatus(antwort(200)).fetchFn, aufloesen, warte: sofort }), 'kaputt');
  assert.equal(await pruefeUrl('https://example.org/', { fetchFn: mitStatus(antwort(302, '/')).fetchFn, aufloesen, warte: sofort }), 'kaputt');
  assert.equal(await pruefeUrl('https://example.org/', { fetchFn: async () => { throw new Error('ECONNREFUSED'); }, aufloesen, warte: sofort }), 'kaputt');
  assert.equal(await pruefeUrl('kein link', { fetchFn: mitStatus(antwort(200)).fetchFn, aufloesen, warte: sofort }), 'kaputt');
});

function speicherMitLinks(links) {
  const { s: speicher, kat } = neuerSpeicher();
  const m = anlegenMaterial(speicher, { name_de: 'M', kategorie_id: kat, status: 'veroeffentlicht' });
  setzeLinks(speicher, m, links);
  return speicher;
}

test('Link-Prüfung: Ergebnisse werden je Adresse lokal gespeichert und erscheinen in der Übersicht', async () => {
  const { listeLinks, zaehleKaputte } = await import('../lib/linkpruefung.js');
  const speicher = speicherMitLinks([{ beschriftung: 'gut', url: 'https://example.org/gut' }, { beschriftung: 'weg', url: 'https://example.org/weg' }]);
  const fetchFn = async (url) => antwort(String(url).endsWith('gut') ? 200 : 404);
  assert.deepEqual(await pruefeAlleLinks(speicher, { fetchFn, aufloesen: oeffentlich, warte: sofort }), { ok: 1, unklar: 0, kaputt: 1 });
  assert.deepEqual(listeLinks(speicher).map(l => [l.beschriftung, l.status]), [['weg', 'kaputt'], ['gut', 'ok']]);
  assert.equal(zaehleKaputte(speicher), 1);
});

test('Link-Übersicht: kaputte zuerst, dann unklare, ungeprüfte und erreichbare', async () => {
  const { listeLinks } = await import('../lib/linkpruefung.js');
  const speicher = speicherMitLinks(['a', 'b', 'c', 'd'].map(x => ({ beschriftung: x, url: `https://${x}.example` })));
  speicher.lokal.schreibe('linkstatus', {
    'https://a.example': { status: 'ok', geprueft_am: '2026-01-01 10:00:00' },
    'https://c.example': { status: 'kaputt', geprueft_am: '2026-01-01 10:00:00' },
    'https://d.example': { status: 'unklar', geprueft_am: '2026-01-01 10:00:00' }
  });
  assert.deepEqual(listeLinks(speicher).map(l => l.beschriftung), ['c', 'd', 'b', 'a']);
});

test('Link-Status bleibt beim Ändern der Links erhalten, nicht mehr vorhandene Adressen fallen nach der nächsten Prüfung weg', async () => {
  const speicher = speicherMitLinks([{ beschriftung: 'x', url: 'https://example.org/x' }]);
  const fetchFn = async () => antwort(200);
  await pruefeAlleLinks(speicher, { fetchFn, aufloesen: oeffentlich, warte: sofort });
  const m = speicher.materialien[0];
  setzeLinks(speicher, m.id, [{ beschriftung: 'umbenannt', url: 'https://example.org/x' }]);
  assert.equal(speicher.lokal.lies('linkstatus', {})['https://example.org/x'].status, 'ok');
  setzeLinks(speicher, m.id, [{ beschriftung: 'neu', url: 'https://example.org/y' }]);
  await pruefeAlleLinks(speicher, { fetchFn, aufloesen: oeffentlich, warte: sofort });
  assert.deepEqual(Object.keys(speicher.lokal.lies('linkstatus', {})), ['https://example.org/y']);
});

test('Link-Prüfung: ein kurzer Ausfall zählt nicht, nur drei Fehlversuche hintereinander', async () => {
  const wartezeiten = [];
  const warte = async (ms) => { wartezeiten.push(ms); };
  const kurz = mitStatus(antwort(503), antwort(503), antwort(200));
  assert.equal(await pruefeUrl('https://example.org/a', { fetchFn: kurz.fetchFn, aufloesen: oeffentlich, warte }), 'ok');
  assert.equal(wartezeiten.length, 2);
  const dauer = mitStatus(antwort(404));
  assert.equal(await pruefeUrl('https://example.org/a', { fetchFn: dauer.fetchFn, aufloesen: oeffentlich, warte }), 'kaputt');
  assert.equal(dauer.aufrufe.filter(a => a.startsWith('HEAD')).length, 3);
});
