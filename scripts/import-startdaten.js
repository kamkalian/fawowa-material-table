// Einmaliges Einspielen der Startdaten aus docs/startdaten.csv in die Datenbank.
//
// Aufruf:  node scripts/import-startdaten.js
// Bricht ab, wenn bereits Materialien in der Datenbank stehen, damit nichts doppelt eingespielt wird.

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { openDb, createKategorie, createEigenschaft, createMaterial, DB_PATH } from '../lib/db.js';
import { ICON_NACH_SLUG } from '../lib/icons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '..', 'docs', 'startdaten.csv');
const QUELLE = 'https://fahrradwagen.com/d/536-gewichte-der-verschiedenen-baustoffe/27';
const ERWARTETE_ANZAHL = 61;

// --- Kategorien (Reihenfolge wie im Plan) ---
const KATEGORIEN = [
  { slug: 'holz', de: 'Holz', en: 'Wood' },
  { slug: 'metall', de: 'Metall', en: 'Metal' },
  { slug: 'schaum-daemmung', de: 'Schaum und Dämmung', en: 'Foam and insulation' },
  { slug: 'kunststoff', de: 'Kunststoff', en: 'Plastic' },
  { slug: 'verbundplatte', de: 'Verbundplatte', en: 'Composite panel' },
  { slug: 'textil', de: 'Textil', en: 'Textile' },
  { slug: 'staebe-leisten', de: 'Stäbe, Leisten und Sonstiges', en: 'Rods, strips and other' }
];

// Kategorien der CSV, die zu einer anderen Kategorie gehören
const KATEGORIE_ALIAS = { 'Sperrholz': 'Holz' };

// --- Eigenschaften: Kurzwort bleibt fest, auch wenn der Anzeigename sich ändert ---
const EIGENSCHAFTEN = [
  { kurzwort: 'staerke', name_de: 'Stärke', name_en: 'Thickness', typ: 'zahl', standard_einheit: 'mm', reihenfolge: 1, standard_sichtbar: true },
  { kurzwort: 'gewicht', name_de: 'Flächengewicht', name_en: 'Area weight', typ: 'zahl', standard_einheit: 'kg/m²', reihenfolge: 2, standard_sichtbar: true },
  { kurzwort: 'waermewert', name_de: 'Wärmewert', name_en: 'Thermal value', typ: 'zahl', standard_einheit: 'W/(m·K)', reihenfolge: 3, standard_sichtbar: true },
  { kurzwort: 'laenge', name_de: 'Länge', name_en: 'Length', typ: 'zahl', standard_einheit: 'm', reihenfolge: 10 },
  { kurzwort: 'durchmesser', name_de: 'Durchmesser', name_en: 'Diameter', typ: 'zahl', standard_einheit: 'mm', reihenfolge: 11 },
  { kurzwort: 'stueckgewicht', name_de: 'Stückgewicht', name_en: 'Weight per piece', typ: 'zahl', standard_einheit: 'g', reihenfolge: 12 },
  { kurzwort: 'gewicht_meter', name_de: 'Gewicht pro Meter', name_en: 'Weight per metre', typ: 'zahl', standard_einheit: 'kg/m', reihenfolge: 13 }
];

// --- Englische Erstfassungen der Materialnamen. Markennamen bleiben unverändert. ---
const NAME_EN = {
  'Polsterstoff': 'Upholstery fabric',
  'Polsterstoff gesteppt': 'Quilted upholstery fabric',
  'GFK-Platte': 'GRP sheet',
  'Schaumstoff': 'Foam',
  'Carbon-Platte': 'Carbon sheet',
  'Schafwolle-Dämmplatte': 'Sheep wool insulation board',
  'Aluminiumblech': 'Aluminium sheet',
  'Flugzeugsperrholz Birke': 'Birch aircraft plywood',
  'Hohlkammerplatte Polycarbonat': 'Polycarbonate twinwall sheet',
  'Hohlkammerplatte Polypropylen': 'Polypropylene twinwall sheet',
  'Polyester-Flachbahn': 'Polyester flat strip',
  'Schafwolle Jurtefilz': 'Sheep wool yurt felt',
  'Pappelsperrholz': 'Poplar plywood',
  'Rotholz Sperrholz WBP': 'Rotholz plywood WBP',
  'Polycarbonat UV klar': 'Polycarbonate UV clear',
  'Sperrholz Kiefer': 'Pine plywood',
  'Okoume Sperrholz': 'Okoume plywood',
  'Siebdruckplatte Pappel': 'Poplar film-faced plywood',
  'Siebdruckplatte': 'Film-faced plywood',
  'Gabun Sperrholz': 'Gaboon plywood',
  'Paulownia Leimholzplatte': 'Paulownia glued panel',
  'OSB-Platte': 'OSB board',
  'Vollholz Kiefer': 'Solid pine',
  'PVC Hartschaumplatte': 'PVC rigid foam board'
};

const VERMERK = { 'ungeprüft': { de: 'ungeprüft', en: 'unverified' } };

// Die CSV-Datei liegt doppelt kodiert vor (UTF-8 als Windows-1252 gelesen, z. B. "ÃŸ" statt "ß").
// Diese Funktion macht das rückgängig. Ohne Fehlkodierung bleibt der Text unverändert.
function repairEncoding(text) {
  return /[ÃÂ]/.test(text) ? Buffer.from(text, 'latin1').toString('utf8') : text;
}

// CSV mit Anführungszeichen, ohne Zeilenumbrüche in Feldern
function parseCsv(text) {
  const zeilen = text.split(/\r?\n/).filter(z => z.trim() !== '');
  const split = (zeile) => {
    const felder = [];
    let feld = '';
    let inQuotes = false;
    for (let i = 0; i < zeile.length; i++) {
      const c = zeile[i];
      if (inQuotes) {
        if (c === '"' && zeile[i + 1] === '"') { feld += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else feld += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { felder.push(feld); feld = ''; }
      else feld += c;
    }
    felder.push(feld);
    return felder.map(f => f.trim());
  };
  const [kopf, ...daten] = zeilen.map(split);
  return daten.map(felder => Object.fromEntries(kopf.map((k, i) => [k, felder[i] ?? ''])));
}

function zahl(text) {
  if (text === '') return null;
  const n = Number(text.replace(',', '.'));
  if (Number.isNaN(n)) throw new Error(`Keine Zahl: "${text}"`);
  return n;
}

function main() {
  const db = openDb();
  const vorhanden = db.prepare('SELECT COUNT(*) AS n FROM material').get().n;
  if (vorhanden > 0) {
    console.error(`Abbruch: In ${DB_PATH} stehen schon ${vorhanden} Materialien. Das Skript läuft nur auf einer leeren Datenbank.`);
    process.exit(1);
  }

  const zeilen = parseCsv(repairEncoding(readFileSync(CSV_PATH, 'utf8')));
  if (zeilen.length !== ERWARTETE_ANZAHL) {
    console.warn(`Hinweis: ${zeilen.length} Zeilen in der CSV, erwartet waren ${ERWARTETE_ANZAHL}.`);
  }

  db.transaction(() => {
    const kategorieIds = new Map();
    KATEGORIEN.forEach((k, i) => {
      kategorieIds.set(k.de, createKategorie(db, {
        slug: k.slug, name_de: k.de, name_en: k.en, icon: ICON_NACH_SLUG[k.slug] ?? null, reihenfolge: i + 1
      }));
    });
    EIGENSCHAFTEN.forEach(e => createEigenschaft(db, e));

    for (const z of zeilen) {
      // Sperrholz ist keine eigene Kategorie, sondern gehört zu Holz
      const kategorie_id = kategorieIds.get(KATEGORIE_ALIAS[z.kategorie] ?? z.kategorie);
      if (!kategorie_id) throw new Error(`Unbekannte Kategorie "${z.kategorie}" bei ${z.name}`);

      const vermerk = z.vermerk ? (VERMERK[z.vermerk] ?? { de: z.vermerk, en: null }) : null;
      const werte = {};

      const staerke = zahl(z.staerke_mm);
      if (staerke !== null) werte.staerke = { zahl: staerke, einheit: 'mm', vermerk_de: vermerk?.de, vermerk_en: vermerk?.en };

      const gewicht = zahl(z.gewicht_kg_m2);
      if (gewicht !== null) werte.gewicht = { zahl: gewicht, einheit: 'kg/m²', vermerk_de: vermerk?.de, vermerk_en: vermerk?.en };

      const waermewert = zahl(z.waermewert);
      if (waermewert !== null) {
        werte.waermewert = {
          zahl: waermewert,
          einheit: z.waermewert_einheit || 'W/(m·K)',
          vermerk_de: vermerk?.de,
          vermerk_en: vermerk?.en
        };
      }

      createMaterial(db, {
        name_de: z.name,
        name_en: NAME_EN[z.name] ?? null,
        kategorie_id,
        notiz_de: z.notiz || null,
        status: 'veroeffentlicht'
      }, werte, [{ beschriftung: 'Quelle (Forum)', url: QUELLE }]);
    }
  })();

  const anzahl = db.prepare('SELECT COUNT(*) AS n FROM material').get().n;
  console.log(`Fertig: ${anzahl} Materialien in ${DB_PATH} eingespielt.`);
  db.close();
}

main();
