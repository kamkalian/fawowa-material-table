// Schreibende Funktionen für den Admin-Bereich. Jede Änderung läuft über s.aendere(): alles oder nichts, danach werden die
// geänderten Dateien geschrieben und als Git-Commit festgehalten. Der Commit-Text entsteht aus den protokollierten Zeilen.

import { ICON_NAMEN, STANDARD_ICON } from './icons.js';
import { FehlerEingabe } from './fehler.js';
import { TYPEN, STATUS, KURZWORT, slugify, zeitstempel } from './speicher.js';
import { listEigenschaften, listMaterialien } from './daten.js';

export { FehlerEingabe };

// --- Prüfen von Eingaben ---

function text(wert, max, feld, { pflicht = false } = {}) {
  if (wert === undefined && !pflicht) return undefined;
  if (wert === undefined || wert === null) return pflicht ? fehlt(feld) : null;
  const s = String(wert).trim();
  if (!s) {
    if (pflicht) fehlt(feld);
    return null;
  }
  if (s.length > max) throw new FehlerEingabe(`${feld}: höchstens ${max} Zeichen`);
  return s;
}

function fehlt(feld) {
  throw new FehlerEingabe(`${feld} fehlt`);
}

function zahlOderNull(wert, feld) {
  if (wert === undefined || wert === null || wert === '') return null;
  const n = typeof wert === 'number' ? wert : Number(String(wert).trim().replace(',', '.'));
  if (!Number.isFinite(n)) throw new FehlerEingabe(`${feld}: keine gültige Zahl`);
  return n;
}

function bool(wert) {
  return wert === true || wert === 1 || wert === 'true';
}

function url(wert, feld) {
  if (!/^https?:\/\/\S+$/.test(wert)) throw new FehlerEingabe(`${feld}: die Adresse muss mit http:// oder https:// beginnen`);
  if (wert.length > 2000) throw new FehlerEingabe(`${feld}: zu lang`);
  return wert;
}

function kategorieExistiert(s, id) {
  const k = s.kategorie(id);
  if (!k) throw new FehlerEingabe('Kategorie unbekannt');
  return k.id;
}

function nichtGefunden(objekt) {
  return new FehlerEingabe(`${objekt} nicht gefunden`, 404);
}

const kurz = (v) => (v === null || v === undefined ? '–' : String(v).length > 60 ? `${String(v).slice(0, 57)}...` : String(v));
const nameVon = (m) => `Material »${m.name_de}«`;

function wertText(e, w) {
  if (!w) return '–';
  const teile = [];
  if (e.typ === 'zahl') teile.push(w.zahl === null ? '–' : `${w.zahl}${w.einheit ? ` ${w.einheit}` : ''}`);
  else if (e.typ === 'text') teile.push(kurz(w.text));
  else if (e.typ === 'ja_nein') teile.push(w.ja_nein === null ? '–' : w.ja_nein ? 'ja' : 'nein');
  else teile.push(e.optionen.find(o => o.id === w.option_id)?.de ?? '–');
  if (w.vermerk_de) teile.push(`(${w.vermerk_de})`);
  return teile.join(' ');
}

const jetzt = zeitstempel;

// --- Protokoll: der Verlauf der Commits ---

export function listProtokoll(s, limit = 200) {
  return s.git ? s.git.verlauf(limit) : [];
}

// --- Materialien ---

export function getAlleMaterialien(s) {
  return listMaterialien(s, { alle: true });
}

export function anlegenMaterial(s, daten) {
  const name_de = text(daten.name_de, 200, 'Name', { pflicht: true });
  const kategorieId = kategorieExistiert(s, daten.kategorie_id);
  return s.aendere(() => {
    const id = s.naechsteId(s.materialien);
    s.materialien.push({
      id, datei: null, name_de,
      name_en: text(daten.name_en, 200, 'Name (en)') ?? null,
      hersteller: text(daten.hersteller, 200, 'Hersteller') ?? null,
      kategorie_id: kategorieId,
      notiz_de: text(daten.notiz_de, 2000, 'Notiz') ?? null,
      notiz_en: text(daten.notiz_en, 2000, 'Notiz (en)') ?? null,
      status: STATUS.includes(daten.status) ? daten.status : 'entwurf',
      erstellt_am: jetzt(), geaendert_am: jetzt(), werte: {}, links: []
    });
    s.protokoll(`Material »${name_de}« angelegt`);
    return id;
  });
}

const MATERIAL_FELDER = {
  name_de: (v) => text(v, 200, 'Name', { pflicht: true }),
  name_en: (v) => text(v, 200, 'Name (en)'),
  hersteller: (v) => text(v, 200, 'Hersteller'),
  kategorie_id: (v, s) => kategorieExistiert(s, v),
  notiz_de: (v) => text(v, 2000, 'Notiz'),
  notiz_en: (v) => text(v, 2000, 'Notiz (en)'),
  status: (v) => {
    if (!STATUS.includes(v)) throw new FehlerEingabe('Status unbekannt');
    return v;
  }
};

export function aendereMaterial(s, id, patch) {
  const m = s.material(id);
  if (!m) throw nichtGefunden('Material');

  const aenderungen = {};
  for (const [feld, pruefer] of Object.entries(MATERIAL_FELDER)) {
    if (!(feld in patch)) continue;
    const neu = pruefer(patch[feld], s) ?? null;
    if (neu !== (m[feld] ?? null)) aenderungen[feld] = neu;
  }
  if (!Object.keys(aenderungen).length) return;

  s.aendere(() => {
    const name = nameVon(m);
    for (const [feld, neu] of Object.entries(aenderungen)) {
      const alt = m[feld];
      m[feld] = neu;
      const anzeige = feld === 'kategorie_id' ? [s.kategorie(alt)?.slug, s.kategorie(neu)?.slug] : [alt, neu];
      s.protokoll(`${name}: ${feld.replace('_id', '')} ${kurz(anzeige[0])} → ${kurz(anzeige[1])}`);
    }
    m.geaendert_am = jetzt();
  });
}

export function loescheMaterial(s, id) {
  const m = s.material(id);
  if (!m) throw nichtGefunden('Material');
  s.aendere(() => {
    s.materialien.splice(s.materialien.indexOf(m), 1);
    s.protokoll(`${nameVon(m)} gelöscht`);
  });
}

export function duplizierMaterial(s, id) {
  const quelle = s.material(id);
  if (!quelle) throw nichtGefunden('Material');
  return s.aendere(() => {
    const kopie = structuredClone(quelle);
    kopie.id = s.naechsteId(s.materialien);
    kopie.datei = null;
    kopie.status = 'entwurf';
    kopie.erstellt_am = jetzt();
    kopie.geaendert_am = jetzt();
    s.materialien.push(kopie);
    s.protokoll(`${nameVon(kopie)} als Kopie angelegt`);
    return kopie.id;
  });
}

// --- Werte ---

export function setzeWert(s, materialId, kurzwort, daten) {
  const m = s.material(materialId);
  if (!m) throw nichtGefunden('Material');
  const eig = s.eigenschaft(kurzwort);
  if (!eig) throw nichtGefunden('Eigenschaft');

  const neu = { zahl: null, text: null, option_id: null, ja_nein: null, einheit: null, vermerk_de: null, vermerk_en: null };

  if (eig.typ === 'zahl') {
    neu.zahl = zahlOderNull(daten.zahl, eig.name_de);
    neu.einheit = text(daten.einheit, 20, 'Einheit') ?? (neu.zahl !== null ? eig.standard_einheit : null);
  } else if (eig.typ === 'text') {
    neu.text = text(daten.text, 2000, eig.name_de) ?? null;
  } else if (eig.typ === 'auswahl') {
    if (daten.option_id !== null && daten.option_id !== undefined && daten.option_id !== '') {
      const opt = eig.optionen.find(o => o.id === Number(daten.option_id));
      if (!opt) throw new FehlerEingabe('Auswahl gehört nicht zu dieser Eigenschaft');
      neu.option_id = opt.id;
    }
  } else if (eig.typ === 'ja_nein') {
    neu.ja_nein = daten.ja_nein === null || daten.ja_nein === undefined || daten.ja_nein === ''
      ? null : bool(daten.ja_nein);
  }
  neu.vermerk_de = text(daten.vermerk_de, 500, 'Vermerk') ?? null;
  neu.vermerk_en = text(daten.vermerk_en, 500, 'Vermerk (en)') ?? null;

  const leer = Object.values(neu).every(v => v === null);
  const alt = m.werte[kurzwort] ?? null;
  if (leer && !alt) return;
  if (JSON.stringify(alt) === JSON.stringify(leer ? null : neu)) return;

  s.aendere(() => {
    if (leer) delete m.werte[kurzwort];
    else m.werte[kurzwort] = neu;
    m.geaendert_am = jetzt();
    s.protokoll(`${nameVon(m)}: ${eig.name_de} ${wertText(eig, alt)} → ${leer ? '–' : wertText(eig, neu)}`);
  });
}

// --- Links ---

export function setzeLinks(s, materialId, links) {
  const m = s.material(materialId);
  if (!m) throw nichtGefunden('Material');
  if (!Array.isArray(links) || links.length > 20) throw new FehlerEingabe('Links: höchstens 20 Einträge');

  const neu = links.map(l => ({
    beschriftung: text(l.beschriftung, 200, 'Beschriftung', { pflicht: true }),
    url: url(String(l.url ?? '').trim(), 'Link')
  }));
  if (JSON.stringify(m.links) === JSON.stringify(neu)) return;

  s.aendere(() => {
    const vorher = m.links.length;
    m.links = neu;
    m.geaendert_am = jetzt();
    s.protokoll(`${nameVon(m)}: Links geändert (${vorher} → ${neu.length})`);
  });
}

// --- Eigenschaften ---

export function getAlleEigenschaften(s) {
  return listEigenschaften(s).map(e => ({ ...e, anzahlWerte: s.materialien.filter(m => m.werte[e.kurzwort]).length }));
}

export function anlegenEigenschaft(s, daten) {
  if (!KURZWORT.test(daten.kurzwort ?? '')) {
    throw new FehlerEingabe('Kurzwort: nur Kleinbuchstaben, Ziffern und _, 2 bis 41 Zeichen, mit Buchstabe am Anfang');
  }
  if (!TYPEN.includes(daten.typ)) throw new FehlerEingabe('Typ unbekannt');
  if (s.eigenschaft(daten.kurzwort)) throw new FehlerEingabe('Dieses Kurzwort gibt es schon', 409);
  const name_de = text(daten.name_de, 100, 'Name', { pflicht: true });
  return s.aendere(() => {
    const id = s.naechsteId(s.eigenschaften);
    s.eigenschaften.push({
      id, kurzwort: daten.kurzwort, name_de,
      name_en: text(daten.name_en, 100, 'Name (en)') ?? null,
      typ: daten.typ,
      standard_einheit: text(daten.standard_einheit, 20, 'Einheit') ?? null,
      reihenfolge: s.eigenschaften.length + 1,
      standard_sichtbar: bool(daten.standard_sichtbar),
      filterbar: daten.filterbar === undefined ? true : bool(daten.filterbar),
      optionen: []
    });
    s.protokoll(`Eigenschaft »${name_de}« (${daten.kurzwort}, ${daten.typ}) angelegt`);
    return id;
  });
}

const EIGENSCHAFT_FELDER = {
  name_de: (v) => text(v, 100, 'Name', { pflicht: true }),
  name_en: (v) => text(v, 100, 'Name (en)'),
  standard_einheit: (v) => text(v, 20, 'Einheit'),
  standard_sichtbar: (v) => bool(v),
  filterbar: (v) => bool(v)
};

export function aendereEigenschaft(s, id, patch) {
  const e = s.eigenschaftMitId(id);
  if (!e) throw nichtGefunden('Eigenschaft');

  const aenderungen = {};
  for (const [feld, pruefer] of Object.entries(EIGENSCHAFT_FELDER)) {
    if (!(feld in patch)) continue;
    const neu = pruefer(patch[feld]) ?? null;
    if (neu !== (e[feld] ?? null)) aenderungen[feld] = neu;
  }
  if (!Object.keys(aenderungen).length) return;

  s.aendere(() => {
    for (const [feld, neu] of Object.entries(aenderungen)) {
      s.protokoll(`Eigenschaft ${e.kurzwort}: ${feld} ${kurz(e[feld])} → ${kurz(neu)}`);
      e[feld] = neu;
    }
  });
}

export function setzeEigenschaftReihenfolge(s, kurzworte) {
  const vorhanden = s.eigenschaften.map(e => e.kurzwort).sort();
  const neu = [...(kurzworte ?? [])].sort();
  if (JSON.stringify(vorhanden) !== JSON.stringify(neu)) {
    throw new FehlerEingabe('Die Reihenfolge muss alle Eigenschaften genau einmal enthalten');
  }
  s.aendere(() => {
    s.eigenschaften = kurzworte.map(kw => s.eigenschaft(kw));
    s.protokoll(`Reihenfolge der Eigenschaften geändert: ${kurzworte.join(', ')}`);
  });
}

export function setzeOptionen(s, id, optionen) {
  const e = s.eigenschaftMitId(id);
  if (!e) throw nichtGefunden('Eigenschaft');
  if (e.typ !== 'auswahl') throw new FehlerEingabe('Nur Auswahl-Eigenschaften haben Optionen');
  if (!Array.isArray(optionen) || optionen.length > 50) throw new FehlerEingabe('Optionen: höchstens 50 Einträge');

  const geprueft = optionen.map(o => ({
    id: Number(o.id) || null,
    de: text(o.de, 100, 'Option', { pflicht: true }),
    en: text(o.en, 100, 'Option (en)') ?? null
  }));
  if (new Set(geprueft.map(o => o.de)).size !== geprueft.length) throw new FehlerEingabe('Jede Option darf nur einmal vorkommen');

  s.aendere(() => {
    const alt = e.optionen.map(o => o.de);
    const vorhandeneIds = new Set(e.optionen.map(o => o.id));
    let naechste = Math.max(0, ...e.optionen.map(o => o.id)) + 1;
    const neu = geprueft.map(o => ({ id: o.id && vorhandeneIds.has(o.id) ? o.id : naechste++, de: o.de, en: o.en }));
    const behalten = new Set(neu.map(o => o.id));

    // Werte, die eine entfernte Option hatten, verlieren die Auswahl (ein leerer Wert verschwindet ganz)
    for (const m of s.materialien) {
      const w = m.werte[e.kurzwort];
      if (w && w.option_id !== null && !behalten.has(w.option_id)) {
        w.option_id = null;
        if (Object.values(w).every(v => v === null)) delete m.werte[e.kurzwort];
      }
    }
    e.optionen = neu;
    s.protokoll(`Eigenschaft ${e.kurzwort}: Optionen ${alt.join(', ') || '–'} → ${neu.map(o => o.de).join(', ') || '–'}`);
  });
}

export function loescheEigenschaft(s, id, bestaetigtAnzahl) {
  const e = s.eigenschaftMitId(id);
  if (!e) throw nichtGefunden('Eigenschaft');
  const anzahl = s.materialien.filter(m => m.werte[e.kurzwort]).length;
  if (Number(bestaetigtAnzahl) !== anzahl) {
    throw new FehlerEingabe(`Bitte bestätigen: Beim Löschen gehen ${anzahl} Werte verloren.`, 409);
  }
  s.aendere(() => {
    for (const m of s.materialien) delete m.werte[e.kurzwort];
    s.eigenschaften.splice(s.eigenschaften.indexOf(e), 1);
    s.protokoll(`Eigenschaft »${e.name_de}« (${e.kurzwort}) gelöscht, ${anzahl} Werte entfernt`);
  });
}

/** Verschiebt alle Werte von quelle nach ziel. Bei doppelten Werten bleibt der Wert der Ziel-Eigenschaft. */
export function fuehreZusammen(s, quelleId, zielId) {
  if (quelleId === zielId) throw new FehlerEingabe('Quelle und Ziel sind gleich');
  const quelle = s.eigenschaftMitId(quelleId);
  const ziel = s.eigenschaftMitId(zielId);
  if (!quelle || !ziel) throw nichtGefunden('Eigenschaft');
  if (quelle.typ !== ziel.typ) throw new FehlerEingabe('Nur Eigenschaften gleichen Typs lassen sich zusammenführen');
  if (quelle.typ === 'auswahl') throw new FehlerEingabe('Auswahl-Eigenschaften lassen sich nicht zusammenführen');

  s.aendere(() => {
    let verschoben = 0;
    for (const m of s.materialien) {
      const w = m.werte[quelle.kurzwort];
      if (!w) continue;
      if (!m.werte[ziel.kurzwort]) {
        m.werte[ziel.kurzwort] = w;
        verschoben += 1;
      }
      delete m.werte[quelle.kurzwort];
    }
    s.eigenschaften.splice(s.eigenschaften.indexOf(quelle), 1);
    s.protokoll(`Eigenschaft ${quelle.kurzwort} in ${ziel.kurzwort} zusammengeführt, ${verschoben} Werte verschoben`);
  });
}

// --- Kategorien ---

export function getKategorien(s) {
  return s.kategorien.map(k => ({
    id: k.id, slug: k.slug, name_de: k.name_de, name_en: k.name_en, icon: k.icon,
    anzahlMaterialien: s.materialien.filter(m => m.kategorie_id === k.id).length
  }));
}

function iconPruefen(wert) {
  if (wert === undefined) return undefined;
  if (wert === null || wert === '') return STANDARD_ICON;
  if (!ICON_NAMEN.includes(wert)) throw new FehlerEingabe('Icon unbekannt');
  return wert;
}

export function anlegenKategorie(s, daten) {
  const name_de = text(daten.name_de, 100, 'Name', { pflicht: true });
  const slug = String(daten.slug ?? '').trim() || slugify(name_de);
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug)) throw new FehlerEingabe('Kurzname: nur Kleinbuchstaben, Ziffern und Bindestriche');
  if (s.kategorien.some(k => k.slug === slug)) throw new FehlerEingabe('Diesen Kurznamen gibt es schon', 409);
  return s.aendere(() => {
    const id = s.naechsteId(s.kategorien);
    s.kategorien.push({
      id, slug, name_de,
      name_en: text(daten.name_en, 100, 'Name (en)') ?? null,
      icon: iconPruefen(daten.icon) ?? STANDARD_ICON,
      reihenfolge: s.kategorien.length + 1
    });
    s.protokoll(`Kategorie »${name_de}« (${slug}) angelegt`);
    return id;
  });
}

const KATEGORIE_FELDER = {
  name_de: (v) => text(v, 100, 'Name', { pflicht: true }),
  name_en: (v) => text(v, 100, 'Name (en)'),
  icon: iconPruefen
};

export function aendereKategorie(s, id, patch) {
  const k = s.kategorie(id);
  if (!k) throw nichtGefunden('Kategorie');

  const aenderungen = {};
  for (const [feld, pruefer] of Object.entries(KATEGORIE_FELDER)) {
    if (!(feld in patch)) continue;
    const neu = pruefer(patch[feld]) ?? null;
    if (neu !== (k[feld] ?? null)) aenderungen[feld] = neu;
  }
  if (!Object.keys(aenderungen).length) return;

  s.aendere(() => {
    for (const [feld, neu] of Object.entries(aenderungen)) {
      s.protokoll(`Kategorie ${k.slug}: ${feld} ${kurz(k[feld])} → ${kurz(neu)}`);
      k[feld] = neu;
    }
  });
}

export function loescheKategorie(s, id) {
  const k = s.kategorie(id);
  if (!k) throw nichtGefunden('Kategorie');
  const n = s.materialien.filter(m => m.kategorie_id === k.id).length;
  if (n > 0) {
    throw new FehlerEingabe(`Die Kategorie wird noch von ${n} Materialien verwendet. Bitte diese zuerst einer anderen Kategorie zuordnen.`, 409);
  }
  s.aendere(() => {
    s.kategorien.splice(s.kategorien.indexOf(k), 1);
    s.protokoll(`Kategorie »${k.name_de}« (${k.slug}) gelöscht`);
  });
}

export function setzeKategorieReihenfolge(s, ids) {
  const vorhanden = s.kategorien.map(k => k.id).sort((a, b) => a - b);
  const neu = (Array.isArray(ids) ? ids.map(Number) : []).sort((a, b) => a - b);
  if (JSON.stringify(vorhanden) !== JSON.stringify(neu)) {
    throw new FehlerEingabe('Die Reihenfolge muss alle Kategorien genau einmal enthalten');
  }
  s.aendere(() => {
    s.kategorien = ids.map(id => s.kategorie(id));
    s.protokoll(`Reihenfolge der Kategorien geändert: ${s.kategorien.map(k => k.slug).join(', ')}`);
  });
}
