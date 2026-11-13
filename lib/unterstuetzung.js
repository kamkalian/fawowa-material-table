// "Projekt unterstützen": Zahlungswege, Fortschrittsbalken und Unterstützer. Die Einstellungen stehen in der .env (siehe .env.example).
//
// Zwei Speicherorte:
//   Daten-Repo (unterstuetzer.json, öffentlich, mit Commit): Personen mit Anzeigename, die der Anzeige zugestimmt haben (Ko-fi: "öffentlich"
//                  angehakt, sonst vom Betreiber eingetragen), mit beliebig vielen Abzeichen, die der Betreiber von Hand vergibt (auch für Hilfe
//                  ohne Geld, z. B. Ideen). Änderungen im Repo gelten nach "Aus dem Repo laden".
//   lokal (data/lokal/unterstuetzung.json, nicht öffentlich): jeder Geldeingang mit Betrag, Zeitpunkt, Weg und optional einer Person.
// Öffentlich sichtbar sind nur der Gesamtstand des Balkens sowie Name und Abzeichen der Unterstützer, nie ihre Beträge.
// Von Ko-fi werden nur Betrag, Nachrichten-ID und, bei öffentlichen Beiträgen, der angezeigte Name übernommen (keine Adressen, E-Mails, Nachrichten).

import { timingSafeEqual } from 'node:crypto';
import { FehlerEingabe } from './fehler.js';
import { ABZEICHEN_IDS, normalisiereAbzeichen } from './abzeichen.js';

export const QUELLEN = ['kofi', 'paypal', 'ueberweisung', 'sonstige'];
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
  return {
    aktiv: !!(wege.kofi || wege.paypal || wege.ueberweisung),
    wege,
    ziel: zahl(env.SUPPORT_GOAL),
    waehrung: (text(env.SUPPORT_CURRENCY, 3) || 'EUR').toUpperCase(),
    zeitraum: String(env.SUPPORT_PERIOD ?? '').trim().toLowerCase() === 'monat' ? 'monat' : 'gesamt',
    wiederkehrendMonate: Math.max(2, Math.floor(zahl(env.SUPPORT_RECURRING_MONTHS)) || 2),
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
// Unterstützer (Name, Abzeichen, Zustimmung) liegen im Daten-Repo (s.unterstuetzer, Datei unterstuetzer.json) und werden wie die
// Materialien mit Commit gespeichert. Die Geldeingänge mit Beträgen bleiben lokal (data/lokal/unterstuetzung.json).

const DATEI_EINGAENGE = DATEI;

/** Liest die Eingänge. Das alte Format (nur eine Liste von Ko-fi-Beträgen) wird dabei übernommen. */
function eingaengeLesen(s) {
  const roh = s.lokal.lies(DATEI_EINGAENGE, null);
  if (!roh) return [];
  if (Array.isArray(roh)) {
    return roh.map((b, i) => ({
      id: i + 1, betrag: b.betrag, waehrung: b.waehrung, datum: b.erhalten_am, quelle: 'kofi', unterstuetzer_id: null, nachricht_id: b.nachricht_id ?? null
    }));
  }
  return roh.eingaenge ?? [];
}
const eingaengeSchreiben = (s, eingaenge) => s.lokal.schreibe(DATEI_EINGAENGE, { eingaenge });
const lade = (s) => ({ eingaenge: eingaengeLesen(s), unterstuetzer: s.unterstuetzer });

const naechsteId = (liste) => Math.max(0, ...liste.map(x => x.id)) + 1;
/** Neue Unterstützer-ID: auch IDs, auf die noch Eingänge zeigen, werden nicht wiederverwendet (z. B. nach dem Löschen im Repo) */
const neueUnterstuetzerId = (s, eingaenge) => Math.max(0, ...s.unterstuetzer.map(u => u.id), ...eingaenge.map(e => e.unterstuetzer_id ?? 0)) + 1;
const jetztText = (d = new Date()) => d.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Übernimmt Unterstützer aus der früheren lokalen Datei in das Daten-Repo (einmalig beim Start) und lässt dort nur noch die Eingänge.
 * Gibt die Zahl der übernommenen Personen zurück.
 */
export function uebernehmeLokaleUnterstuetzer(s) {
  const roh = s.lokal.lies(DATEI_EINGAENGE, null);
  if (!roh || Array.isArray(roh) || !Array.isArray(roh.unterstuetzer)) return 0;
  const neu = roh.unterstuetzer
    .filter(u => text(u?.name, 60) && !nameFinden({ unterstuetzer: s.unterstuetzer }, u.name.trim()))
    .map(u => ({ id: u.id, name: u.name.trim().slice(0, 60), abzeichen: normalisiereAbzeichen(u.abzeichen), zustimmung_am: u.zustimmung_am ?? jetztText(), zustimmung_art: u.zustimmung_art === 'kofi-oeffentlich' ? 'kofi-oeffentlich' : 'manuell' }));
  if (neu.length) {
    s.aendere(() => {
      for (const u of neu) {
        // Die IDs bleiben, damit die Zuordnung der Eingänge erhalten bleibt; bei Kollision mit einer vorhandenen ID wird eine neue vergeben
        if (!Number.isInteger(u.id) || s.unterstuetzer.some(x => x.id === u.id)) u.id = neueUnterstuetzerId(s, roh.eingaenge ?? []);
        s.unterstuetzer.push(u);
      }
      s.protokoll(`${neu.length} Unterstützer aus der lokalen Datei übernommen`);
    });
  }
  eingaengeSchreiben(s, roh.eingaenge ?? []);
  return neu.length;
}

// --- Rechnen ---

/** Kalendermonat (Zeit in Deutschland) eines Zeitpunkts als "2026-11" */
const monatVon = (datum) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(datum);
const zeitpunkt = (datum) => new Date(String(datum).replace(' ', 'T') + 'Z');
const runden = (n) => Math.round(n * 100) / 100;

const monatsIndex = (datum) => {
  const [j, m] = monatVon(zeitpunkt(datum)).split('-').map(Number);
  return j * 12 + m;
};

/**
 * Unterstützt eine Person regelmäßig? Ja bei einer Ko-fi-Abo-Zahlung oder wenn in mindestens `monate` aufeinanderfolgenden
 * Kalendermonaten Geld eingegangen ist (mehrere Eingänge im selben Monat zählen als einer).
 */
export function istWiederkehrend(eingaenge, monate = 2) {
  if (eingaenge.some(e => e.abo)) return true;
  const monateListe = [...new Set(eingaenge.map(e => monatsIndex(e.datum)))].sort((a, b) => a - b);
  let lauf = 0; let laengster = 0;
  monateListe.forEach((m, i) => {
    lauf = i > 0 && m === monateListe[i - 1] + 1 ? lauf + 1 : 1;
    laengster = Math.max(laengster, lauf);
  });
  return laengster >= monate;
}

/**
 * Vergibt das Abzeichen "Wiederkehrend" automatisch (einmal je Person), sobald die Regel zutrifft. Wer es danach von Hand entfernt,
 * bekommt es nicht wieder; deshalb merkt sich die Person in auto_abzeichen, was schon automatisch vergeben wurde.
 * Fehler hier dürfen den Geldeingang nicht verhindern und werden nur protokolliert.
 */
function pruefeWiederkehrend(s, einst, eingaenge, personId) {
  try {
    const u = s.unterstuetzer.find(x => x.id === personId);
    if (!u || u.abzeichen.includes('wiederkehrend') || u.auto_abzeichen?.includes('wiederkehrend')) return;
    const meine = eingaenge.filter(e => e.unterstuetzer_id === u.id);
    if (!istWiederkehrend(meine, einst?.wiederkehrendMonate ?? 2)) return;
    s.aendere(() => {
      u.abzeichen = normalisiereAbzeichen([...u.abzeichen, 'wiederkehrend']);
      u.auto_abzeichen = normalisiereAbzeichen([...(u.auto_abzeichen ?? []), 'wiederkehrend']);
      s.protokoll(`Unterstützer »${u.name}«: Abzeichen Wiederkehrend automatisch vergeben`);
    });
  } catch (e) {
    console.error('Abzeichen "Wiederkehrend" konnte nicht vergeben werden:', e.message);
  }
}

/** Summe der Eingänge in der eingestellten Währung; bei zeitraum "monat" nur die des laufenden Monats */
function summe(daten, einst, jetzt) {
  return runden(daten.eingaenge
    .filter(e => e.waehrung === einst.waehrung && (einst.zeitraum !== 'monat' || monatVon(zeitpunkt(e.datum)) === monatVon(jetzt)))
    .reduce((n, e) => n + e.betrag, 0));
}

/** Unterstützer mit Gesamtsumme (über alle Zeit) und Anzahl der Eingänge */
function mitSummen(daten, einst) {
  return daten.unterstuetzer.map(u => {
    const meine = daten.eingaenge.filter(e => e.unterstuetzer_id === u.id && e.waehrung === einst.waehrung);
    const gesamt = runden(meine.reduce((n, e) => n + e.betrag, 0));
    return { ...u, gesamt, anzahl: meine.length };
  });
}

// Mit Abzeichen zuerst (nach dem ersten Abzeichen in der Reihenfolge der Auswahl), dann ohne; innerhalb davon nach Name
const rang = (u) => (u.abzeichen.length ? ABZEICHEN_IDS.indexOf(u.abzeichen[0]) : ABZEICHEN_IDS.length);

// --- Öffentlich ---

/** Angaben für die Oberfläche (öffentlich): keine Beträge einzelner Personen */
export function oeffentlicheAngaben(s, einst, jetzt = new Date()) {
  if (!einst?.aktiv) return null;
  const daten = lade(s);
  const unterstuetzer = mitSummen(daten, einst)
    .sort((a, b) => rang(a) - rang(b) || a.name.localeCompare(b.name, 'de'))
    .map(u => ({ name: u.name, abzeichen: u.abzeichen }));
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

/** Alles für die Verwaltung: Stand, Unterstützer mit Summen, Eingänge (neueste zuerst) */
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

/** Legt eine Person im Speicher an (muss innerhalb von s.aendere laufen) und vermerkt es im Commit-Text */
function unterstuetzerAnlegen(s, eingaenge, name, art, jetzt) {
  const u = { id: neueUnterstuetzerId(s, eingaenge), name, abzeichen: [], auto_abzeichen: [], zustimmung_am: jetztText(jetzt), zustimmung_art: art };
  s.unterstuetzer.push(u);
  s.protokoll(`Unterstützer »${name}« angelegt${art === 'kofi-oeffentlich' ? ' (Ko-fi, öffentlich)' : art === 'meldung' ? ' (Zustimmung beim Melden)' : ''}`);
  return u;
}

/** Findet die Person mit diesem Namen oder legt sie an (mit Commit) */
function findeOderLegeAn(s, eingaenge, name, art, jetzt) {
  const vorhanden = nameFinden({ unterstuetzer: s.unterstuetzer }, name);
  return vorhanden ?? s.aendere(() => unterstuetzerAnlegen(s, eingaenge, name, art, jetzt));
}

/**
 * Trägt einen Geldeingang von Hand ein (Überweisung, PayPal, Sonstiges).
 * Ein Name wird nur mit ausdrücklicher Zustimmung gespeichert; ohne Namen bleibt der Eingang anonym und zählt nur für den Balken.
 */
export function traegeEingangEin(s, einst, eingabe, jetzt = new Date()) {
  const betrag = betragPruefen(eingabe.betrag);
  const datum = datumPruefen(eingabe.datum, jetzt);
  if (!QUELLEN.includes(eingabe.quelle) || eingabe.quelle === 'kofi') throw new FehlerEingabe('Weg: Überweisung, PayPal oder Sonstiges');
  const eingaenge = eingaengeLesen(s);

  let unterstuetzerId = null;
  if (eingabe.unterstuetzer_id) {
    const u = s.unterstuetzer.find(x => x.id === Number(eingabe.unterstuetzer_id));
    if (!u) throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
    unterstuetzerId = u.id;
  } else {
    const name = text(eingabe.name, 60);
    if (name) {
      if (eingabe.zustimmung !== true) throw new FehlerEingabe('Ein Name wird nur mit Zustimmung zur Anzeige gespeichert. Ohne Zustimmung den Namen weglassen.');
      unterstuetzerId = findeOderLegeAn(s, eingaenge, name, 'manuell', jetzt).id;
    }
  }
  const eingang = { id: naechsteId(eingaenge), betrag, waehrung: einst.waehrung, datum, quelle: eingabe.quelle, unterstuetzer_id: unterstuetzerId, nachricht_id: null };
  eingaenge.push(eingang);
  eingaengeSchreiben(s, eingaenge);
  if (unterstuetzerId) pruefeWiederkehrend(s, einst, eingaenge, unterstuetzerId);
  return eingang.id;
}

/**
 * Ändert Betrag, Datum und Weg eines Eingangs und ordnet ihn einer Person zu:
 * unterstuetzer_id (Zahl) für eine vorhandene Person, null für anonym, oder name mit zustimmung: true für eine neue (oder gleichnamige) Person.
 * So lässt sich bei einem Ko-fi-Beitrag, der anonym ankam, der Name nachtragen.
 */
export function aendereEingang(s, einst, id, patch, jetzt = new Date()) {
  const eingaenge = eingaengeLesen(s);
  const e = eingaenge.find(x => x.id === Number(id));
  if (!e) throw new FehlerEingabe('Eingang nicht gefunden', 404);
  const neu = { ...e };
  if ('unterstuetzer_id' in patch) {
    if (patch.unterstuetzer_id === null) neu.unterstuetzer_id = null;
    else if (s.unterstuetzer.some(u => u.id === Number(patch.unterstuetzer_id))) neu.unterstuetzer_id = Number(patch.unterstuetzer_id);
    else throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
  } else if ('name' in patch) {
    const name = text(patch.name, 60);
    if (!name) throw new FehlerEingabe('Name fehlt');
    if (patch.zustimmung !== true) throw new FehlerEingabe('Ein Name wird nur mit Zustimmung zur Anzeige gespeichert.');
    neu.unterstuetzer_id = findeOderLegeAn(s, eingaenge, name, 'manuell', jetzt).id;
  }
  if ('betrag' in patch) neu.betrag = betragPruefen(patch.betrag);
  if ('datum' in patch) neu.datum = datumPruefen(patch.datum, jetzt);
  if ('quelle' in patch) {
    if (!QUELLEN.includes(patch.quelle)) throw new FehlerEingabe('Weg unbekannt');
    neu.quelle = patch.quelle;
  }
  Object.assign(e, neu);
  eingaengeSchreiben(s, eingaenge);
  if (e.unterstuetzer_id) pruefeWiederkehrend(s, einst, eingaenge, e.unterstuetzer_id);
}

export function loescheEingang(s, id) {
  const eingaenge = eingaengeLesen(s);
  const i = eingaenge.findIndex(x => x.id === Number(id));
  if (i < 0) throw new FehlerEingabe('Eingang nicht gefunden', 404);
  eingaenge.splice(i, 1);
  eingaengeSchreiben(s, eingaenge);
}

/**
 * Legt eine Person ohne Geldeingang an, z. B. jemanden, der mit Ideen hilft. Nur mit Zustimmung zur Anzeige des Namens.
 * Gibt die ID zurück. Gibt es den Namen schon, ist das ein Fehler.
 */
export function legeUnterstuetzerAn(s, eingabe, jetzt = new Date(), art = 'manuell') {
  const name = text(eingabe.name, 60);
  if (!name) throw new FehlerEingabe('Name fehlt');
  if (eingabe.zustimmung !== true) throw new FehlerEingabe('Ein Name wird nur mit Zustimmung zur Anzeige gespeichert.');
  if (nameFinden({ unterstuetzer: s.unterstuetzer }, name)) throw new FehlerEingabe('Diesen Namen gibt es schon', 409);
  const abzeichen = abzeichenPruefen(eingabe.abzeichen ?? []);
  const eingaenge = eingaengeLesen(s);
  return s.aendere(() => {
    const u = unterstuetzerAnlegen(s, eingaenge, name, art, jetzt);
    u.abzeichen = abzeichen;
    return u.id;
  });
}

function abzeichenPruefen(wert) {
  if (wert !== null && !Array.isArray(wert) && wert !== '') throw new FehlerEingabe('Abzeichen: eine Liste erwartet');
  const liste = Array.isArray(wert) ? wert : [];
  if (liste.some(id => !ABZEICHEN_IDS.includes(id))) throw new FehlerEingabe('Abzeichen unbekannt');
  return normalisiereAbzeichen(liste);
}

/** Ändert Anzeigename und/oder Abzeichen (Liste von IDs aus lib/abzeichen.js, leer = keine) */
export function aendereUnterstuetzer(s, id, patch) {
  const u = s.unterstuetzer.find(x => x.id === Number(id));
  if (!u) throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
  const name = 'name' in patch ? text(patch.name, 60) : u.name;
  if (!name) throw new FehlerEingabe('Name fehlt');
  const andere = nameFinden({ unterstuetzer: s.unterstuetzer }, name);
  if (andere && andere.id !== u.id) throw new FehlerEingabe('Diesen Namen gibt es schon', 409);
  const abzeichen = 'abzeichen' in patch ? abzeichenPruefen(patch.abzeichen) : u.abzeichen;

  s.aendere(() => {
    if (name !== u.name) {
      s.protokoll(`Unterstützer »${u.name}« umbenannt in »${name}«`);
      u.name = name;
    }
    if (JSON.stringify(abzeichen) !== JSON.stringify(u.abzeichen)) {
      s.protokoll(`Unterstützer »${u.name}«: Abzeichen ${u.abzeichen.join(', ') || '–'} → ${abzeichen.join(', ') || '–'}`);
      u.abzeichen = abzeichen;
    }
  });
}

/** Entfernt eine Person (Widerruf der Zustimmung). Ihre Eingänge bleiben anonym erhalten und zählen weiter für den Balken. */
export function loescheUnterstuetzer(s, id) {
  const u = s.unterstuetzer.find(x => x.id === Number(id));
  if (!u) throw new FehlerEingabe('Unterstützer nicht gefunden', 404);
  s.aendere(() => {
    s.unterstuetzer.splice(s.unterstuetzer.indexOf(u), 1);
    s.protokoll(`Unterstützer »${u.name}« entfernt`);
  });
  const eingaenge = eingaengeLesen(s);
  for (const e of eingaenge) if (e.unterstuetzer_id === u.id) e.unterstuetzer_id = null;
  eingaengeSchreiben(s, eingaenge);
}

// --- Ko-fi ---

const gleich = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Verarbeitet eine Meldung von Ko-fi (Formularfeld "data" mit JSON). Ergebnis:
 * 'gespeichert' | 'doppelt' | 'ungueltig' (falscher Token oder kaputte Daten) | 'ignoriert ...' (kein Betrag, andere Währung)
 * Der Name wird nur übernommen, wenn der Beitrag bei Ko-fi als öffentlich markiert ist. Lässt sich die Person gerade nicht speichern
 * (z. B. weil die Dateien im Repo Fehler haben), zählt der Betrag trotzdem, nur ohne Namen.
 */
export function verarbeiteWebhook(s, body, { token, waehrung, wiederkehrendMonate = 2 }, jetzt = new Date()) {
  let eingabe;
  try { eingabe = JSON.parse(String(body?.data ?? '')); } catch { return 'ungueltig'; }
  if (!token || !eingabe || !gleich(eingabe.verification_token ?? '', token)) return 'ungueltig';

  const betrag = zahl(eingabe.amount);
  const id = text(eingabe.message_id ?? eingabe.kofi_transaction_id, 100);
  if (!betrag || !id) return 'ignoriert (kein Betrag oder keine Nummer)';
  if (String(eingabe.currency || waehrung).toUpperCase() !== waehrung) {
    return `ignoriert (Währung ${String(eingabe.currency).slice(0, 5)}, erwartet ${waehrung})`;
  }

  const eingaenge = eingaengeLesen(s);
  if (eingaenge.some(e => e.nachricht_id === id)) return 'doppelt';

  let unterstuetzerId = null;
  const name = text(eingabe.from_name, 60);
  if (name && (eingabe.is_public === true || eingabe.is_public === 'true')) {
    try {
      unterstuetzerId = findeOderLegeAn(s, eingaenge, name, 'kofi-oeffentlich', jetzt).id;
    } catch (e) {
      console.error('Ko-fi: Unterstützer konnte nicht gespeichert werden:', e.message);
    }
  }
  const abo = eingabe.is_subscription_payment === true || eingabe.is_subscription_payment === 'true';
  eingaenge.push({ id: naechsteId(eingaenge), betrag, waehrung, datum: jetztText(jetzt), quelle: 'kofi', unterstuetzer_id: unterstuetzerId, nachricht_id: id, ...(abo ? { abo: true } : {}) });
  eingaengeSchreiben(s, eingaenge);
  if (unterstuetzerId) pruefeWiederkehrend(s, { wiederkehrendMonate }, eingaenge, unterstuetzerId);
  return 'gespeichert';
}
