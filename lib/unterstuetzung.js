// "Projekt unterstützen": Angaben für Fußzeile und Fortschrittsbalken. Alles wird in der .env eingestellt (siehe .env.example).
// Der erreichte Betrag ist SUPPORT_RAISED (von Hand) plus die über den Ko-fi-Webhook gemeldeten Beträge.
// Von Ko-fi werden nur Betrag und Transaktionsnummer gespeichert, keine Namen, Adressen oder Nachrichten.

import { timingSafeEqual } from 'node:crypto';

const zahl = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const text = (v, max = 300) => {
  const t = String(v ?? '').trim().slice(0, max);
  return t || null;
};
const zweisprachig = (env, name, max) => ({ de: text(env[`${name}_DE`], max), en: text(env[`${name}_EN`], max) });

/** Liest die Einstellungen aus den Umgebungsvariablen. Ohne gültige SUPPORT_URL gibt es keinen Unterstützen-Bereich. */
export function ladeUnterstuetzung(env = process.env) {
  const url = text(env.SUPPORT_URL, 500);
  if (!url || !/^https:\/\//i.test(url)) return null;
  return {
    url,
    ziel: zahl(env.SUPPORT_GOAL),
    basis: zahl(env.SUPPORT_RAISED),
    waehrung: (text(env.SUPPORT_CURRENCY, 3) || 'EUR').toUpperCase(),
    text: zweisprachig(env, 'SUPPORT_TEXT', 200),
    button: zweisprachig(env, 'SUPPORT_BUTTON', 60),
    zielText: zweisprachig(env, 'SUPPORT_GOAL_LABEL', 100),
    webhook: !!text(env.KOFI_VERIFICATION_TOKEN)
  };
}

/** Summe der über den Webhook gemeldeten Beträge in der eingestellten Währung */
export function summeWebhook(db, waehrung) {
  return db.prepare('SELECT COALESCE(SUM(betrag), 0) AS s FROM unterstuetzung WHERE waehrung = ?').get(waehrung).s;
}

/** Angaben für die Oberfläche (öffentlich) */
export function oeffentlicheAngaben(db, einst) {
  if (!einst) return null;
  const erreicht = Math.round((einst.basis + summeWebhook(db, einst.waehrung)) * 100) / 100;
  return {
    url: einst.url,
    ziel: einst.ziel,
    erreicht,
    waehrung: einst.waehrung,
    text: einst.text,
    button: einst.button,
    zielText: einst.zielText,
    webhook: einst.webhook
  };
}

const gleich = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Verarbeitet eine Meldung von Ko-fi (Formularfeld "data" mit JSON). Ergebnis:
 * 'gespeichert' | 'doppelt' | 'ungueltig' (falscher Token oder kaputte Daten) | 'ignoriert' (kein Betrag, andere Währung)
 */
export function verarbeiteWebhook(db, body, { token, waehrung }) {
  let daten;
  try { daten = JSON.parse(String(body?.data ?? '')); } catch { return 'ungueltig'; }
  if (!token || !daten || !gleich(daten.verification_token ?? '', token)) return 'ungueltig';

  const betrag = zahl(daten.amount);
  const id = text(daten.message_id ?? daten.kofi_transaction_id, 100);
  if (!betrag || !id) return 'ignoriert';
  if (String(daten.currency || waehrung).toUpperCase() !== waehrung) return 'ignoriert';

  const r = db.prepare('INSERT OR IGNORE INTO unterstuetzung (nachricht_id, betrag, waehrung) VALUES (?, ?, ?)').run(id, betrag, waehrung);
  return r.changes ? 'gespeichert' : 'doppelt';
}
