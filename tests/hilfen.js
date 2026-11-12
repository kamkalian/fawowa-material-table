// Gemeinsame Hilfen für die Tests: ein frischer Speicher in einem Temp-Ordner, optional mit echtem Git.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Speicher } from '../lib/speicher.js';
import { Git } from '../lib/git.js';
import { anlegenKategorie, anlegenEigenschaft, setzeOptionen } from '../lib/admin.js';

const ordnerListe = [];
process.on('exit', () => { for (const o of ordnerListe) rmSync(o, { recursive: true, force: true }); });

export function tempOrdner(praefix = 'test-') {
  const o = mkdtempSync(join(tmpdir(), praefix));
  ordnerListe.push(o);
  return o;
}

/** Speicher mit Kategorie "holz" und fünf Eigenschaften; mitGit = true legt zusätzlich ein Git-Verzeichnis an */
export function neuerSpeicher({ mitGit = false, remote = null } = {}) {
  const ordner = tempOrdner();
  const verzeichnis = join(ordner, 'repo');
  const git = mitGit ? new Git({ verzeichnis, remote }) : null;
  git?.bereitstellen();
  const s = new Speicher({ verzeichnis, git, lokal: join(ordner, 'lokal') });
  s.laden();

  const kat = anlegenKategorie(s, { name_de: 'Holz', name_en: 'Wood', slug: 'holz' });
  anlegenEigenschaft(s, { kurzwort: 'staerke', name_de: 'Stärke', typ: 'zahl', standard_einheit: 'mm', standard_sichtbar: true });
  anlegenEigenschaft(s, { kurzwort: 'gewicht', name_de: 'Gewicht', typ: 'zahl', standard_einheit: 'kg/m²' });
  anlegenEigenschaft(s, { kurzwort: 'wasserfest', name_de: 'Wasserfest', typ: 'ja_nein' });
  const brand = anlegenEigenschaft(s, { kurzwort: 'brand', name_de: 'Brandklasse', typ: 'auswahl' });
  setzeOptionen(s, brand, [{ de: 'B1' }]);
  anlegenEigenschaft(s, { kurzwort: 'laenge', name_de: 'Länge', typ: 'zahl', standard_einheit: 'm' });
  return { s, db: s, kat, ordner, verzeichnis };
}
