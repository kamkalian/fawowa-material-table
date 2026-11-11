// HTTP-Routen für den Admin-Bereich unter /api/admin. Alles außer Anmeldung braucht eine Sitzung.

import express from 'express';
import {
  anmelden, sitzungGueltig, abmelden, tokenAusCookie, cookieHeader
} from './auth.js';
import {
  FehlerEingabe, getAlleMaterialien, anlegenMaterial, aendereMaterial, loescheMaterial,
  duplizierMaterial, setzeWert, setzeLinks, getAlleEigenschaften, anlegenEigenschaft,
  aendereEigenschaft, setzeEigenschaftReihenfolge, setzeOptionen, loescheEigenschaft,
  fuehreZusammen, listProtokoll, getKategorien, anlegenKategorie, aendereKategorie,
  loescheKategorie, setzeKategorieReihenfolge
} from './admin.js';
import { getMaterial } from './db.js';
import { zaehleOffene, listeMeldungen, uebernehmeFehler, schliesseAb, lehneAb } from './meldungen.js';
import { ICON_NAMEN } from './icons.js';

function fehlerAntwort(res, e) {
  if (e instanceof FehlerEingabe) return res.status(e.status).json({ error: e.message });
  if (e && typeof e.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ error: 'Die Daten passen nicht zu bestehenden Einträgen.' });
  }
  console.error(e);
  return res.status(500).json({ error: 'Interner Fehler' });
}

// Führt eine Aktion aus und gibt Fehler als Antwort zurück.
const h = (fn) => (req, res) => {
  try {
    const ergebnis = fn(req, res);
    if (ergebnis !== undefined && !res.headersSent) res.json(ergebnis);
  } catch (e) {
    fehlerAntwort(res, e);
  }
};

const zahlParam = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new FehlerEingabe('Ungültige ID', 400);
  return n;
};

export function registerAdminRoutes(app, db) {
  const secure = process.env.NODE_ENV === 'production';
  const api = express.Router();

  // Anmeldung
  api.post('/login', (req, res) => {
    const ergebnis = anmelden(req.body?.passwort);
    if (ergebnis.ok) {
      res.setHeader('Set-Cookie', cookieHeader(ergebnis.token, { secure }));
      return res.json({ ok: true });
    }
    if (ergebnis.grund === 'nicht_eingerichtet') {
      return res.status(503).json({ error: 'Der Admin-Zugang ist noch nicht eingerichtet (ADMIN_PASSWORD_HASH fehlt).' });
    }
    if (ergebnis.grund === 'gesperrt') {
      return res.status(429).json({ error: `Zu viele Fehlversuche. Bitte in ${ergebnis.minuten} Minuten erneut versuchen.` });
    }
    return res.status(401).json({ error: 'Passwort falsch.' });
  });

  api.post('/logout', (req, res) => {
    abmelden(tokenAusCookie(req.headers.cookie));
    res.setHeader('Set-Cookie', cookieHeader('', { ablauf: true, secure }));
    res.json({ ok: true });
  });

  api.get('/sitzung', (req, res) => {
    res.json({ angemeldet: sitzungGueltig(tokenAusCookie(req.headers.cookie)) });
  });

  // Ab hier: nur mit Sitzung
  api.use((req, res, next) => {
    if (!sitzungGueltig(tokenAusCookie(req.headers.cookie))) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }
    next();
  });

  // Materialien
  api.get('/materialien', h(() => getAlleMaterialien(db)));
  api.post('/materialien', h((req, res) => {
    const id = anlegenMaterial(db, req.body ?? {});
    res.status(201);
    return { id, material: getMaterial(db, id, { alle: true }) };
  }));
  api.patch('/materialien/:id', h((req) => {
    const id = zahlParam(req.params.id);
    aendereMaterial(db, id, req.body ?? {});
    return getMaterial(db, id, { alle: true });
  }));
  api.delete('/materialien/:id', h((req, res) => {
    loescheMaterial(db, zahlParam(req.params.id));
    res.status(204).end();
  }));
  api.post('/materialien/:id/duplizieren', h((req, res) => {
    const id = duplizierMaterial(db, zahlParam(req.params.id));
    res.status(201);
    return { id, material: getMaterial(db, id, { alle: true }) };
  }));
  api.put('/materialien/:id/werte/:kw', h((req) => {
    const id = zahlParam(req.params.id);
    setzeWert(db, id, req.params.kw, req.body ?? {});
    return getMaterial(db, id, { alle: true });
  }));
  api.put('/materialien/:id/links', h((req) => {
    const id = zahlParam(req.params.id);
    setzeLinks(db, id, req.body?.links);
    return getMaterial(db, id, { alle: true });
  }));

  // Eigenschaften und Kategorien
  api.get('/kategorien', h(() => getKategorien(db)));
  api.post('/kategorien', h((req, res) => {
    const id = anlegenKategorie(db, req.body ?? {});
    res.status(201);
    return { id, kategorien: getKategorien(db) };
  }));
  api.put('/kategorien/reihenfolge', h((req) => {
    setzeKategorieReihenfolge(db, req.body?.ids);
    return getKategorien(db);
  }));
  api.patch('/kategorien/:id', h((req) => {
    aendereKategorie(db, zahlParam(req.params.id), req.body ?? {});
    return getKategorien(db);
  }));
  api.delete('/kategorien/:id', h((req, res) => {
    loescheKategorie(db, zahlParam(req.params.id));
    res.status(204).end();
  }));
  api.get('/icons', h(() => ICON_NAMEN));
  api.get('/eigenschaften', h(() => getAlleEigenschaften(db)));
  api.post('/eigenschaften', h((req, res) => {
    const id = anlegenEigenschaft(db, req.body ?? {});
    res.status(201);
    return { id };
  }));
  api.put('/eigenschaften/reihenfolge', h((req) => {
    setzeEigenschaftReihenfolge(db, req.body?.kurzworte);
    return getAlleEigenschaften(db);
  }));
  api.patch('/eigenschaften/:id', h((req) => {
    aendereEigenschaft(db, zahlParam(req.params.id), req.body ?? {});
    return getAlleEigenschaften(db);
  }));
  api.put('/eigenschaften/:id/optionen', h((req) => {
    setzeOptionen(db, zahlParam(req.params.id), req.body?.optionen);
    return getAlleEigenschaften(db);
  }));
  api.delete('/eigenschaften/:id', h((req, res) => {
    loescheEigenschaft(db, zahlParam(req.params.id), req.query.bestaetigt);
    res.status(204).end();
  }));
  api.post('/eigenschaften/:id/zusammenfuehren', h((req) => {
    fuehreZusammen(db, zahlParam(req.params.id), zahlParam(req.body?.ziel));
    return getAlleEigenschaften(db);
  }));

  // Meldungen von Besuchern
  api.get('/meldungen/zaehler', h(() => ({ offen: zaehleOffene(db) })));
  api.get('/meldungen', h((req) => listeMeldungen(db, { archiv: req.query.archiv === '1' })));
  api.post('/meldungen/:id/uebernehmen', h((req) => {
    uebernehmeFehler(db, zahlParam(req.params.id), req.body ?? {});
    return { offen: zaehleOffene(db) };
  }));
  api.post('/meldungen/:id/erledigt', h((req) => {
    schliesseAb(db, zahlParam(req.params.id), req.body?.material_id ?? null);
    return { offen: zaehleOffene(db) };
  }));
  api.post('/meldungen/:id/ablehnen', h((req) => {
    lehneAb(db, zahlParam(req.params.id), req.body?.notiz ?? null);
    return { offen: zaehleOffene(db) };
  }));

  // Protokoll
  api.get('/protokoll', h((req) => listProtokoll(db, req.query.limit)));

  app.use('/api/admin', express.json({ limit: '200kb' }), api);
}
