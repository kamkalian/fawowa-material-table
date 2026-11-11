import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminPfad, STANDARD_ADMIN_PFAD } from '../lib/pfade.js';

const stumm = () => {};

test('Standard ist ein Fantasiename, nicht /admin', () => {
  assert.equal(adminPfad({}, stumm), '/wunderkammer');
  assert.equal(STANDARD_ADMIN_PFAD, '/wunderkammer');
  assert.notEqual(STANDARD_ADMIN_PFAD, '/admin');
});

test('ADMIN_PATH wird übernommen, mit oder ohne Schrägstrich, klein geschrieben', () => {
  assert.equal(adminPfad({ ADMIN_PATH: 'meine-werkstatt' }, stumm), '/meine-werkstatt');
  assert.equal(adminPfad({ ADMIN_PATH: '/Zauber-Kiste ' }, stumm), '/zauber-kiste');
});

test('Ungültige oder reservierte Angaben fallen auf den Standard zurück und warnen', () => {
  const warnungen = [];
  const w = (t) => warnungen.push(t);
  for (const schlecht of ['admin', '/api', 'assets', 'ab', 'mit leerzeichen', 'a/b', 'ä-pfad', '-anfang', 'x'.repeat(41), 'admin.html']) {
    assert.equal(adminPfad({ ADMIN_PATH: schlecht }, w), '/wunderkammer', schlecht);
  }
  assert.equal(warnungen.length, 10);
});
