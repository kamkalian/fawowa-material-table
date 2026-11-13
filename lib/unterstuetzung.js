// "Projekt unterstützen": Zahlungswege, Fortschrittsbalken und Unterstützer. Die Einstellungen stehen in der .env (siehe .env.example).
//
// Gespeichert wird lokal in data/lokal/unterstuetzung.json (nicht im öffentlichen Daten-Repo):
//   eingaenge:     jeder Geldeingang mit Betrag, Zeitpunkt, Weg und optional einem Unterstützer
//   unterstuetzer: Personen mit Anzeigename, die der Anzeige zugestimmt haben (Ko-fi: "öffentlich" angehakt, sonst vom Betreiber eingetragen)
// Öffentlich sichtbar sind nur der Gesamtstand des Balkens sowie Name und Abzeichen der Unterstützer, nie ihre Beträge.
// Von Ko-fi werden nur Betrag, Nachrichten-ID und, bei öffentlichen Beiträgen, der angezeigte Name übernommen (keine Adressen, E-Mails, Nachrichten).

import { timingSafeEqual } from 'node:crypto';
import { FehlerEingabe } from './fehler.js';

export const QUELLEN = ['kofi', 'paypal', 'ueberweisung', 'sonstige'];
export const STUFEN = ['bronze', 'silber', 'gold', 'platin']; // aufsteigend
const STANDARD_SCHWELLEN = { bronze: 1, silber: 10, gold: 50, platin: 150 };
const DATEI = 'unterstuetzung';

const zahl = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const text = (v, max = 300) => {
  const t = String(v ?? '').trim().slice(0, max);
  return t || null;
};
const https = (v) => {
  const t = text(v, 500);
  return t && /^https:\/\/\S+$/i.test(t) ? t : null;
};
const zweisprachig = (env, name, max) => ({ de: text(env[`${name}_DE`], max), en: text(env[`${name}_EN`], max) });

/** Liest die Einstellungen aus den Umgebungsvariablen. `aktiv` ist wahr, sobald mindestens ein Zahlungsweg eingerichtet ist. */
export function ladeUnterstuetzung(env = process.env) {
  const iban = text(env.SUPPORT_BANK_IBAN, 50);
  const inhaber = text(env.SUPPORT_BANK_HOLDER, 100);
  const wege = {
    kofi: https(env.SUPPORT_URL),
    paypal: https(env.SUPPORT_PAYPAL_URL),
    ueberweisung: iban && inhaber ? { inhaber, iban, bic: text(env.SUPPORT_BANK_BIC, 20), zweck: text(env.SUPPORT_BANK_REFERENCE, 100) } : null
  };
  const schwellen = {};
  for (const stufe of STUFEN) schwellen[stufe] = zahl(env[`SUPPORT_BADGE_${stufe.toUpperCase()}`]) || STANDARD_SCHWELLEN[stufe];
  return {
    aktiv: !!(wege.kofi || wege.paypal || wege.ueberweisung),
    wege,
    ziel: zahl(env.SUPPORT_GOAL),
    waehrung: (text(env.SUPPORT_CURRENCY, 3) || 'EUR').toUpperCase(),
    zeitraum: String(env.SUPPORT_PERIOD ?? '').trim().toLowerCase() === 'monat' ? 'monat' : 'gesamt',
    schwellen,
    text: zweisprachig(env, 'SUPPORT_TEXT', 200),
    zielText: zweisprachig(env, 'SUPPORT_GOAL_LABEL', 100),
    webhook: !!text(env.KOFI_VERIFICATION_TOKEN)
  };
}

/** "Powered by": Name (und optional Adresse) des Betreibers der Firma, aus POWERED_BY und POWERED_BY_URL */
export function ladePoweredBy(env = process.env) {
  const name = text(env.POWERED_BY, 100);
  return name ? { name, url: https(env.POWERED_BY_URL) } : null;
}

// --- Speicher ---

const leer = () => ({ eingaenge: [], unterstuetzer: [] });

/** Liest die Daten. Das alte Format (nur eine Liste von Ko-fi-Beträgen) wird dabei übernommen. */
function lade(s) {
  const roh = s.lokal.lies(DATEI, null);
  if (!roh) return leer();
  if (Array.isArray(roh)) {
    return {
      eingaenge: roh.map((b, i) => ({
        id: i + 1, betrag: b.betrag, waehrung: b.waehrung, datum: b.erhalten_am, quelle: 'kofi', unterstuetzer_id: null, nachricht_id: b.nachricht_id ?? null
      })),
      unterstuetzer: []
    };
  }
  return { eingaenge: roh.eingaenge ?? [], unterstuetzer: roh.unterstuetzer ?? [] };
}
const speichere = (s, daten) => s.lokal.schreibe(DATEI, daten);
const naechsteId = (liste) => Math.max(0, ...liste.map(x => x.id)) + 1;
const jetztText = (d = new Date()) => d.toISOString().slice(0, 19).replace('T', ' ');

// --- Rechnen ---

/** Kalendermonat (Zeit in Deutschland) eines Zeitpunkts als "2026-11" */
const monatVon = (datum) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(datum);
const zeitpunkt = (datum) => new Date(String(datum).replace(' ', 'T') + 'Z');
const runden = (n) => Math.round(n * 100) / 100;

/** Summe der Eingänge in der eingestellten Währung; bei zeitraum "monat" nur die des laufenden Monats */
function summe(daten, einst, jetzt) {
  return runden(daten.eingaenge
    .filter(e => e.waehrung === einst.waehrung && (einst.zeitraum !== 'monat' || monatVon(zeitpunkt(e.datum)) === monatVon(jetzt)))
    .reduce((n, e) => n + e.betrag, 0));
}

/** Höchste Stufe, deren Schwelle erreicht ist (null bei 0 oder darunter) */
export function stufeFuer(betrag, schwellen) {
  let stufe = null;
  for (const name of STUFEN) if (betrag > 0 && betrag >= schwellen[name]) stufe = name;
  return stufe;
}

/** Unterstützer mit Gesamtsumme (über alle Zeit), Anzahl der Eingänge und Stufe */
function mitSummen(daten, einst) {
  return daten.unterstuetzer.map(u => {
    const meine = daten.eingaenge.filter(e => e.unterstuetzer_id === u.id && e.waehrung === einst.waehrung);
    const gesamt = runden(meine.reduce((n, e) => n + e.betrag, 0));
    return { ...u, gesamt, anzahl: meine.length, stufe: stufeFuer(gesamt, einst.schwellen) };
  });
}

const rang = (stufe) => STUFEN.indexOf(stufe);

// --- Öffentlich ---

/** Angaben für die Oberfläche (öffentlich): keine Beträge einzelner Personen */
export function oeffentlicheAngaben(s, einst, jetzt = new Date()) {
  if (!einst?.aktiv) return null;
  const daten = lade(s);
  const unterstuetzer = mitSummen(daten, einst)
    .filter(u => u.stufe)
    .sort((a, b) => rang(b.stufe) - rang(a.stufe) || a.name.localeCompare(b.name, 'de'))
    .map(u => ({ name: u.name, stufe: u.stufe }));
  return {
    wege: einst.wege,
    ziel: einst.ziel,
    erreicht: summe(daten, einst, jetzt),
    waehrung: einst.waehrung,
    zeitraum: einst.zeitraum,
    text: einst.text,
    zielText: einst.zielText,
    webhook: einst.webhook,
    unterstuetzer
  };
}

// --- Admin ---

/** Alles für die Verwaltung: Stand, Unterstützer mit Summen und Stufe, Eingänge (neueste zuerst) */
export function uebersichtUnterstuetzung(s, einst, jetzt = new Date()) {
  const daten = lade(s);
  const unterstuetzer = mitSummen(daten, einst).sort((a, b) => b.gesamt - a.gesamt || a.name.localeCompare(b.name, 'de'));
  const namen = new Map(unterstuetzer.map(u => [u.id, u.name]));
  return {
    waehrung: einst.waehrung,
    ziel: einst.ziel,
    zeitraum: einst.zeitraum,
    erreicht: summe(daten, einst, jetzt),
    gesamt: runden(daten.eingaenge.filter(e => e.waehrung === einst.waehrung).reduce((n, e) => n + e.betrag, 0)),
    schwellen: einst.schwellen,
    unterstuetzer,
    eingaenge: daten.eingaenge
      .map(e => ({ ...e, unterstuetzer_name: namen.get(e.unterstuetzer_id) ?? null }))
      .sort((a, b) => String(b.datum).localeCompare(String(a.datum)) || b.id - a.id)
  };
}

function betragPruefen(v) {
  const n = zahl(v);
  if (!n || n > 100000) throw new FehlerEingabe('Betrag: eine Zahl größer als 0 (höchstens 100000)');
  return runden(n);
}

function datumPruefen(v, jetzt) {
  const t = String(v ?? '').trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T12:00:00Z`) : null;
  if (!d || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) throw new FehlerEingabe('Datum: bitte im Format JJJJ-MM-TT angeben');
  if (d > new Date(jetzt.getTime() + 2 * 24 * 3600 * 1000)) throw new FehlerEingabe('Das Datum liegt in der Zukunft');
  return `${t} 12:00:00`;
}

function nameFinden(daten, name) {
  const schluessel = name.toLowerCase();
  return daten.unterstuetzer.find(u => u.name.toLowerCase() === schluessel) ?? null;
}

function unterstuetzerAnlegen(daten, name, art, jetzt) {
  const u = { id: naechsteId(daten.unterstuetzer), name, zustimmung_am: jetztText(jetzt), zustimmung_art: art };
  daten.unterstuetzer.push(u);
  return u;
}

/**
 * Trägt einen Geldeingang von Hand ein (Überweisung, PayPal, Sonstiges).
 * Ein Name wird nur mit ausdrücklicher Zustimmung gespeichert; ohne Namen bleibt der Eingang anonym und zählt nur für den Balken.
 */
export function traegeEingangEin(s, einst, eingabe, jetzt = new Date()) {
  const betrag = betragPruefen(eingabe.betrag);
  const datum = datumPruefen(eingabe.datum, jetzt);
  if (!QUELLEN.includes(eingabe.quelle) || eingabe.quelle === 'kofi') throw new FehlerEingabe('Weg: Überweisung, PayPal oder Sonstiges');
  const daten = lade(s);

  let unterstuetzerId = null;
  if (eingabe.unterstuetzer_id) {
    const u = daten.unterstuetzer.find(x => x.id === Number(eingabe.unterstuetzer_id));
    if (!u) throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
    unterstuetzerId = u.id;
  } else {
    const name = text(eingabe.name, 60);
    if (name) {
      if (eingabe.zustimmung !== true) throw new FehlerEingabe('Ein Name wird nur mit Zustimmung zur Anzeige gespeichert. Ohne Zustimmung den Namen weglassen.');
      unterstuetzerId = (nameFinden(daten, name) ?? unterstuetzerAnlegen(daten, name, 'manuell', jetzt)).id;
    }
  }
  const eingang = { id: naechsteId(daten.eingaenge), betrag, waehrung: einst.waehrung, datum, quelle: eingabe.quelle, unterstuetzer_id: unterstuetzerId, nachricht_id: null };
  daten.eingaenge.push(eingang);
  speichere(s, daten);
  return eingang.id;
}

export function aendereEingang(s, einst, id, patch, jetzt = new Date()) {
  const daten = lade(s);
  const e = daten.eingaenge.find(x => x.id === Number(id));
  if (!e) throw new FehlerEingabe('Eingang nicht gefunden', 404);
  if ('betrag' in patch) e.betrag = betragPruefen(patch.betrag);
  if ('datum' in patch) e.datum = datumPruefen(patch.datum, jetzt);
  if ('quelle' in patch) {
    if (!QUELLEN.includes(patch.quelle)) throw new FehlerEingabe('Weg unbekannt');
    e.quelle = patch.quelle;
  }
  speichere(s, daten);
}

export function loescheEingang(s, id) {
  const daten = lade(s);
  const i = daten.eingaenge.findIndex(x => x.id === Number(id));
  if (i < 0) throw new FehlerEingabe('Eingang nicht gefunden', 404);
  daten.eingaenge.splice(i, 1);
  speichere(s, daten);
}

export function benenneUnterstuetzer(s, id, name) {
  const daten = lade(s);
  const u = daten.unterstuetzer.find(x => x.id === Number(id));
  if (!u) throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
  const neu = text(name, 60);
  if (!neu) throw new FehlerEingabe('Name fehlt');
  const andere = nameFinden(daten, neu);
  if (andere && andere.id !== u.id) throw new FehlerEingabe('Diesen Namen gibt es schon', 409);
  u.name = neu;
  speichere(s, daten);
}

/** Entfernt eine Person (Widerruf der Zustimmung). Ihre Eingänge bleiben anonym erhalten und zählen weiter für den Balken. */
export function loescheUnterstuetzer(s, id) {
  const daten = lade(s);
  const i = daten.unterstuetzer.findIndex(x => x.id === Number(id));
  if (i < 0) throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
  const [u] = daten.unterstuetzer.splice(i, 1);
  for (const e of daten.eingaenge) if (e.unterstuetzer_id === u.id) e.unterstuetzer_id = null;
  speichere(s, daten);
}

// --- Ko-fi ---

const gleich = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Verarbeitet eine Meldung von Ko-fi (Formularfeld "data" mit JSON). Ergebnis:
 * 'gespeichert' | 'doppelt' | 'ungueltig' (falscher Token oder kaputte Daten) | 'ignoriert ...' (kein Betrag, andere Währung)
 * Der Name wird nur übernommen, wenn der Beitrag bei Ko-fi als öffentlich markiert ist.
 */
export function verarbeiteWebhook(s, body, { token, waehrung }, jetzt = new Date()) {
  let eingabe;
  try { eingabe = JSON.parse(String(body?.data ?? '')); } catch { return 'ungueltig'; }
  if (!token || !eingabe || !gleich(eingabe.verification_token ?? '', token)) return 'ungueltig';

  const betrag = zahl(eingabe.amount);
  const id = text(eingabe.message_id ?? eingabe.kofi_transaction_id, 100);
  if (!betrag || !id) return 'ignoriert (kein Betrag oder keine Nummer)';
  if (String(eingabe.currency || waehrung).toUpperCase() !== waehrung) {
    return `ignoriert (Währung ${String(eingabe.currency).slice(0, 5)}, erwartet ${waehrung})`;
  }

  const daten = lade(s);
  if (daten.eingaenge.some(e => e.nachricht_id === id)) return 'doppelt';

  let unterstuetzerId = null;
  const name = text(eingabe.from_name, 60);
  if (name && (eingabe.is_public === true || eingabe.is_public === 'true')) {
    unterstuetzerId = (nameFinden(daten, name) ?? unterstuetzerAnlegen(daten, name, 'kofi-oeffentlich', jetzt)).id;
  }
  daten.eingaenge.push({ id: naechsteId(daten.eingaenge), betrag, waehrung, datum: jetztText(jetzt), quelle: 'kofi', unterstuetzer_id: unterstuetzerId, nachricht_id: id });
  speichere(s, daten);
  return 'gespeichert';
}
