// Anmeldung für den Admin-Bereich: ein Konto, Passwort als Hash in der Umgebungsvariable,
// Sitzung über ein zufälliges Cookie, Wartezeit nach Fehlversuchen.

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export const COOKIE = 'admin_sitzung';
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FEHLVERSUCHE = 5;
const WARTEZEIT_MS = 15 * 60 * 1000;

const sitzungen = new Map(); // token -> Ablaufzeit
let fehlversuche = 0;
let gesperrtBis = 0;

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

/** Ergebnis: { ok: true } oder { ok: false, grund: 'falsch' | 'gesperrt' | 'nicht_eingerichtet', minuten? } */
export function anmelden(passwort) {
  const gespeichert = process.env.ADMIN_PASSWORD_HASH;
  if (!gespeichert) return { ok: false, grund: 'nicht_eingerichtet' };

  const jetzt = Date.now();
  if (gesperrtBis > jetzt) {
    return { ok: false, grund: 'gesperrt', minuten: Math.ceil((gesperrtBis - jetzt) / 60000) };
  }

  if (typeof passwort !== 'string' || !pruefePasswort(passwort, gespeichert)) {
    fehlversuche += 1;
    if (fehlversuche >= MAX_FEHLVERSUCHE) {
      gesperrtBis = jetzt + WARTEZEIT_MS;
      fehlversuche = 0;
      return { ok: false, grund: 'gesperrt', minuten: WARTEZEIT_MS / 60000 };
    }
    return { ok: false, grund: 'falsch' };
  }

  fehlversuche = 0;
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
export const _intern = { sitzungen, reset() { sitzungen.clear(); fehlversuche = 0; gesperrtBis = 0; } };
