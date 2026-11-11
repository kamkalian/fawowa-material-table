// Schreibende Funktionen für den Admin-Bereich. Jede Änderung wird im Protokoll (Tabelle aenderung) festgehalten.

import { listMaterialien, listEigenschaften, createMaterial, createEigenschaft, createKategorie } from './db.js';
import { ICON_NAMEN, STANDARD_ICON } from './icons.js';

export class FehlerEingabe extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const KURZWORT = /^[a-z][a-z0-9_]{1,40}$/;
const TYPEN = ['zahl', 'text', 'auswahl', 'ja_nein'];
const STATUS = ['entwurf', 'veroeffentlicht'];

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

function kategorieExistiert(db, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || !db.prepare('SELECT 1 FROM kategorie WHERE id = ?').get(n)) {
    throw new FehlerEingabe('Kategorie unbekannt');
  }
  return n;
}

function nichtGefunden(objekt) {
  return new FehlerEingabe(`${objekt} nicht gefunden`, 404);
}

// --- Protokoll ---

export function protokoll(db, { materialId = null, feld, alt = null, neu = null }) {
  db.prepare('INSERT INTO aenderung (material_id, feld, alt, neu) VALUES (?, ?, ?, ?)')
    .run(materialId, feld, alt === null ? null : JSON.stringify(alt), neu === null ? null : JSON.stringify(neu));
}

export function listProtokoll(db, limit = 200) {
  return db.prepare(`
    SELECT a.id, a.zeitpunkt, a.material_id, a.feld, a.alt, a.neu, m.name_de AS material_name
    FROM aenderung a LEFT JOIN material m ON m.id = a.material_id
    ORDER BY a.id DESC LIMIT ?
  `).all(Math.min(Number(limit) || 200, 1000)).map(r => ({
    ...r,
    alt: r.alt === null ? null : JSON.parse(r.alt),
    neu: r.neu === null ? null : JSON.parse(r.neu)
  }));
}

// --- Materialien ---

export function getAlleMaterialien(db) {
  return listMaterialien(db, { alle: true });
}

export function anlegenMaterial(db, daten) {
  const name_de = text(daten.name_de, 200, 'Name', { pflicht: true });
  const id = createMaterial(db, {
    name_de,
    name_en: text(daten.name_en, 200, 'Name (en)') ?? null,
    hersteller: text(daten.hersteller, 200, 'Hersteller') ?? null,
    kategorie_id: kategorieExistiert(db, daten.kategorie_id),
    notiz_de: text(daten.notiz_de, 2000, 'Notiz') ?? null,
    notiz_en: text(daten.notiz_en, 2000, 'Notiz (en)') ?? null,
    status: STATUS.includes(daten.status) ? daten.status : 'entwurf'
  });
  protokoll(db, { materialId: id, feld: 'material', neu: { angelegt: name_de } });
  return id;
}

const MATERIAL_FELDER = {
  name_de: (v) => text(v, 200, 'Name', { pflicht: true }),
  name_en: (v) => text(v, 200, 'Name (en)'),
  hersteller: (v) => text(v, 200, 'Hersteller'),
  kategorie_id: (v, db) => kategorieExistiert(db, v),
  notiz_de: (v) => text(v, 2000, 'Notiz'),
  notiz_en: (v) => text(v, 2000, 'Notiz (en)'),
  status: (v) => {
    if (!STATUS.includes(v)) throw new FehlerEingabe('Status unbekannt');
    return v;
  }
};

export function aendereMaterial(db, id, patch) {
  const alt = db.prepare('SELECT * FROM material WHERE id = ?').get(id);
  if (!alt) throw nichtGefunden('Material');

  const aenderungen = {};
  for (const [feld, pruefer] of Object.entries(MATERIAL_FELDER)) {
    if (!(feld in patch)) continue;
    const neu = pruefer(patch[feld], db) ?? null;
    if (neu !== (alt[feld] ?? null)) aenderungen[feld] = neu;
  }
  if (!Object.keys(aenderungen).length) return;

  db.transaction(() => {
    for (const [feld, neu] of Object.entries(aenderungen)) {
      db.prepare(`UPDATE material SET ${feld} = ? WHERE id = ?`).run(neu, id);
      protokoll(db, { materialId: id, feld: `material.${feld}`, alt: alt[feld] ?? null, neu });
    }
    db.prepare("UPDATE material SET geaendert_am = datetime('now') WHERE id = ?").run(id);
  })();
}

export function loescheMaterial(db, id) {
  const m = db.prepare('SELECT name_de FROM material WHERE id = ?').get(id);
  if (!m) throw nichtGefunden('Material');
  db.transaction(() => {
    db.prepare('DELETE FROM material WHERE id = ?').run(id);
    protokoll(db, { feld: 'material.geloescht', alt: m.name_de });
  })();
}

export function duplizierMaterial(db, id) {
  const quelle = db.prepare('SELECT * FROM material WHERE id = ?').get(id);
  if (!quelle) throw nichtGefunden('Material');

  return db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO material (name_de, name_en, hersteller, kategorie_id, notiz_de, notiz_en, status)
      VALUES (?, ?, ?, ?, ?, ?, 'entwurf')
    `).run(quelle.name_de, quelle.name_en, quelle.hersteller, quelle.kategorie_id, quelle.notiz_de, quelle.notiz_en);
    const neuId = Number(info.lastInsertRowid);

    db.prepare(`
      INSERT INTO wert (material_id, eigenschaft_id, zahl, text, option_id, ja_nein, einheit, vermerk_de, vermerk_en, quelle)
      SELECT ?, eigenschaft_id, zahl, text, option_id, ja_nein, einheit, vermerk_de, vermerk_en, quelle
      FROM wert WHERE material_id = ?
    `).run(neuId, id);
    db.prepare('INSERT INTO link (material_id, beschriftung, url, reihenfolge) SELECT ?, beschriftung, url, reihenfolge FROM link WHERE material_id = ?')
      .run(neuId, id);

    protokoll(db, { materialId: neuId, feld: 'material', neu: { kopie_von: quelle.name_de } });
    return neuId;
  })();
}

// --- Werte ---

const WERT_FELDER = ['zahl', 'text', 'option_id', 'ja_nein', 'einheit', 'vermerk_de', 'vermerk_en', 'quelle'];

export function setzeWert(db, materialId, kurzwort, daten) {
  const material = db.prepare('SELECT id FROM material WHERE id = ?').get(materialId);
  if (!material) throw nichtGefunden('Material');
  const eig = db.prepare('SELECT * FROM eigenschaft WHERE kurzwort = ?').get(kurzwort);
  if (!eig) throw nichtGefunden('Eigenschaft');

  const neu = { zahl: null, text: null, option_id: null, ja_nein: null, einheit: null,
    vermerk_de: null, vermerk_en: null, quelle: null };

  if (eig.typ === 'zahl') {
    neu.zahl = zahlOderNull(daten.zahl, eig.name_de);
    neu.einheit = text(daten.einheit, 20, 'Einheit') ?? (neu.zahl !== null ? eig.standard_einheit : null);
  } else if (eig.typ === 'text') {
    neu.text = text(daten.text, 2000, eig.name_de) ?? null;
  } else if (eig.typ === 'auswahl') {
    if (daten.option_id !== null && daten.option_id !== undefined && daten.option_id !== '') {
      const opt = db.prepare('SELECT id FROM eigenschaft_option WHERE id = ? AND eigenschaft_id = ?')
        .get(Number(daten.option_id), eig.id);
      if (!opt) throw new FehlerEingabe('Auswahl gehört nicht zu dieser Eigenschaft');
      neu.option_id = opt.id;
    }
  } else if (eig.typ === 'ja_nein') {
    neu.ja_nein = daten.ja_nein === null || daten.ja_nein === undefined || daten.ja_nein === ''
      ? null : (bool(daten.ja_nein) ? 1 : 0);
  }
  neu.vermerk_de = text(daten.vermerk_de, 500, 'Vermerk') ?? null;
  neu.vermerk_en = text(daten.vermerk_en, 500, 'Vermerk (en)') ?? null;
  neu.quelle = text(daten.quelle, 2000, 'Quelle') ?? null;

  const leer = WERT_FELDER.every(f => neu[f] === null);
  const alt = db.prepare('SELECT * FROM wert WHERE material_id = ? AND eigenschaft_id = ?').get(materialId, eig.id);
  const altWert = alt ? Object.fromEntries(WERT_FELDER.map(f => [f, alt[f]])) : null;
  if (leer && !alt) return;
  if (JSON.stringify(altWert) === JSON.stringify(leer ? null : neu)) return;

  db.transaction(() => {
    if (leer) {
      db.prepare('DELETE FROM wert WHERE material_id = ? AND eigenschaft_id = ?').run(materialId, eig.id);
    } else {
      db.prepare(`
        INSERT INTO wert (material_id, eigenschaft_id, ${WERT_FELDER.join(', ')})
        VALUES (?, ?, ${WERT_FELDER.map(() => '?').join(', ')})
        ON CONFLICT (material_id, eigenschaft_id) DO UPDATE SET
        ${WERT_FELDER.map(f => `${f} = excluded.${f}`).join(', ')}
      `).run(materialId, eig.id, ...WERT_FELDER.map(f => neu[f]));
    }
    db.prepare("UPDATE material SET geaendert_am = datetime('now') WHERE id = ?").run(materialId);
    protokoll(db, { materialId, feld: `wert.${kurzwort}`, alt: altWert, neu: leer ? null : neu });
  })();
}

// --- Links ---

export function setzeLinks(db, materialId, links) {
  const material = db.prepare('SELECT id FROM material WHERE id = ?').get(materialId);
  if (!material) throw nichtGefunden('Material');
  if (!Array.isArray(links) || links.length > 20) throw new FehlerEingabe('Links: höchstens 20 Einträge');

  const neu = links.map(l => ({
    beschriftung: text(l.beschriftung, 200, 'Beschriftung', { pflicht: true }),
    url: url(String(l.url ?? '').trim(), 'Link')
  }));
  const alt = db.prepare('SELECT beschriftung, url FROM link WHERE material_id = ? ORDER BY reihenfolge, id').all(materialId);
  if (JSON.stringify(alt) === JSON.stringify(neu)) return;

  db.transaction(() => {
    db.prepare('DELETE FROM link WHERE material_id = ?').run(materialId);
    const insert = db.prepare('INSERT INTO link (material_id, beschriftung, url, reihenfolge) VALUES (?, ?, ?, ?)');
    neu.forEach((l, i) => insert.run(materialId, l.beschriftung, l.url, i));
    db.prepare("UPDATE material SET geaendert_am = datetime('now') WHERE id = ?").run(materialId);
    protokoll(db, { materialId, feld: 'links', alt, neu });
  })();
}

// --- Eigenschaften ---

export function getAlleEigenschaften(db) {
  const anzahlen = new Map(db.prepare('SELECT eigenschaft_id, COUNT(*) AS n FROM wert GROUP BY eigenschaft_id')
    .all().map(r => [r.eigenschaft_id, r.n]));
  return listEigenschaften(db).map(e => ({ ...e, anzahlWerte: anzahlen.get(e.id) ?? 0 }));
}

export function anlegenEigenschaft(db, daten) {
  if (!KURZWORT.test(daten.kurzwort ?? '')) {
    throw new FehlerEingabe('Kurzwort: nur Kleinbuchstaben, Ziffern und _, 2 bis 41 Zeichen, mit Buchstabe am Anfang');
  }
  if (!TYPEN.includes(daten.typ)) throw new FehlerEingabe('Typ unbekannt');
  if (db.prepare('SELECT 1 FROM eigenschaft WHERE kurzwort = ?').get(daten.kurzwort)) {
    throw new FehlerEingabe('Dieses Kurzwort gibt es schon', 409);
  }
  const name_de = text(daten.name_de, 100, 'Name', { pflicht: true });
  const max = db.prepare('SELECT COALESCE(MAX(reihenfolge), 0) AS m FROM eigenschaft').get().m;
  const id = createEigenschaft(db, {
    kurzwort: daten.kurzwort,
    name_de,
    name_en: text(daten.name_en, 100, 'Name (en)') ?? null,
    typ: daten.typ,
    standard_einheit: text(daten.standard_einheit, 20, 'Einheit') ?? null,
    reihenfolge: max + 1,
    standard_sichtbar: bool(daten.standard_sichtbar),
    filterbar: daten.filterbar === undefined ? true : bool(daten.filterbar)
  });
  protokoll(db, { feld: `eigenschaft.${daten.kurzwort}`, neu: { angelegt: name_de, typ: daten.typ } });
  return id;
}

const EIGENSCHAFT_FELDER = {
  name_de: (v) => text(v, 100, 'Name', { pflicht: true }),
  name_en: (v) => text(v, 100, 'Name (en)'),
  standard_einheit: (v) => text(v, 20, 'Einheit'),
  standard_sichtbar: (v) => (bool(v) ? 1 : 0),
  filterbar: (v) => (bool(v) ? 1 : 0)
};

export function aendereEigenschaft(db, id, patch) {
  const alt = db.prepare('SELECT * FROM eigenschaft WHERE id = ?').get(id);
  if (!alt) throw nichtGefunden('Eigenschaft');

  const aenderungen = {};
  for (const [feld, pruefer] of Object.entries(EIGENSCHAFT_FELDER)) {
    if (!(feld in patch)) continue;
    const neu = pruefer(patch[feld]) ?? null;
    if (neu !== (alt[feld] ?? null)) aenderungen[feld] = neu;
  }
  if (!Object.keys(aenderungen).length) return;

  db.transaction(() => {
    for (const [feld, neu] of Object.entries(aenderungen)) {
      db.prepare(`UPDATE eigenschaft SET ${feld} = ? WHERE id = ?`).run(neu, id);
      protokoll(db, { feld: `eigenschaft.${alt.kurzwort}.${feld}`, alt: alt[feld] ?? null, neu });
    }
  })();
}

export function setzeEigenschaftReihenfolge(db, kurzworte) {
  const vorhanden = db.prepare('SELECT kurzwort FROM eigenschaft').all().map(r => r.kurzwort).sort();
  const neu = [...(kurzworte ?? [])].sort();
  if (JSON.stringify(vorhanden) !== JSON.stringify(neu)) {
    throw new FehlerEingabe('Die Reihenfolge muss alle Eigenschaften genau einmal enthalten');
  }
  db.transaction(() => {
    kurzworte.forEach((kw, i) => db.prepare('UPDATE eigenschaft SET reihenfolge = ? WHERE kurzwort = ?').run(i + 1, kw));
    protokoll(db, { feld: 'eigenschaft.reihenfolge', neu: kurzworte });
  })();
}

export function setzeOptionen(db, id, optionen) {
  const eig = db.prepare('SELECT * FROM eigenschaft WHERE id = ?').get(id);
  if (!eig) throw nichtGefunden('Eigenschaft');
  if (eig.typ !== 'auswahl') throw new FehlerEingabe('Nur Auswahl-Eigenschaften haben Optionen');
  if (!Array.isArray(optionen) || optionen.length > 50) throw new FehlerEingabe('Optionen: höchstens 50 Einträge');

  const alt = db.prepare('SELECT id, wert_de, wert_en FROM eigenschaft_option WHERE eigenschaft_id = ? ORDER BY reihenfolge').all(id);
  const vorhandeneIds = new Set(alt.map(o => o.id));

  db.transaction(() => {
    const behalten = new Set();
    optionen.forEach((o, i) => {
      const de = text(o.de, 100, 'Option', { pflicht: true });
      const en = text(o.en, 100, 'Option (en)') ?? null;
      const oid = Number(o.id);
      if (oid && vorhandeneIds.has(oid)) {
        db.prepare('UPDATE eigenschaft_option SET wert_de = ?, wert_en = ?, reihenfolge = ? WHERE id = ?').run(de, en, i + 1, oid);
        behalten.add(oid);
      } else {
        const info = db.prepare('INSERT INTO eigenschaft_option (eigenschaft_id, wert_de, wert_en, reihenfolge) VALUES (?, ?, ?, ?)')
          .run(id, de, en, i + 1);
        behalten.add(Number(info.lastInsertRowid));
      }
    });
    for (const oid of vorhandeneIds) {
      if (!behalten.has(oid)) db.prepare('DELETE FROM eigenschaft_option WHERE id = ?').run(oid);
    }
    const neu = db.prepare('SELECT id, wert_de, wert_en FROM eigenschaft_option WHERE eigenschaft_id = ? ORDER BY reihenfolge').all(id);
    protokoll(db, { feld: `eigenschaft.${eig.kurzwort}.optionen`, alt, neu });
  })();
}

export function loescheEigenschaft(db, id, bestaetigtAnzahl) {
  const eig = db.prepare('SELECT * FROM eigenschaft WHERE id = ?').get(id);
  if (!eig) throw nichtGefunden('Eigenschaft');
  const anzahl = db.prepare('SELECT COUNT(*) AS n FROM wert WHERE eigenschaft_id = ?').get(id).n;
  if (Number(bestaetigtAnzahl) !== anzahl) {
    throw new FehlerEingabe(`Bitte bestätigen: Beim Löschen gehen ${anzahl} Werte verloren.`, 409);
  }
  db.transaction(() => {
    db.prepare('DELETE FROM eigenschaft WHERE id = ?').run(id);
    protokoll(db, { feld: `eigenschaft.${eig.kurzwort}.geloescht`, alt: { name: eig.name_de, werte: anzahl } });
  })();
}

/** Verschiebt alle Werte von quelle nach ziel. Bei doppelten Werten bleibt der Wert der Ziel-Eigenschaft. */
export function fuehreZusammen(db, quelleId, zielId) {
  if (quelleId === zielId) throw new FehlerEingabe('Quelle und Ziel sind gleich');
  const quelle = db.prepare('SELECT * FROM eigenschaft WHERE id = ?').get(quelleId);
  const ziel = db.prepare('SELECT * FROM eigenschaft WHERE id = ?').get(zielId);
  if (!quelle || !ziel) throw nichtGefunden('Eigenschaft');
  if (quelle.typ !== ziel.typ) throw new FehlerEingabe('Nur Eigenschaften gleichen Typs lassen sich zusammenführen');
  if (quelle.typ === 'auswahl') throw new FehlerEingabe('Auswahl-Eigenschaften lassen sich nicht zusammenführen');

  db.transaction(() => {
    const werte = db.prepare('SELECT id, material_id FROM wert WHERE eigenschaft_id = ?').all(quelleId);
    const hatZiel = db.prepare('SELECT 1 FROM wert WHERE material_id = ? AND eigenschaft_id = ?');
    let verschoben = 0;
    for (const w of werte) {
      if (hatZiel.get(w.material_id, zielId)) {
        db.prepare('DELETE FROM wert WHERE id = ?').run(w.id);
      } else {
        db.prepare('UPDATE wert SET eigenschaft_id = ? WHERE id = ?').run(zielId, w.id);
        verschoben += 1;
      }
    }
    db.prepare('DELETE FROM eigenschaft WHERE id = ?').run(quelleId);
    protokoll(db, { feld: `eigenschaft.${quelle.kurzwort}.zusammengefuehrt`, alt: { in: ziel.kurzwort, verschoben } });
  })();
}

// --- Kategorien ---

export function getKategorien(db) {
  return db.prepare(`
    SELECT k.id, k.slug, k.name_de, k.name_en, k.icon,
           (SELECT COUNT(*) FROM material m WHERE m.kategorie_id = k.id) AS anzahlMaterialien
    FROM kategorie k ORDER BY k.reihenfolge, k.id
  `).all();
}

function iconPruefen(wert) {
  if (wert === undefined) return undefined;
  if (wert === null || wert === '') return STANDARD_ICON;
  if (!ICON_NAMEN.includes(wert)) throw new FehlerEingabe('Icon unbekannt');
  return wert;
}

export function anlegenKategorie(db, daten) {
  const name_de = text(daten.name_de, 100, 'Name', { pflicht: true });
  const slug = String(daten.slug ?? '').trim() || name_de.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(slug)) throw new FehlerEingabe('Kurzname: nur Kleinbuchstaben, Ziffern und Bindestriche');
  if (db.prepare('SELECT 1 FROM kategorie WHERE slug = ?').get(slug)) {
    throw new FehlerEingabe('Diesen Kurznamen gibt es schon', 409);
  }
  const max = db.prepare('SELECT COALESCE(MAX(reihenfolge), 0) AS m FROM kategorie').get().m;
  const id = createKategorie(db, {
    slug,
    name_de,
    name_en: text(daten.name_en, 100, 'Name (en)') ?? null,
    icon: iconPruefen(daten.icon) ?? STANDARD_ICON,
    reihenfolge: max + 1
  });
  protokoll(db, { feld: `kategorie.${slug}`, neu: { angelegt: name_de } });
  return id;
}

const KATEGORIE_FELDER = {
  name_de: (v) => text(v, 100, 'Name', { pflicht: true }),
  name_en: (v) => text(v, 100, 'Name (en)'),
  icon: iconPruefen
};

export function aendereKategorie(db, id, patch) {
  const alt = db.prepare('SELECT * FROM kategorie WHERE id = ?').get(id);
  if (!alt) throw nichtGefunden('Kategorie');

  const aenderungen = {};
  for (const [feld, pruefer] of Object.entries(KATEGORIE_FELDER)) {
    if (!(feld in patch)) continue;
    const neu = pruefer(patch[feld]) ?? null;
    if (neu !== (alt[feld] ?? null)) aenderungen[feld] = neu;
  }
  if (!Object.keys(aenderungen).length) return;

  db.transaction(() => {
    for (const [feld, neu] of Object.entries(aenderungen)) {
      db.prepare(`UPDATE kategorie SET ${feld} = ? WHERE id = ?`).run(neu, id);
      protokoll(db, { feld: `kategorie.${alt.slug}.${feld}`, alt: alt[feld] ?? null, neu });
    }
  })();
}

export function loescheKategorie(db, id) {
  const k = db.prepare('SELECT * FROM kategorie WHERE id = ?').get(id);
  if (!k) throw nichtGefunden('Kategorie');
  const n = db.prepare('SELECT COUNT(*) AS n FROM material WHERE kategorie_id = ?').get(id).n;
  if (n > 0) {
    throw new FehlerEingabe(`Die Kategorie wird noch von ${n} Materialien verwendet. Bitte diese zuerst einer anderen Kategorie zuordnen.`, 409);
  }
  db.transaction(() => {
    db.prepare('DELETE FROM kategorie WHERE id = ?').run(id);
    protokoll(db, { feld: `kategorie.${k.slug}.geloescht`, alt: k.name_de });
  })();
}

export function setzeKategorieReihenfolge(db, ids) {
  const vorhanden = db.prepare('SELECT id FROM kategorie').all().map(r => r.id).sort((a, b) => a - b);
  const neu = (Array.isArray(ids) ? ids.map(Number) : []).sort((a, b) => a - b);
  if (JSON.stringify(vorhanden) !== JSON.stringify(neu)) {
    throw new FehlerEingabe('Die Reihenfolge muss alle Kategorien genau einmal enthalten');
  }
  db.transaction(() => {
    ids.forEach((id, i) => db.prepare('UPDATE kategorie SET reihenfolge = ? WHERE id = ?').run(i + 1, Number(id)));
    protokoll(db, { feld: 'kategorie.reihenfolge', neu: ids });
  })();
}
