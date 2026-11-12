// Öffentliche Routen für Meldungen (ohne Konto, mit Spam-Schutz).
//   GET  /api/v2/formular-token   liefert einen Token mit Zeitstempel für das geöffnete Formular
//   POST /api/v2/meldungen        legt eine Meldung an

import { FehlerEingabe } from './admin.js';
import { legeMeldungAn } from './meldungen.js';
import { Begrenzung, erzeugeToken, pruefeToken, MIN_MS } from './spam.js';

const TOKEN_FEHLER = {
  zu_schnell: 'Das ging etwas zu schnell. Bitte kurz warten und erneut absenden.',
  abgelaufen: 'Das Formular war zu lange offen. Bitte neu öffnen.',
  ungueltig: 'Das Formular ist ungültig oder abgelaufen. Bitte neu öffnen.'
};

export function registerMeldungRoutes(app, speicher, { minMs = MIN_MS, begrenzung = new Begrenzung() } = {}) {
  app.get('/api/v2/formular-token', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ token: erzeugeToken() });
  });

  app.post('/api/v2/meldungen', (req, res) => {
    const daten = req.body && typeof req.body === 'object' ? req.body : {};

    // Verstecktes Feld: Menschen sehen es nicht, Bots füllen es aus. Wir tun so, als wäre alles gut.
    if (typeof daten.website === 'string' && daten.website.trim() !== '') {
      return res.status(201).json({ ok: true });
    }

    const token = pruefeToken(daten.token, { minMs });
    if (!token.ok) return res.status(400).json({ error: TOKEN_FEHLER[token.grund], grund: token.grund });

    if (!begrenzung.erlaubt(req.ip)) {
      return res.status(429).json({ error: 'Es wurden schon viele Meldungen gesendet. Bitte in einer Stunde erneut versuchen.' });
    }

    try {
      legeMeldungAn(speicher, daten);
      begrenzung.zaehle(req.ip);
      res.status(201).json({ ok: true });
    } catch (e) {
      if (e instanceof FehlerEingabe) return res.status(e.status).json({ error: e.message });
      console.error(e);
      res.status(500).json({ error: 'Interner Fehler' });
    }
  });
}
