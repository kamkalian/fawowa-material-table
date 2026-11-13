// Anmeldung für den Admin-Bereich: ein Konto, Passwort als Hash in der Umgebungsvariable,
// Sitzung über ein zufälliges Cookie, Wartezeit nach Fehlversuchen: je Adresse (damit niemand das Konto für alle sperren kann)
// und zusätzlich insgesamt bei sehr vielen Fehlversuchen von vielen Adressen.

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export const COOKIE = 'admin_sitzung';
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FEHLVERSUCHE = 5;
const MAX_FEHLVERSUCHE_INSGESAMT = 60;
const MAX_SITZUNGEN = 20;
const WARTEZEIT_MS = 15 * 60 * 1000;

const sitzungen = new Map(); // token -> Ablaufzeit
const versuche = new Map(); // Adresse -> { n, gesperrtBis }
const insgesamt = { n: 0, gesperrtBis: 0 };

// Format "scrypt:<salt-hex>:<hash-hex>". Ohne "$", damit Docker-Compose den Wert nicht verändert.
export function hashPasswort(passwort, salt = randomBytes(16)) {
  const hash = scryptSync(passwort, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function pruefePasswort(passwort, gespeichert) {
  if (!gespeichert) return false;
  const [art, saltHex, hashHex] = gespeichert.trim().split(':');
  if (art !== 'scrypt' || !saltHex || !hashHex) return false;
  const erwartet = Buffer.from(hashHex, 'hex');
  const berechnet = scryptSync(passwort, Buffer.from(saltHex, 'hex'), erwartet.length);
  return timingSafeEqual(erwartet, berechnet);
}

/** Ergebnis: { ok: true } oder { ok: false, grund: 'falsch' | 'gesperrt' | 'nicht_eingerichtet', minuten? }. adresse: IP des Besuchers. */
export function anmelden(passwort, adresse = 'lokal') {
  const gespeichert = process.env.ADMIN_PASSWORD_HASH;
  if (!gespeichert) return { ok: false, grund: 'nicht_eingerichtet' };

  const jetzt = Date.now();
  const mein = versuche.get(adresse) ?? { n: 0, gesperrtBis: 0 };
  const sperre = Math.max(mein.gesperrtBis, insgesamt.gesperrtBis);
  if (sperre > jetzt) {
    return { ok: false, grund: 'gesperrt', minuten: Math.ceil((sperre - jetzt) / 60000) };
  }

  // Bei sehr vielen Fehlversuchen ohne Rücksicht auf die Adresse schützt die Gesamtsperre vor verteilten Angriffen
  if (typeof passwort !== 'string' || passwort.length > 200 || !pruefePasswort(passwort, gespeichert)) {
    mein.n += 1;
    insgesamt.n += 1;
    if (insgesamt.n >= MAX_FEHLVERSUCHE_INSGESAMT) {
      insgesamt.gesperrtBis = jetzt + WARTEZEIT_MS;
      insgesamt.n = 0;
    }
    if (mein.n >= MAX_FEHLVERSUCHE) {
      mein.gesperrtBis = jetzt + WARTEZEIT_MS;
      mein.n = 0;
      versuche.set(adresse, mein);
      return { ok: false, grund: 'gesperrt', minuten: WARTEZEIT_MS / 60000 };
    }
    versuche.set(adresse, mein);
    if (versuche.size > 2000) for (const [k, v] of versuche) if (v.gesperrtBis < jetzt && v.n === 0) versuche.delete(k);
    return { ok: false, grund: 'falsch' };
  }

  versuche.delete(adresse);
  insgesamt.n = 0;
  // Abgelaufene Sitzungen aufräumen und die Zahl begrenzen (die ältesten fallen zuerst heraus)
  for (const [t, ablauf] of sitzungen) if (ablauf < jetzt) sitzungen.delete(t);
  while (sitzungen.size >= MAX_SITZUNGEN) sitzungen.delete(sitzungen.keys().next().value);
  const token = randomBytes(32).toString('hex');
  sitzungen.set(token, jetzt + SESSION_MS);
  return { ok: true, token };
}

export function sitzungGueltig(token) {
  if (!token) return false;
  const ablauf = sitzungen.get(token);
  if (!ablauf) return false;
  if (ablauf < Date.now()) {
    sitzungen.delete(token);
    return false;
  }
  return true;
}

export function abmelden(token) {
  if (token) sitzungen.delete(token);
}

/** Liest das Sitzungs-Cookie aus dem Header. */
export function tokenAusCookie(header) {
  if (!header) return null;
  const teil = header.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`));
  return teil ? teil.slice(COOKIE.length + 1) : null;
}

export function cookieHeader(token, { ablauf = false, secure = false } = {}) {
  const teile = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${ablauf ? 0 : SESSION_MS / 1000}`
  ];
  if (secure) teile.push('Secure');
  return teile.join('; ');
}

/** Für Tests und Hilfsskripte. */
export const _intern = { sitzungen, versuche, reset() { sitzungen.clear(); versuche.clear(); insgesamt.n = 0; insgesamt.gesperrtBis = 0; } };
