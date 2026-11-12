import express from 'express';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDb, listKategorien, listEigenschaften, listMaterialien, getMaterial } from './lib/db.js';
import { registerAdminRoutes } from './lib/admin-routes.js';
import { registerMeldungRoutes } from './lib/meldungen-routes.js';
import { adminPfad } from './lib/pfade.js';
import { pruefeAlleLinks } from './lib/linkpruefung.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Umgebungsvariablen aus .env laden (z. B. ADMIN_PASSWORD_HASH). Bestehende Variablen bleiben unverändert.
const ENV_PATH = join(__dirname, '.env');
if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);

const app = express();
const PORT = process.env.PORT || 3456;
const PRODUCTION = process.env.NODE_ENV === 'production';
const ADMIN_PFAD = adminPfad();

// Hinter Caddy: die Adresse des Besuchers kommt aus X-Forwarded-For (nur die erste Station wird vertraut).
// Der Container veröffentlicht keinen Port, erreichbar ist er nur über Caddy.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

// Gebaute Oberfläche (nur im Betrieb; in der Entwicklung liefert Vite sie aus)
if (PRODUCTION) {
  // Der Admin-Bereich liegt unter eigenem Pfad (ADMIN_PFAD); die Adresse /admin gibt es nicht
  app.use((req, res, next) => {
    if (['/admin', '/admin/', '/admin.html'].includes(req.path)) return res.status(404).type('text/plain').send('Not found');
    next();
  });
  app.use(express.static(join(__dirname, 'dist')));
}

const db = openDb();

// --- Öffentliche API (nur lesend, veröffentlichte Daten) ---

app.get('/api/v2/kategorien', (req, res) => {
  try { res.json(listKategorien(db)); }
  catch (e) { res.status(500).json({ error: 'Failed to read categories' }); }
});

app.get('/api/v2/eigenschaften', (req, res) => {
  try { res.json(listEigenschaften(db)); }
  catch (e) { res.status(500).json({ error: 'Failed to read properties' }); }
});

app.get('/api/v2/materialien', (req, res) => {
  try { res.json(listMaterialien(db)); }
  catch (e) { res.status(500).json({ error: 'Failed to read materials' }); }
});

app.get('/api/v2/materialien/:id', (req, res) => {
  try {
    const m = getMaterial(db, req.params.id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    res.json(m);
  } catch (e) { res.status(500).json({ error: 'Failed to read material' }); }
});

// Einstellungen, die die Oberfläche braucht (Adresse des Admin-Bereichs für den dezenten Link)
app.get('/api/v2/einstellungen', (req, res) => {
  res.json({ adminPfad: ADMIN_PFAD });
});

// Fehlermeldungen und Vorschläge von Besuchern (ohne Konto, mit Spam-Schutz)
registerMeldungRoutes(app, db);

// --- Admin-Bereich: Login und Bearbeiten ---
registerAdminRoutes(app, db);

// Admin-Oberfläche: im Betrieb unter ADMIN_PFAD, in der Entwicklung liefert Vite sie unter demselben Pfad aus
app.get(ADMIN_PFAD, (req, res, next) => {
  if (!PRODUCTION) return next();
  res.sendFile(join(__dirname, 'dist', 'admin.html'));
});

// Unbekannte Adressen unter /api sind ein Fehler, keine Seite
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Startseite für alle übrigen Adressen
app.get('*', (req, res) => {
  if (PRODUCTION) {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  } else {
    res.json({ message: 'Use Vite dev server at http://localhost:5173' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT} (Admin-Bereich: ${ADMIN_PFAD})`);
});

// Im Betrieb prüft der Server die Links täglich (erste Prüfung kurz nach dem Start)
if (PRODUCTION) {
  const pruefen = () => pruefeAlleLinks(db).catch(e => console.error('Link-Prüfung fehlgeschlagen:', e.message));
  setTimeout(pruefen, 60 * 1000).unref();
  setInterval(pruefen, 24 * 60 * 60 * 1000).unref();
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} ist schon belegt. Läuft noch eine ältere Instanz dieser Anwendung? Bitte beenden und neu starten.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
