// Meldungen von Besuchern: Fehler zu bestehenden Einträgen und Vorschläge für neue Materialien.
// Besucher legen nur Meldungen an. Öffentlich wird erst etwas, wenn es im Admin-Bereich übernommen wurde.

import { FehlerEingabe, setzeWert, protokoll } from './admin.js';

const LIMIT = { kommentar: 2000, kontakt: 200, quelle: 500, name: 200, hersteller: 200, wert: 200, einheit: 20 };
const MAX_WERTE = 20;

// --- Eingaben prüfen ---

// Entfernt Steuerzeichen, kürzt Leerraum; leer ergibt null.
function text(wert, max, feld) {
  if (wert === undefined || wert === null) return null;
  if (typeof wert !== 'string' && typeof wert !== 'number') throw new FehlerEingabe(`${feld}: ungültige Eingabe`);
  const s = String(wert).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!s) return null;
  if (s.length > max) throw new FehlerEingabe(`${feld}: höchstens ${max} Zeichen`);
  return s;
}

function link(wert) {
  const s = text(wert, LIMIT.quelle, 'Quelle');
  if (s === null) return null;
  if (!/^https?:\/\/\S+$/i.test(s)) throw new FehlerEingabe('Quelle: bitte eine Adresse mit http:// oder https:// angeben');
  return s;
}

function eigenschaft(db, kurzwort) {
  const e = db.prepare('SELECT id, kurzwort, name_de FROM eigenschaft WHERE kurzwort = ?').get(String(kurzwort ?? ''));
  if (!e) throw new FehlerEingabe('Unbekannte Eigenschaft');
  return e;
}

/** Prüft die Eingaben eines Besuchers und liefert die Felder für die Tabelle meldung. */
export function pruefeMeldung(db, daten) {
  const art = daten.art;
  if (art !== 'fehler' && art !== 'vorschlag') throw new FehlerEingabe('Unbekannte Art der Meldung');

  const gemeinsam = {
    kommentar: text(daten.kommentar, LIMIT.kommentar, 'Kommentar'),
    kontakt: text(daten.kontakt, LIMIT.kontakt, 'Kontakt'),
    quelle: link(daten.quelle)
  };

  if (art === 'fehler') {
    const id = Number(daten.material_id);
    const material = Number.isInteger(id)
      ? db.prepare("SELECT id FROM material WHERE id = ? AND status = 'veroeffentlicht'").get(id)
      : null;
    if (!material) throw new FehlerEingabe('Material nicht gefunden');

    const kw = text(daten.eigenschaft, 60, 'Eigenschaft');
    if (kw) eigenschaft(db, kw);
    const neuerWert = text(daten.neuer_wert, LIMIT.wert, 'Richtiger Wert');
    const einheit = text(daten.einheit, LIMIT.einheit, 'Einheit');

    if (neuerWert && !kw) throw new FehlerEingabe('Bitte die betroffene Eigenschaft wählen.');
    if (!gemeinsam.kommentar && !neuerWert) throw new FehlerEingabe('Bitte einen Kommentar oder den richtigen Wert angeben.');

    return {
      art, material_id: material.id, ...gemeinsam,
      inhalt: { eigenschaft: kw, neuer_wert: neuerWert, einheit }
    };
  }

  // Vorschlag
  const name = text(daten.name, LIMIT.name, 'Name');
  if (!name) throw new FehlerEingabe('Bitte einen Namen angeben.');
  const hersteller = text(daten.hersteller, LIMIT.hersteller, 'Hersteller');

  let kategorieId = null;
  if (daten.kategorie_id !== undefined && daten.kategorie_id !== null && daten.kategorie_id !== '') {
    kategorieId = Number(daten.kategorie_id);
    if (!Number.isInteger(kategorieId) || !db.prepare('SELECT 1 FROM kategorie WHERE id = ?').get(kategorieId)) {
      throw new FehlerEingabe('Kategorie unbekannt');
    }
  }

  const rohWerte = Array.isArray(daten.werte) ? daten.werte : [];
  if (rohWerte.length > MAX_WERTE) throw new FehlerEingabe(`Höchstens ${MAX_WERTE} Werte`);
  const werte = [];
  const gesehen = new Set();
  for (const w of rohWerte) {
    if (!w || typeof w !== 'object') throw new FehlerEingabe('Werte: ungültige Eingabe');
    const wert = text(w.wert, LIMIT.wert, 'Wert');
    const kw = text(w.eigenschaft, 60, 'Eigenschaft');
    if (!wert) continue; // Zeile ohne Wert wird ignoriert (auch wenn schon eine Eigenschaft gewählt war)
    if (!kw) throw new FehlerEingabe('Bitte bei jedem Wert Eigenschaft und Wert angeben.');
    eigenschaft(db, kw);
    if (gesehen.has(kw)) throw new FehlerEingabe('Eine Eigenschaft ist doppelt angegeben.');
    gesehen.add(kw);
    werte.push({ eigenschaft: kw, wert, einheit: text(w.einheit, LIMIT.einheit, 'Einheit') });
  }
  if (!werte.length) throw new FehlerEingabe('Bitte mindestens einen Wert angeben.');

  return {
    art, material_id: null, ...gemeinsam,
    inhalt: { name, hersteller, kategorie_id: kategorieId, werte }
  };
}

export function legeMeldungAn(db, daten) {
  const m = pruefeMeldung(db, daten);
  const info = db.prepare(`
    INSERT INTO meldung (art, material_id, inhalt, kommentar, kontakt, quelle)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(m.art, m.material_id, JSON.stringify(m.inhalt), m.kommentar, m.kontakt, m.quelle);
  return Number(info.lastInsertRowid);
}

// --- Lesen für den Admin-Bereich ---

export function zaehleOffene(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM meldung WHERE status = 'offen'").get().n;
}

/** Offene Meldungen (neueste zuerst) oder das Archiv der erledigten. */
export function listeMeldungen(db, { archiv = false } = {}) {
  const zeilen = db.prepare(`
    SELECT me.*, ma.name_de AS material_name_de, ma.name_en AS material_name_en, k.icon AS kategorie_icon
    FROM meldung me
    LEFT JOIN material ma ON ma.id = me.material_id
    LEFT JOIN kategorie k ON k.id = ma.kategorie_id
    WHERE ${archiv ? "me.status != 'offen'" : "me.status = 'offen'"}
    ORDER BY me.erstellt_am DESC, me.id DESC
    LIMIT 200
  `).all();

  const eigenschaften = new Map(db.prepare('SELECT id, kurzwort, name_de, name_en, typ, standard_einheit FROM eigenschaft').all()
    .map(e => [e.kurzwort, e]));
  const aktuellerWert = db.prepare(`
    SELECT w.zahl, w.text, w.ja_nein, w.einheit, w.option_id, o.wert_de AS option_de
    FROM wert w LEFT JOIN eigenschaft_option o ON o.id = w.option_id
    WHERE w.material_id = ? AND w.eigenschaft_id = ?
  `);

  return zeilen.map(z => {
    const inhalt = JSON.parse(z.inhalt);
    const ergebnis = {
      id: z.id,
      art: z.art,
      status: z.status,
      erstellt_am: z.erstellt_am,
      kommentar: z.kommentar,
      kontakt: z.kontakt,
      quelle: z.quelle,
      admin_notiz: z.admin_notiz,
      material_id: z.material_id,
      material: z.material_id ? { id: z.material_id, name: { de: z.material_name_de, en: z.material_name_en || null }, icon: z.kategorie_icon || null } : null,
      inhalt
    };

    if (z.art === 'fehler' && inhalt.eigenschaft) {
      const e = eigenschaften.get(inhalt.eigenschaft);
      if (e) {
        ergebnis.eigenschaft = { kurzwort: e.kurzwort, name: { de: e.name_de, en: e.name_en || null }, typ: e.typ, einheit: e.standard_einheit };
        const w = z.material_id ? aktuellerWert.get(z.material_id, e.id) : null;
        ergebnis.aktuell = w
          ? { zahl: w.zahl, text: w.text, ja_nein: w.ja_nein === null ? null : !!w.ja_nein, option: w.option_de, einheit: w.einheit }
          : null;
      }
    }
    if (z.art === 'vorschlag') {
      ergebnis.inhalt = {
        ...inhalt,
        werte: inhalt.werte.map(w => {
          const e = eigenschaften.get(w.eigenschaft);
          return { ...w, name: e ? { de: e.name_de, en: e.name_en || null } : { de: w.eigenschaft, en: null }, typ: e?.typ ?? null };
        })
      };
    }
    return ergebnis;
  });
}

// --- Bearbeiten im Admin-Bereich ---

function offeneMeldung(db, id, art = null) {
  const m = db.prepare('SELECT * FROM meldung WHERE id = ?').get(id);
  if (!m) throw new FehlerEingabe('Meldung nicht gefunden', 404);
  if (m.status !== 'offen') throw new FehlerEingabe('Diese Meldung ist schon erledigt.', 409);
  if (art && m.art !== art) throw new FehlerEingabe('Das geht nur bei Fehlermeldungen.');
  return m;
}

function abschliessen(db, m, status, { notiz = null, materialId = m.material_id } = {}) {
  db.prepare('UPDATE meldung SET status = ?, admin_notiz = ?, material_id = ? WHERE id = ?')
    .run(status, notiz, materialId, m.id);
  protokoll(db, { materialId, feld: `meldung.${m.id}.${status}`, alt: { art: m.art }, neu: notiz ? { notiz } : null });
}

/**
 * Übernimmt den Vorschlag einer Fehlermeldung als Wert des Materials.
 * wertdaten wie bei setzeWert (zahl, einheit, text, option_id, ja_nein, vermerk_de, ...); der Admin kann ihn vorher korrigieren.
 */
export function uebernehmeFehler(db, id, wertdaten) {
  db.transaction(() => {
    const m = offeneMeldung(db, id, 'fehler');
    const inhalt = JSON.parse(m.inhalt);
    if (!inhalt.eigenschaft) throw new FehlerEingabe('Diese Meldung nennt keinen Wert zum Übernehmen. Bitte als erledigt markieren.');
    setzeWert(db, m.material_id, inhalt.eigenschaft, wertdaten ?? {});
    abschliessen(db, m, 'uebernommen');
  })();
}

/** Markiert eine Meldung als erledigt, z. B. nachdem aus einem Vorschlag ein Material angelegt wurde. */
export function schliesseAb(db, id, materialId = null) {
  db.transaction(() => {
    const m = offeneMeldung(db, id);
    let ziel = m.material_id;
    if (materialId !== null && materialId !== undefined) {
      const mid = Number(materialId);
      if (!Number.isInteger(mid) || !db.prepare('SELECT 1 FROM material WHERE id = ?').get(mid)) {
        throw new FehlerEingabe('Material nicht gefunden', 404);
      }
      ziel = mid;
    }
    abschliessen(db, m, 'uebernommen', { materialId: ziel });
  })();
}

export function lehneAb(db, id, notiz = null) {
  db.transaction(() => {
    const m = offeneMeldung(db, id);
    const n = notiz === null || notiz === undefined ? null : String(notiz).trim().slice(0, 500) || null;
    abschliessen(db, m, 'abgelehnt', { notiz: n });
  })();
}
