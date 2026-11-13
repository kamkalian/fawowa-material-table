// Meldungen von Besuchern: Fehler zu bestehenden Einträgen und Vorschläge für neue Materialien.
// Besucher legen nur Meldungen an. Öffentlich wird erst etwas, wenn es im Admin-Bereich übernommen wurde.

import { FehlerEingabe, setzeWert } from './admin.js';
import { zeitstempel } from './speicher.js';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { legeUnterstuetzerAn } from './unterstuetzung.js';

const LIMIT = { kommentar: 2000, kontakt: 200, quelle: 500, name: 200, hersteller: 200, wert: 200, einheit: 20 };
const MAX_WERTE = 20;
const MAX_OFFEN = 1000;

// Meldungen enthalten Kontaktangaben von Besuchern und liegen deshalb nur lokal (nicht im Git-Repo): lokale Datei meldungen.json
const alle = (s) => s.lokal.lies('meldungen', []);
const sichern = (s) => s.lokal.schreibe('meldungen', alle(s));

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

function eigenschaft(s, kurzwort) {
  const e = s.eigenschaft(String(kurzwort ?? ''));
  if (!e) throw new FehlerEingabe('Unbekannte Eigenschaft');
  return e;
}

/** Prüft die Eingaben eines Besuchers und liefert die Felder für die Tabelle meldung. */
export function pruefeMeldung(s, daten) {
  const art = daten.art;
  if (art !== 'fehler' && art !== 'vorschlag') throw new FehlerEingabe('Unbekannte Art der Meldung');

  const gemeinsam = {
    kommentar: text(daten.kommentar, LIMIT.kommentar, 'Kommentar'),
    kontakt: text(daten.kontakt, LIMIT.kontakt, 'Kontakt'),
    melder_name: text(daten.melder_name, 60, 'Name'),
    quelle: link(daten.quelle)
  };

  if (art === 'fehler') {
    const id = Number(daten.material_id);
    const material = Number.isInteger(id) ? s.materialien.find(m => m.id === id && m.status === 'veroeffentlicht') : null;
    if (!material) throw new FehlerEingabe('Material nicht gefunden');

    const kw = text(daten.eigenschaft, 60, 'Eigenschaft');
    if (kw) eigenschaft(s, kw);
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
    if (!Number.isInteger(kategorieId) || !s.kategorie(kategorieId)) {
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
    eigenschaft(s, kw);
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

export function legeMeldungAn(s, daten) {
  const m = pruefeMeldung(s, daten);
  const liste = alle(s);
  if (liste.filter(x => x.status === 'offen').length >= MAX_OFFEN) {
    throw new FehlerEingabe('Es liegen sehr viele offene Meldungen vor. Bitte später erneut versuchen.', 503);
  }
  const id = Math.max(0, ...liste.map(x => x.id)) + 1;
  liste.push({
    id, art: m.art, material_id: m.material_id, inhalt: m.inhalt, kommentar: m.kommentar, kontakt: m.kontakt, melder_name: m.melder_name, quelle: m.quelle,
    status: 'offen', admin_notiz: null, erstellt_am: zeitstempel(),
    // Nur wenn der Melder einen Namen angegeben hat, kann er direkt danach der Nennung als Unterstützer zustimmen
    nennung_token: m.melder_name ? randomBytes(24).toString('hex') : undefined
  });
  sichern(s);
  return id;
}

/** Der geheime Token, mit dem der Melder direkt nach dem Absenden der Nennung als Unterstützer zustimmen kann */
export function nennungToken(s, id) {
  return alle(s).find(x => x.id === Number(id))?.nennung_token ?? null;
}

const gleich = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Der Melder stimmt zu, mit dem Namen aus seiner Meldung als Unterstützer genannt zu werden. Er braucht dafür den Token aus der
 * Antwort auf die Meldung (so kann niemand fremde Meldungen zustimmen lassen); der Token gilt nur einmal.
 */
export function stimmeNennungZu(s, id, token) {
  const m = alle(s).find(x => x.id === Number(id));
  if (!m || !m.nennung_token || !token || !gleich(token, m.nennung_token)) throw new FehlerEingabe('Das ist nicht mehr möglich.', 403);
  if (!m.melder_name) throw new FehlerEingabe('In der Meldung steht kein Name.');
  m.nennung = { name: m.melder_name, zugestimmt_am: zeitstempel(), eingetragen: false };
  delete m.nennung_token;
  sichern(s);
}

/** Trägt den Melder, der zugestimmt hat, als Unterstützer ein (Admin). Ohne Abzeichen; die vergibt der Admin danach im Formular. */
export function nenneAlsUnterstuetzer(s, id) {
  const m = alle(s).find(x => x.id === Number(id));
  if (!m) throw new FehlerEingabe('Meldung nicht gefunden', 404);
  if (!m.nennung) throw new FehlerEingabe('Der Melder hat nicht zugestimmt, genannt zu werden.', 409);
  if (m.nennung.eingetragen) throw new FehlerEingabe('Der Melder ist schon eingetragen.', 409);
  const unterstuetzerId = legeUnterstuetzerAn(s, { name: m.nennung.name, zustimmung: true }, new Date(), 'meldung');
  m.nennung.eingetragen = true;
  sichern(s);
  return unterstuetzerId;
}

// --- Lesen für den Admin-Bereich ---

export function zaehleOffene(s) {
  return alle(s).filter(m => m.status === 'offen').length;
}

/** Offene Meldungen (neueste zuerst) oder das Archiv der erledigten. */
export function listeMeldungen(s, { archiv = false } = {}) {
  const zeilen = alle(s)
    .filter(m => (archiv ? m.status !== 'offen' : m.status === 'offen'))
    .sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am) || b.id - a.id)
    .slice(0, 200);

  return zeilen.map(z => {
    const inhalt = z.inhalt;
    const material = z.material_id ? s.material(z.material_id) : null;
    const ergebnis = {
      id: z.id,
      art: z.art,
      status: z.status,
      erstellt_am: z.erstellt_am,
      kommentar: z.kommentar,
      kontakt: z.kontakt,
      melder_name: z.melder_name ?? null,
      quelle: z.quelle,
      admin_notiz: z.admin_notiz,
      nennung: z.nennung ?? null,
      material_id: z.material_id,
      material: material
        ? { id: material.id, name: { de: material.name_de, en: material.name_en || null }, icon: s.kategorie(material.kategorie_id)?.icon || null }
        : null,
      inhalt
    };

    if (z.art === 'fehler' && inhalt.eigenschaft) {
      const e = s.eigenschaft(inhalt.eigenschaft);
      if (e) {
        ergebnis.eigenschaft = { kurzwort: e.kurzwort, name: { de: e.name_de, en: e.name_en || null }, typ: e.typ, einheit: e.standard_einheit };
        const w = material?.werte[e.kurzwort];
        ergebnis.aktuell = w
          ? { zahl: w.zahl, text: w.text, ja_nein: w.ja_nein, option: w.option_ids.map(id => e.optionen.find(o => o.id === id)?.de).filter(Boolean).join(', ') || null, einheit: w.einheit }
          : null;
      }
    }
    if (z.art === 'vorschlag') {
      ergebnis.inhalt = {
        ...inhalt,
        werte: inhalt.werte.map(w => {
          const e = s.eigenschaft(w.eigenschaft);
          return { ...w, name: e ? { de: e.name_de, en: e.name_en || null } : { de: w.eigenschaft, en: null }, typ: e?.typ ?? null };
        })
      };
    }
    return ergebnis;
  });
}

// --- Bearbeiten im Admin-Bereich ---

function offeneMeldung(s, id, art = null) {
  const m = alle(s).find(x => x.id === Number(id));
  if (!m) throw new FehlerEingabe('Meldung nicht gefunden', 404);
  if (m.status !== 'offen') throw new FehlerEingabe('Diese Meldung ist schon erledigt.', 409);
  if (art && m.art !== art) throw new FehlerEingabe('Das geht nur bei Fehlermeldungen.');
  return m;
}

function abschliessen(s, m, status, { notiz = null, materialId = m.material_id } = {}) {
  m.status = status;
  m.admin_notiz = notiz;
  m.material_id = materialId;
  sichern(s);
}

/**
 * Übernimmt den Vorschlag einer Fehlermeldung als Wert des Materials.
 * wertdaten wie bei setzeWert (zahl, einheit, text, option_id, ja_nein, vermerk_de, ...); der Admin kann ihn vorher korrigieren.
 */
export function uebernehmeFehler(s, id, wertdaten) {
  const m = offeneMeldung(s, id, 'fehler');
  if (!m.inhalt.eigenschaft) throw new FehlerEingabe('Diese Meldung nennt keinen Wert zum Übernehmen. Bitte als erledigt markieren.');
  setzeWert(s, m.material_id, m.inhalt.eigenschaft, wertdaten ?? {});
  abschliessen(s, m, 'uebernommen');
}

/** Markiert eine Meldung als erledigt, z. B. nachdem aus einem Vorschlag ein Material angelegt wurde. */
export function schliesseAb(s, id, materialId = null) {
  const m = offeneMeldung(s, id);
  let ziel = m.material_id;
  if (materialId !== null && materialId !== undefined) {
    const mid = Number(materialId);
    if (!Number.isInteger(mid) || !s.material(mid)) throw new FehlerEingabe('Material nicht gefunden', 404);
    ziel = mid;
  }
  abschliessen(s, m, 'uebernommen', { materialId: ziel });
}

export function lehneAb(s, id, notiz = null) {
  const m = offeneMeldung(s, id);
  const n = notiz === null || notiz === undefined ? null : String(notiz).trim().slice(0, 500) || null;
  abschliessen(s, m, 'abgelehnt', { notiz: n });
}
