// Datenspeicher: Die Materialdaten liegen als Dateien in einem Git-Verzeichnis, im Betrieb werden sie im Speicher gehalten.
//
//   kategorien.json            Liste der Kategorien (Reihenfolge = Reihenfolge der Liste)
//   eigenschaften.json         Liste der Eigenschaften mit ihren Auswahlmöglichkeiten
//   materialien/<name>-<id>.json   eine Datei je Material, mit Werten und Links
//   unterstuetzer.json         Liste der Unterstützer (Anzeigename, Abzeichen, Zustimmung); keine Beträge
//
// Zahlen-IDs stehen in den Dateien, damit Adressen wie ?m=12 stabil bleiben. Fehlt eine ID (von Hand angelegte Datei),
// vergibt der Server sie beim Laden. Alles, was nicht ins Repo gehört (Meldungen mit Kontaktdaten, Link-Status),
// liegt als JSON im lokalen Ordner.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ICON_NAMEN } from './icons.js';
import { FehlerEingabe } from './fehler.js';
import { ABZEICHEN_IDS, normalisiereAbzeichen } from './abzeichen.js';

export const TYPEN = ['zahl', 'text', 'auswahl', 'ja_nein'];
export const STATUS = ['entwurf', 'veroeffentlicht'];
export const ZUSTIMMUNG_ARTEN = ['manuell', 'kofi-oeffentlich', 'meldung'];
export const KURZWORT = /^[a-z][a-z0-9_]{1,40}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;
const MAX_DATEI = 200 * 1024;
const MAX_LINKS = 20;
const WERT_SCHLUESSEL = ['zahl', 'text', 'ja_nein', 'option', 'optionen', 'einheit', 'vermerk_de', 'vermerk_en'];

const jetzt = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
export const zeitstempel = jetzt;

/** Kleinbuchstaben, Umlaute aufgelöst, nur a-z, 0-9 und Bindestrich */
export function slugify(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

// ---------------------------------------------------------------------------------------------------------------------
// Lesen und Prüfen
// ---------------------------------------------------------------------------------------------------------------------

const istText = (v) => typeof v === 'string' && v.trim() !== '';
const textOderNull = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const istObjekt = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Liest und prüft alle Dateien im Verzeichnis. Liefert { daten, fehler }. Jeder Fehler nennt die Datei und das Problem.
 * Mit streng = false werden einzelne fehlerhafte Materialien übersprungen, sonst gilt die Prüfung als nicht bestanden.
 */
export function liesVerzeichnis(verzeichnis) {
  const fehler = [];
  const melde = (datei, text) => fehler.push({ datei, text });

  const lies = (rel, standard) => {
    const pfad = join(verzeichnis, rel);
    if (!existsSync(pfad)) return standard;
    try {
      if (statSync(pfad).size > MAX_DATEI) { melde(rel, 'Die Datei ist zu groß.'); return standard; }
      return JSON.parse(readFileSync(pfad, 'utf8'));
    } catch (e) {
      melde(rel, `Kein gültiges JSON (${e.message.slice(0, 120)})`);
      return standard;
    }
  };

  // --- Kategorien ---
  const kategorien = [];
  const rohKategorien = lies('kategorien.json', []);
  if (!Array.isArray(rohKategorien)) melde('kategorien.json', 'Erwartet wird eine Liste.');
  for (const [i, k] of (Array.isArray(rohKategorien) ? rohKategorien : []).entries()) {
    const wo = `Eintrag ${i + 1}`;
    if (!istObjekt(k)) { melde('kategorien.json', `${wo}: kein Objekt.`); continue; }
    if (!SLUG.test(k.slug ?? '')) { melde('kategorien.json', `${wo}: „slug“ fehlt oder ist ungültig (nur a-z, 0-9, Bindestrich).`); continue; }
    if (!istText(k.name_de)) { melde('kategorien.json', `${k.slug}: „name_de“ fehlt.`); continue; }
    if (k.icon != null && !ICON_NAMEN.includes(k.icon)) { melde('kategorien.json', `${k.slug}: Icon „${k.icon}“ ist unbekannt.`); continue; }
    if (kategorien.some(x => x.slug === k.slug)) { melde('kategorien.json', `${k.slug}: doppelt.`); continue; }
    kategorien.push({
      id: Number.isInteger(k.id) && k.id > 0 ? k.id : null, slug: k.slug, name_de: k.name_de.trim(),
      name_en: textOderNull(k.name_en), icon: k.icon ?? null, reihenfolge: kategorien.length + 1
    });
  }

  // --- Eigenschaften ---
  const eigenschaften = [];
  const rohEigenschaften = lies('eigenschaften.json', []);
  if (!Array.isArray(rohEigenschaften)) melde('eigenschaften.json', 'Erwartet wird eine Liste.');
  for (const [i, e] of (Array.isArray(rohEigenschaften) ? rohEigenschaften : []).entries()) {
    const wo = `Eintrag ${i + 1}`;
    if (!istObjekt(e)) { melde('eigenschaften.json', `${wo}: kein Objekt.`); continue; }
    if (!KURZWORT.test(e.kurzwort ?? '')) { melde('eigenschaften.json', `${wo}: „kurzwort“ fehlt oder ist ungültig.`); continue; }
    if (eigenschaften.some(x => x.kurzwort === e.kurzwort)) { melde('eigenschaften.json', `${e.kurzwort}: doppelt.`); continue; }
    if (!TYPEN.includes(e.typ)) { melde('eigenschaften.json', `${e.kurzwort}: „typ“ muss ${TYPEN.join(', ')} sein.`); continue; }
    if (!istText(e.name_de)) { melde('eigenschaften.json', `${e.kurzwort}: „name_de“ fehlt.`); continue; }
    const optionen = [];
    if (e.optionen != null) {
      if (e.typ !== 'auswahl' || !Array.isArray(e.optionen)) { melde('eigenschaften.json', `${e.kurzwort}: „optionen“ gibt es nur als Liste bei Typ auswahl.`); continue; }
      let ok = true;
      for (const o of e.optionen) {
        if (!istObjekt(o) || !istText(o.de)) { melde('eigenschaften.json', `${e.kurzwort}: jede Option braucht „de“.`); ok = false; break; }
        if (optionen.some(x => x.de === o.de.trim())) { melde('eigenschaften.json', `${e.kurzwort}: Option „${o.de}“ doppelt.`); ok = false; break; }
        optionen.push({ id: Number.isInteger(o.id) && o.id > 0 ? o.id : null, de: o.de.trim(), en: textOderNull(o.en) });
      }
      if (!ok) continue;
    }
    eigenschaften.push({
      id: Number.isInteger(e.id) && e.id > 0 ? e.id : null, kurzwort: e.kurzwort, name_de: e.name_de.trim(), name_en: textOderNull(e.name_en),
      typ: e.typ, standard_einheit: textOderNull(e.standard_einheit), reihenfolge: eigenschaften.length + 1,
      standard_sichtbar: e.standard_sichtbar === true, filterbar: e.filterbar !== false,
      mehrfach: e.typ === 'auswahl' && e.mehrfach === true, optionen
    });
  }

  // --- Materialien ---
  const materialien = [];
  const ordner = join(verzeichnis, 'materialien');
  const dateien = existsSync(ordner) ? readdirSync(ordner).filter(d => !d.startsWith('.')).sort() : [];
  for (const datei of dateien) {
    const rel = `materialien/${datei}`;
    if (!datei.endsWith('.json')) { melde(rel, 'Nur .json-Dateien gehören in diesen Ordner.'); continue; }
    const m = lies(rel, null);
    if (m === null) continue;
    const problem = (text) => melde(rel, text);
    if (!istObjekt(m)) { problem('Erwartet wird ein Objekt.'); continue; }
    if (!istText(m.name_de)) { problem('„name_de“ fehlt.'); continue; }
    const kategorie = kategorien.find(k => k.slug === m.kategorie);
    if (!kategorie) { problem(`Kategorie „${m.kategorie ?? ''}“ gibt es nicht.`); continue; }
    if (m.status != null && !STATUS.includes(m.status)) { problem(`„status“ muss ${STATUS.join(' oder ')} sein.`); continue; }

    let ok = true;
    const werte = {};
    if (m.werte != null && !istObjekt(m.werte)) { problem('„werte“ muss ein Objekt sein.'); continue; }
    for (const [kw, w] of Object.entries(m.werte ?? {})) {
      const e = eigenschaften.find(x => x.kurzwort === kw);
      if (!e) { problem(`Wert „${kw}“: diese Eigenschaft gibt es nicht.`); ok = false; break; }
      if (!istObjekt(w)) { problem(`Wert „${kw}“: erwartet wird ein Objekt.`); ok = false; break; }
      const fremd = Object.keys(w).filter(s => !WERT_SCHLUESSEL.includes(s));
      if (fremd.length) { problem(`Wert „${kw}“: unbekannte Felder ${fremd.join(', ')}.`); ok = false; break; }
      const neu = { zahl: null, text: null, option_ids: [], ja_nein: null, einheit: null, vermerk_de: textOderNull(w.vermerk_de), vermerk_en: textOderNull(w.vermerk_en) };
      if (e.typ === 'zahl') {
        if (w.zahl != null && !(typeof w.zahl === 'number' && Number.isFinite(w.zahl))) { problem(`Wert „${kw}“: „zahl“ muss eine Zahl sein.`); ok = false; break; }
        neu.zahl = w.zahl ?? null;
        neu.einheit = textOderNull(w.einheit);
      } else if (e.typ === 'text') {
        if (w.text != null && typeof w.text !== 'string') { problem(`Wert „${kw}“: „text“ muss Text sein.`); ok = false; break; }
        neu.text = textOderNull(w.text);
      } else if (e.typ === 'ja_nein') {
        if (w.ja_nein != null && typeof w.ja_nein !== 'boolean') { problem(`Wert „${kw}“: „ja_nein“ muss true oder false sein.`); ok = false; break; }
        neu.ja_nein = w.ja_nein ?? null;
      } else {
        if (w.option != null && w.optionen != null) { problem(`Wert „${kw}“: „option“ und „optionen“ gleichzeitig.`); ok = false; break; }
        if (w.optionen != null && !(Array.isArray(w.optionen) && w.optionen.every(x => typeof x === 'string'))) {
          problem(`Wert „${kw}“: „optionen“ muss eine Liste von Texten sein.`); ok = false; break;
        }
        if (e.mehrfach ? w.option != null : w.optionen != null) {
          problem(`Wert „${kw}“: bei dieser Eigenschaft heißt das Feld „${e.mehrfach ? 'optionen' : 'option'}“.`); ok = false; break;
        }
        const gewaehlt = e.mehrfach ? (w.optionen ?? []) : w.option != null ? [w.option] : [];
        if (new Set(gewaehlt).size !== gewaehlt.length) { problem(`Wert „${kw}“: eine Auswahl kommt doppelt vor.`); ok = false; break; }
        for (const name of gewaehlt) {
          const opt = e.optionen.find(o => o.de === name);
          if (!opt) { problem(`Wert „${kw}“: die Auswahl „${name}“ gibt es bei dieser Eigenschaft nicht.`); ok = false; break; }
          neu.option_ids.push(opt);   // wird unten zur ID aufgelöst, sobald die IDs vergeben sind
        }
        if (!ok) break;
      }
      // Felder, die zu einem anderen Typ gehören, sind ein Fehler
      const erlaubt = { zahl: ['zahl', 'einheit'], text: ['text'], ja_nein: ['ja_nein'], auswahl: ['option', 'optionen'] }[e.typ];
      const falsch = Object.keys(w).filter(s => ['zahl', 'text', 'ja_nein', 'option', 'optionen', 'einheit'].includes(s) && !erlaubt.includes(s));
      if (falsch.length) { problem(`Wert „${kw}“: das Feld ${falsch.join(', ')} passt nicht zum Typ ${e.typ}.`); ok = false; break; }
      werte[kw] = neu;
    }
    if (!ok) continue;

    const links = [];
    if (m.links != null) {
      if (!Array.isArray(m.links) || m.links.length > MAX_LINKS) { problem(`„links“ muss eine Liste mit höchstens ${MAX_LINKS} Einträgen sein.`); continue; }
      for (const l of m.links) {
        if (!istObjekt(l) || !istText(l.beschriftung) || typeof l.url !== 'string' || !/^https?:\/\/\S+$/.test(l.url) || l.url.length > 2000) {
          problem('Jeder Link braucht „beschriftung“ und eine „url“ mit http:// oder https://.'); ok = false; break;
        }
        links.push({ beschriftung: l.beschriftung.trim(), url: l.url });
      }
      if (!ok) continue;
    }

    materialien.push({
      id: Number.isInteger(m.id) && m.id > 0 ? m.id : null, datei: datei, name_de: m.name_de.trim(), name_en: textOderNull(m.name_en),
      hersteller: textOderNull(m.hersteller), kategorie_id: kategorie, notiz_de: textOderNull(m.notiz_de), notiz_en: textOderNull(m.notiz_en),
      status: m.status ?? 'entwurf', erstellt_am: textOderNull(m.erstellt_am) ?? jetzt(), geaendert_am: textOderNull(m.geaendert_am) ?? jetzt(),
      werte, links
    });
  }

  // --- Unterstützer (Namen mit Abzeichen, die der Anzeige zugestimmt haben) ---
  const unterstuetzer = [];
  const rohUnterstuetzer = lies('unterstuetzer.json', []);
  if (!Array.isArray(rohUnterstuetzer)) melde('unterstuetzer.json', 'Erwartet wird eine Liste.');
  for (const [i, u] of (Array.isArray(rohUnterstuetzer) ? rohUnterstuetzer : []).entries()) {
    const wo = `Eintrag ${i + 1}`;
    if (!istObjekt(u)) { melde('unterstuetzer.json', `${wo}: kein Objekt.`); continue; }
    if (!istText(u.name) || u.name.trim().length > 60) { melde('unterstuetzer.json', `${wo}: „name“ fehlt oder ist länger als 60 Zeichen.`); continue; }
    const name = u.name.trim();
    if (unterstuetzer.some(x => x.name.toLowerCase() === name.toLowerCase())) { melde('unterstuetzer.json', `${name}: doppelt.`); continue; }
    if (u.abzeichen != null && !(Array.isArray(u.abzeichen) && u.abzeichen.every(a => ABZEICHEN_IDS.includes(a)))) {
      melde('unterstuetzer.json', `${name}: „abzeichen“ muss eine Liste aus ${ABZEICHEN_IDS.join(', ')} sein.`); continue;
    }
    if (u.auto_abzeichen != null && !(Array.isArray(u.auto_abzeichen) && u.auto_abzeichen.every(a => ABZEICHEN_IDS.includes(a)))) {
      melde('unterstuetzer.json', `${name}: „auto_abzeichen“ muss eine Liste aus ${ABZEICHEN_IDS.join(', ')} sein.`); continue;
    }
    if (u.zustimmung_art != null && !ZUSTIMMUNG_ARTEN.includes(u.zustimmung_art)) {
      melde('unterstuetzer.json', `${name}: „zustimmung_art“ muss ${ZUSTIMMUNG_ARTEN.join(' oder ')} sein.`); continue;
    }
    unterstuetzer.push({
      id: Number.isInteger(u.id) && u.id > 0 ? u.id : null, name, abzeichen: normalisiereAbzeichen(u.abzeichen),
      auto_abzeichen: normalisiereAbzeichen(u.auto_abzeichen),
      zustimmung_am: textOderNull(u.zustimmung_am) ?? jetzt(), zustimmung_art: u.zustimmung_art ?? 'manuell'
    });
  }

  // --- IDs: Doppelte sind ein Fehler, fehlende werden vergeben ---
  let ergaenzt = false;
  const eindeutig = (liste, name, datei) => {
    const gesehen = new Set();
    for (const x of liste) {
      if (x.id === null) continue;
      if (gesehen.has(x.id)) { melde(datei(x), `${name}-ID ${x.id} kommt doppelt vor.`); x.id = -1; }
      else gesehen.add(x.id);
    }
  };
  eindeutig(kategorien, 'Kategorie', () => 'kategorien.json');
  eindeutig(eigenschaften, 'Eigenschaft', () => 'eigenschaften.json');
  eindeutig(materialien, 'Material', x => `materialien/${x.datei}`);
  eindeutig(unterstuetzer, 'Unterstützer', () => 'unterstuetzer.json');
  for (const e of eigenschaften) eindeutig(e.optionen, 'Option', () => 'eigenschaften.json');
  const vergibId = (liste, ...weitere) => {
    let max = Math.max(0, ...liste.map(x => x.id ?? 0), ...weitere);
    for (const x of liste) if (x.id === null) { x.id = ++max; ergaenzt = true; }
  };
  vergibId(kategorien);
  vergibId(eigenschaften);
  vergibId(materialien);
  vergibId(unterstuetzer);
  for (const e of eigenschaften) vergibId(e.optionen);

  // Verweise auf Kategorie und Option jetzt zu IDs auflösen
  for (const m of materialien) {
    m.kategorie_id = m.kategorie_id.id;
    for (const w of Object.values(m.werte)) w.option_ids = w.option_ids.map(o => o.id);
  }

  const idFehler = fehler.filter(f => /ID \d+ kommt doppelt vor/.test(f.text));
  const brauchbar = materialien.filter(m => m.id > 0);
  return {
    daten: {
      kategorien: kategorien.filter(k => k.id > 0), eigenschaften: eigenschaften.filter(e => e.id > 0), materialien: brauchbar,
      unterstuetzer: unterstuetzer.filter(u => u.id > 0)
    },
    fehler, idFehler, ergaenzt
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------------------------------------------------

const ohneNull = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const json = (o) => JSON.stringify(o, null, 2) + '\n';

function dateiName(m) {
  return `${slugify(m.name_de) || 'material'}-${m.id}.json`;
}

/** Alle Dateien für den aktuellen Stand: Map Pfad → Inhalt */
export function serialisiere({ kategorien, eigenschaften, materialien, unterstuetzer = [] }) {
  const dateien = new Map();
  dateien.set('kategorien.json', json(kategorien.map(k => ohneNull({ id: k.id, slug: k.slug, name_de: k.name_de, name_en: k.name_en, icon: k.icon }))));
  dateien.set('eigenschaften.json', json(eigenschaften.map(e => ohneNull({
    id: e.id, kurzwort: e.kurzwort, name_de: e.name_de, name_en: e.name_en, typ: e.typ, standard_einheit: e.standard_einheit,
    standard_sichtbar: e.standard_sichtbar, filterbar: e.filterbar, mehrfach: e.mehrfach ? true : null,
    optionen: e.typ === 'auswahl' ? e.optionen.map(o => ohneNull({ id: o.id, de: o.de, en: o.en })) : null
  }))));

  if (unterstuetzer.length) {
    dateien.set('unterstuetzer.json', json(unterstuetzer.map(u => ({
      id: u.id, name: u.name, abzeichen: u.abzeichen, ...(u.auto_abzeichen?.length ? { auto_abzeichen: u.auto_abzeichen } : {}),
      zustimmung_am: u.zustimmung_am, zustimmung_art: u.zustimmung_art
    }))));
  }

  for (const m of materialien) {
    const werte = {};
    for (const e of eigenschaften) {
      const w = m.werte[e.kurzwort];
      if (!w) continue;
      if (e.typ === 'zahl') werte[e.kurzwort] = ohneNull({ zahl: w.zahl, einheit: w.einheit, vermerk_de: w.vermerk_de, vermerk_en: w.vermerk_en });
      else if (e.typ === 'text') werte[e.kurzwort] = ohneNull({ text: w.text, vermerk_de: w.vermerk_de, vermerk_en: w.vermerk_en });
      else if (e.typ === 'ja_nein') werte[e.kurzwort] = ohneNull({ ja_nein: w.ja_nein, vermerk_de: w.vermerk_de, vermerk_en: w.vermerk_en });
      else {
        const namen = w.option_ids.map(id => e.optionen.find(o => o.id === id)?.de).filter(Boolean);
        werte[e.kurzwort] = ohneNull({
          option: e.mehrfach ? null : namen[0] ?? null, optionen: e.mehrfach && namen.length ? namen : null,
          vermerk_de: w.vermerk_de, vermerk_en: w.vermerk_en
        });
      }
    }
    const kategorie = kategorien.find(k => k.id === m.kategorie_id);
    dateien.set(`materialien/${m.datei}`, json(ohneNull({
      id: m.id, name_de: m.name_de, name_en: m.name_en, hersteller: m.hersteller, kategorie: kategorie?.slug, status: m.status,
      notiz_de: m.notiz_de, notiz_en: m.notiz_en, erstellt_am: m.erstellt_am, geaendert_am: m.geaendert_am,
      werte, links: m.links.map(l => ({ beschriftung: l.beschriftung, url: l.url }))
    })));
  }
  return dateien;
}

function schreibeAtomar(pfad, inhalt) {
  mkdirSync(dirname(pfad), { recursive: true });
  const temp = `${pfad}.tmp-${process.pid}`;
  writeFileSync(temp, inhalt);
  renameSync(temp, pfad);
}

// ---------------------------------------------------------------------------------------------------------------------
// Lokale Dateien (gehören nicht ins Repo)
// ---------------------------------------------------------------------------------------------------------------------

export class LokalerSpeicher {
  constructor(verzeichnis) {
    this.verzeichnis = verzeichnis;
    if (verzeichnis) mkdirSync(verzeichnis, { recursive: true });
    this._cache = new Map();
  }

  lies(name, standard) {
    if (this._cache.has(name)) return this._cache.get(name);
    let wert = standard;
    if (this.verzeichnis) {
      const pfad = join(this.verzeichnis, `${name}.json`);
      if (existsSync(pfad)) {
        try { wert = JSON.parse(readFileSync(pfad, 'utf8')); } catch (e) { console.error(`Lokale Datei ${name}.json ist unlesbar:`, e.message); }
      }
    }
    this._cache.set(name, wert);
    return wert;
  }

  schreibe(name, wert) {
    this._cache.set(name, wert);
    if (this.verzeichnis) schreibeAtomar(join(this.verzeichnis, `${name}.json`), json(wert));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Der Speicher selbst
// ---------------------------------------------------------------------------------------------------------------------

export class Speicher {
  /**
   * verzeichnis: Arbeitsverzeichnis mit den Dateien; git: Git-Objekt oder null; lokal: Ordner für lokale Dateien oder null
   */
  constructor({ verzeichnis, git = null, lokal = null }) {
    this.verzeichnis = verzeichnis;
    this.git = git;
    this.lokal = new LokalerSpeicher(lokal);
    this.kategorien = [];
    this.eigenschaften = [];
    this.materialien = [];
    this.unterstuetzer = [];
    this.ladeFehler = [];
    this._geschrieben = new Map();
    this._zeilen = [];
    mkdirSync(verzeichnis, { recursive: true });
  }

  /** Lädt alle Dateien. Fehlerhafte Materialien werden übersprungen und in ladeFehler gemeldet. */
  laden() {
    const { daten, fehler, ergaenzt } = liesVerzeichnis(this.verzeichnis);
    this.ersetze(daten);
    this.ladeFehler = fehler;
    this._geschrieben = this._leseVorhandene();
    // Mit Fehlern in den Dateien wird nichts geschrieben: sonst würden übersprungene Dateien überschrieben oder gelöscht
    if (!fehler.length) {
      if (ergaenzt) this._speichern('IDs ergänzt');
      else this.git?.commit('Stand beim Start gesichert');
    }
    return { fehler, ergaenzt };
  }

  ersetze(daten) {
    this.kategorien = daten.kategorien;
    this.eigenschaften = daten.eigenschaften;
    this.materialien = daten.materialien;
    this.unterstuetzer = daten.unterstuetzer ?? [];
  }

  _leseVorhandene() {
    const stand = new Map();
    const lies = (rel) => { const p = join(this.verzeichnis, rel); if (existsSync(p)) stand.set(rel, readFileSync(p, 'utf8')); };
    lies('kategorien.json');
    lies('eigenschaften.json');
    lies('unterstuetzer.json');
    const ordner = join(this.verzeichnis, 'materialien');
    if (existsSync(ordner)) for (const d of readdirSync(ordner)) if (d.endsWith('.json')) lies(`materialien/${d}`);
    return stand;
  }

  // --- Zugriff ---
  kategorie(id) { return this.kategorien.find(k => k.id === Number(id)) ?? null; }
  eigenschaft(kurzwort) { return this.eigenschaften.find(e => e.kurzwort === kurzwort) ?? null; }
  eigenschaftMitId(id) { return this.eigenschaften.find(e => e.id === Number(id)) ?? null; }
  material(id) { return this.materialien.find(m => m.id === Number(id)) ?? null; }
  naechsteId(liste) { return Math.max(0, ...liste.map(x => x.id)) + 1; }

  /** Eine Zeile für den Commit-Text, z. B. "Material »Alucore«: Status: entwurf → veroeffentlicht" */
  protokoll(zeile) { this._zeilen.push(zeile); }

  /**
   * Führt eine Änderung aus. Alles oder nichts: bei einem Fehler wird der alte Stand wiederhergestellt.
   * Danach werden geänderte Dateien geschrieben und, wenn ein Git-Verzeichnis dazugehört, committet.
   */
  aendere(fn) {
    if (this.ladeFehler.length) {
      throw new FehlerEingabe(
        `Die Dateien im Daten-Repository haben ${this.ladeFehler.length} Fehler, deshalb sind Änderungen gesperrt. ` +
        'Bitte die Fehler im Repo beheben und dann „Aus dem Repo laden“ drücken.', 409, this.ladeFehler
      );
    }
    const sicherung = structuredClone({
      kategorien: this.kategorien, eigenschaften: this.eigenschaften, materialien: this.materialien, unterstuetzer: this.unterstuetzer
    });
    this._zeilen = [];
    try {
      const ergebnis = fn(this);
      this._speichern();
      return ergebnis;
    } catch (e) {
      this.ersetze(sicherung);
      this._zeilen = [];
      throw e;
    }
  }

  _speichern(betreffVorgabe = null) {
    this.kategorien.forEach((k, i) => { k.reihenfolge = i + 1; });
    this.eigenschaften.forEach((e, i) => { e.reihenfolge = i + 1; });
    // Dateinamen für neue Materialien vergeben, vorhandene bleiben unverändert (Umbenennen ändert die Datei nicht)
    for (const m of this.materialien) if (!m.datei) m.datei = dateiName(m);
    const neu = serialisiere(this);
    let geaendert = false;
    for (const [pfad, inhalt] of neu) {
      if (this._geschrieben.get(pfad) !== inhalt) { schreibeAtomar(join(this.verzeichnis, pfad), inhalt); geaendert = true; }
    }
    for (const pfad of this._geschrieben.keys()) {
      if (!neu.has(pfad)) { rmSync(join(this.verzeichnis, pfad), { force: true }); geaendert = true; }
    }
    this._geschrieben = neu;
    if (!geaendert) return;

    if (this.git) {
      const zeilen = this._zeilen;
      const betreff = betreffVorgabe ?? (zeilen.length
        ? (zeilen.length === 1 ? zeilen[0] : `${zeilen[0]} (und ${zeilen.length - 1} weitere)`)
        : 'Daten aktualisiert');
      const nachricht = zeilen.length > 1 || betreff.length > 100
        ? `${betreff.slice(0, 100)}\n\n${zeilen.join('\n')}`
        : betreff;
      this.git.commit(nachricht);
      this.git.sendenPlanen();
    }
    this._zeilen = [];
  }

  /** Speichert den aktuellen Stand unabhängig von einer Änderung (z. B. nach vergebenen IDs) */
  speichereAlles(betreff) {
    this._zeilen = [];
    this._speichern(betreff);
  }
}
