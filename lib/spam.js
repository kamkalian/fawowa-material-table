// Spam-Schutz für die Meldeformulare, ohne Captcha:
//  - Formular-Token mit Zeitstempel: Das Formular darf erst nach einer Mindestzeit abgeschickt werden
//  - Begrenzung der Meldungen pro Adresse und Stunde
// Das versteckte Feld ("Honigtopf") wird in den Routen geprüft.

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const STANDARD_GEHEIMNIS = process.env.FORM_SECRET ? Buffer.from(process.env.FORM_SECRET) : randomBytes(32);

export const MIN_MS = 3000;                    // so lange muss das Formular mindestens offen gewesen sein
export const MAX_MS = 2 * 60 * 60 * 1000;      // danach ist der Token abgelaufen

function signiere(zeit, geheimnis) {
  return createHmac('sha256', geheimnis).update(zeit).digest('hex').slice(0, 32);
}

export function erzeugeToken(jetzt = Date.now(), geheimnis = STANDARD_GEHEIMNIS) {
  const zeit = String(jetzt);
  return `${zeit}.${signiere(zeit, geheimnis)}`;
}

/** Ergebnis: { ok: true } oder { ok: false, grund: 'ungueltig' | 'zu_schnell' | 'abgelaufen' } */
export function pruefeToken(token, { minMs = MIN_MS, maxMs = MAX_MS, jetzt = Date.now(), geheimnis = STANDARD_GEHEIMNIS } = {}) {
  if (typeof token !== 'string' || token.length > 100) return { ok: false, grund: 'ungueltig' };
  const [zeit, signatur] = token.split('.');
  if (!/^\d{10,16}$/.test(zeit ?? '') || !signatur) return { ok: false, grund: 'ungueltig' };

  const erwartet = Buffer.from(signiere(zeit, geheimnis));
  const erhalten = Buffer.from(signatur);
  if (erwartet.length !== erhalten.length || !timingSafeEqual(erwartet, erhalten)) return { ok: false, grund: 'ungueltig' };

  const alter = jetzt - Number(zeit);
  if (alter < minMs) return { ok: false, grund: 'zu_schnell' };
  if (alter > maxMs) return { ok: false, grund: 'abgelaufen' };
  return { ok: true };
}

/** Höchstens `max` Meldungen je Schlüssel (Adresse) innerhalb des Zeitfensters. Zählung im Arbeitsspeicher. */
export class Begrenzung {
  constructor({ max = 5, fensterMs = 60 * 60 * 1000 } = {}) {
    this.max = max;
    this.fensterMs = fensterMs;
    this.eintraege = new Map(); // schluessel -> Zeitpunkte
  }

  _aktuell(schluessel, jetzt) {
    const liste = (this.eintraege.get(schluessel) ?? []).filter(t => jetzt - t < this.fensterMs);
    if (liste.length) this.eintraege.set(schluessel, liste);
    else this.eintraege.delete(schluessel);
    return liste;
  }

  erlaubt(schluessel, jetzt = Date.now()) {
    return this._aktuell(schluessel, jetzt).length < this.max;
  }

  zaehle(schluessel, jetzt = Date.now()) {
    const liste = this._aktuell(schluessel, jetzt);
    liste.push(jetzt);
    this.eintraege.set(schluessel, liste);
    // Speicher klein halten: alte Schlüssel gelegentlich aufräumen
    if (this.eintraege.size > 5000) {
      for (const k of [...this.eintraege.keys()]) this._aktuell(k, jetzt);
    }
  }
}
