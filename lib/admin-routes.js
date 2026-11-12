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
import { getMaterial } from './daten.js';
import { ladeAusRepo, repoStatus, sendeAnRepo } from './synchronisation.js';
import { zaehleOffene, listeMeldungen, uebernehmeFehler, schliesseAb, lehneAb } from './meldungen.js';
import { ICON_NAMEN } from './icons.js';
import { pruefeAlleLinks, listeLinks, zaehleKaputte, pruefungLaeuft } from './linkpruefung.js';

function fehlerAntwort(res, e) {
  if (e instanceof FehlerEingabe) return res.status(e.status).json({ error: e.message, ...(e.details ? { details: e.details } : {}) });
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

export function registerAdminRoutes(app, speicher) {
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
  api.get('/materialien', h(() => getAlleMaterialien(speicher)));
  api.post('/materialien', h((req, res) => {
    const id = anlegenMaterial(speicher, req.body ?? {});
    res.status(201);
    return { id, material: getMaterial(speicher, id, { alle: true }) };
  }));
  api.patch('/materialien/:id', h((req) => {
    const id = zahlParam(req.params.id);
    aendereMaterial(speicher, id, req.body ?? {});
    return getMaterial(speicher, id, { alle: true });
  }));
  api.delete('/materialien/:id', h((req, res) => {
    loescheMaterial(speicher, zahlParam(req.params.id));
    res.status(204).end();
  }));
  api.post('/materialien/:id/duplizieren', h((req, res) => {
    const id = duplizierMaterial(speicher, zahlParam(req.params.id));
    res.status(201);
    return { id, material: getMaterial(speicher, id, { alle: true }) };
  }));
  api.put('/materialien/:id/werte/:kw', h((req) => {
    const id = zahlParam(req.params.id);
    setzeWert(speicher, id, req.params.kw, req.body ?? {});
    return getMaterial(speicher, id, { alle: true });
  }));
  // Übersicht der Links mit Prüfergebnis, Zähler für die Navigation
  api.get('/links', h(() => ({ links: listeLinks(speicher), laeuft: pruefungLaeuft() })));
  api.get('/links/zaehler', h(() => ({ kaputt: zaehleKaputte(speicher) })));
  // Alle Links prüfen (dauert je nach Anzahl einige Sekunden bis Minuten)
  api.post('/links/pruefen', async (req, res) => {
    try {
      const ergebnis = await pruefeAlleLinks(speicher);
      if (!ergebnis) return res.status(409).json({ error: 'Es läuft bereits eine Prüfung.' });
      res.json(ergebnis);
    } catch (e) { fehlerAntwort(res, e); }
  });

  api.put('/materialien/:id/links', h((req) => {
    const id = zahlParam(req.params.id);
    setzeLinks(speicher, id, req.body?.links);
    return getMaterial(speicher, id, { alle: true });
  }));

  // Eigenschaften und Kategorien
  api.get('/kategorien', h(() => getKategorien(speicher)));
  api.post('/kategorien', h((req, res) => {
    const id = anlegenKategorie(speicher, req.body ?? {});
    res.status(201);
    return { id, kategorien: getKategorien(speicher) };
  }));
  api.put('/kategorien/reihenfolge', h((req) => {
    setzeKategorieReihenfolge(speicher, req.body?.ids);
    return getKategorien(speicher);
  }));
  api.patch('/kategorien/:id', h((req) => {
    aendereKategorie(speicher, zahlParam(req.params.id), req.body ?? {});
    return getKategorien(speicher);
  }));
  api.delete('/kategorien/:id', h((req, res) => {
    loescheKategorie(speicher, zahlParam(req.params.id));
    res.status(204).end();
  }));
  api.get('/icons', h(() => ICON_NAMEN));
  api.get('/eigenschaften', h(() => getAlleEigenschaften(speicher)));
  api.post('/eigenschaften', h((req, res) => {
    const id = anlegenEigenschaft(speicher, req.body ?? {});
    res.status(201);
    return { id };
  }));
  api.put('/eigenschaften/reihenfolge', h((req) => {
    setzeEigenschaftReihenfolge(speicher, req.body?.kurzworte);
    return getAlleEigenschaften(speicher);
  }));
  api.patch('/eigenschaften/:id', h((req) => {
    aendereEigenschaft(speicher, zahlParam(req.params.id), req.body ?? {});
    return getAlleEigenschaften(speicher);
  }));
  api.put('/eigenschaften/:id/optionen', h((req) => {
    setzeOptionen(speicher, zahlParam(req.params.id), req.body?.optionen);
    return getAlleEigenschaften(speicher);
  }));
  api.delete('/eigenschaften/:id', h((req, res) => {
    loescheEigenschaft(speicher, zahlParam(req.params.id), req.query.bestaetigt);
    res.status(204).end();
  }));
  api.post('/eigenschaften/:id/zusammenfuehren', h((req) => {
    fuehreZusammen(speicher, zahlParam(req.params.id), zahlParam(req.body?.ziel));
    return getAlleEigenschaften(speicher);
  }));

  // Meldungen von Besuchern
  api.get('/meldungen/zaehler', h(() => ({ offen: zaehleOffene(speicher) })));
  api.get('/meldungen', h((req) => listeMeldungen(speicher, { archiv: req.query.archiv === '1' })));
  api.post('/meldungen/:id/uebernehmen', h((req) => {
    uebernehmeFehler(speicher, zahlParam(req.params.id), req.body ?? {});
    return { offen: zaehleOffene(speicher) };
  }));
  api.post('/meldungen/:id/erledigt', h((req) => {
    schliesseAb(speicher, zahlParam(req.params.id), req.body?.material_id ?? null);
    return { offen: zaehleOffene(speicher) };
  }));
  api.post('/meldungen/:id/ablehnen', h((req) => {
    lehneAb(speicher, zahlParam(req.params.id), req.body?.notiz ?? null);
    return { offen: zaehleOffene(speicher) };
  }));

  // Protokoll (Verlauf der Commits) und Abgleich mit dem Repository
  api.get('/protokoll', h((req) => listProtokoll(speicher, req.query.limit)));
  api.get('/repo', h(() => repoStatus(speicher)));
  api.post('/repo/laden', async (req, res) => {
    try { res.json(await ladeAusRepo(speicher)); } catch (e) { fehlerAntwort(res, e); }
  });
  api.post('/repo/senden', async (req, res) => {
    try { res.json(await sendeAnRepo(speicher)); } catch (e) { fehlerAntwort(res, e); }
  });

  app.use('/api/admin', express.json({ limit: '200kb' }), api);
}
