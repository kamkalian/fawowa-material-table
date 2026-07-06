import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const JSON_PATH = join(__dirname, 'data', 'materials.json');
const CSV_PATH = join(__dirname, 'public', 'materials.csv'); // legacy, for import/export only
const REQUESTS_PATH = join(__dirname, 'data', 'requests.json');
const KEY_PATH = join(__dirname, 'data', 'editor-key.txt');

app.use(express.json());

// CORS for Vite dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// In production, serve static files from dist/
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(join(__dirname, 'dist')));
}

// --- Helpers ---

function getKey() {
  if (!existsSync(KEY_PATH)) return '';
  return readFileSync(KEY_PATH, 'utf-8').trim();
}

function readRequests() {
  if (!existsSync(REQUESTS_PATH)) return [];
  return JSON.parse(readFileSync(REQUESTS_PATH, 'utf-8'));
}

function writeRequests(requests) {
  writeFileSync(REQUESTS_PATH, JSON.stringify(requests, null, 2));
}

// --- JSON read/write ---

function readMaterials() {
  if (!existsSync(JSON_PATH)) return [];
  return JSON.parse(readFileSync(JSON_PATH, 'utf-8')).materialien || [];
}

function writeMaterials(materialien) {
  writeFileSync(JSON_PATH, JSON.stringify({ materialien }, null, 2));
}

// --- CSV helpers (for import/export compatibility) ---

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].split(';');
  const fixedCols = ['Materialname', 'Hersteller', 'Links'];
  const propCols = header.filter(c => c.trim() && !fixedCols.includes(c.trim()));

  const materials = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const name = (cols[0] || '').trim();
    if (!name) continue;

    const eigenschaften = {};
    for (let j = 0; j < propCols.length; j++) {
      const ci = j + 2;
      const val = (cols[ci] || '').replace(',', '.').trim();
      if (!val) continue;

      let einheit = '';
      const pname = propCols[j].trim();
      const m = pname.match(/\((.*?)\)$/);
      if (m) einheit = m[1];
      else if (/stärke|dicke/i.test(pname)) einheit = 'mm';
      else if (/gewicht/i.test(pname)) einheit = 'kg/m²';
      else if (/temperatur/i.test(pname)) einheit = '°C';

      const cleanName = pname.replace(/\s*\(.*?\)$/, '');
      eigenschaften[cleanName] = { wert: isNaN(parseFloat(val)) ? val : parseFloat(val), einheit };
    }

    const links = [];
    const linkCol = cols[cols.length - 1] || '';
    if (linkCol.trim()) {
      linkCol.split('|').forEach(pair => {
        const [text, url] = pair.split(':');
        if (text && url) links.push({ text: text.trim(), url: url.trim() });
      });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');

    materials.push({ id, name, hersteller: (cols[1] || '').trim(), eigenschaften, links });
  }
  return materials;
}

function materialsToCSV(materialien) {
  if (!materialien.length) return 'Materialname;Hersteller;Links\n';

  const allProps = new Set();
  materialien.forEach(m => Object.keys(m.eigenschaften).forEach(k => allProps.add(k)));
  const sortedProps = [...allProps].sort();

  const header = ['Materialname', 'Hersteller', ...sortedProps, 'Links'].join(';') + '\n';

  const rows = materialien.map(m => {
    const row = [m.name, m.hersteller];
    sortedProps.forEach(pn => {
      const p = m.eigenschaften[pn];
      row.push(p ? String(p.wert).replace('.', ',') : '');
    });
    row.push(m.links.map(l => `${l.text}:${l.url}`).join('|'));
    return row.join(';');
  });

  return header + rows.join('\n');
}

// --- API Routes ---

// GET /api/materials — public
app.get('/api/materials', (req, res) => {
  try {
    res.json(readMaterials());
  } catch (e) {
    res.status(500).json({ error: 'Failed to read materials' });
  }
});

// POST /api/materials — admin only (save all or approve request)
app.post('/api/materials', (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== getKey()) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const body = req.body;

    // Approve request flow
    if (body.approveRequestId) {
      const requests = readRequests();
      const ri = requests.findIndex(r => r.id === body.approveRequestId);
      if (ri === -1) return res.status(404).json({ error: 'Request not found' });

      const reqEntry = requests[ri];
      // Normalize material to new format (support both old and new request formats)
      let material = reqEntry.material;
      if (material.Materialname && !material.name) {
        material = {
          id: material.Materialname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, ''),
          name: material.Materialname,
          hersteller: material.Hersteller || '',
          eigenschaften: Array.isArray(material.Eigenschaften)
            ? material.Eigenschaften.reduce((acc, p) => { acc[p.name] = { wert: p.wert, einheit: p.einheit || '' }; return acc; }, {})
            : (material.eigenschaften || {}),
          links: material.Link || material.links || []
        };
      }

      const materialien = readMaterials();
      if (reqEntry.action === 'new') {
        materialien.push(material);
      } else {
        const mi = materialien.findIndex(m => m.name === reqEntry.originalMaterialName);
        if (mi !== -1) materialien[mi] = material;
        else materialien.push(material);
      }
      writeMaterials(materialien);

      requests[ri].status = 'active';
      writeRequests(requests);
      return res.json({ message: 'Request approved' });
    }

    // Save all materials
    writeMaterials(body);
    res.json({ message: 'Saved', count: body.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save' });
  }
});

// GET /api/requests — admin only
app.get('/api/requests', (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== getKey()) return res.status(401).json({ error: 'Unauthorized' });
  res.json(readRequests());
});

// POST /api/requests — public (submit new request)
app.post('/api/requests', (req, res) => {
  try {
    const { action, material, note } = req.body;
    const matName = material?.name || material?.Materialname;
    if (!action || !material || !matName) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Normalize material to new format
    const normalizedMaterial = material.name ? material : {
      id: material.Materialname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, ''),
      name: material.Materialname,
      hersteller: material.Hersteller || '',
      eigenschaften: Array.isArray(material.Eigenschaften)
        ? material.Eigenschaften.reduce((acc, p) => { acc[p.name] = { wert: p.wert, einheit: p.einheit || '' }; return acc; }, {})
        : (material.eigenschaften || {}),
      links: material.Link || material.links || []
    };

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      status: 'check',
      action,
      material: normalizedMaterial,
      originalMaterialName: action === 'change' ? normalizedMaterial.name : undefined,
      note: note || undefined
    };

    const requests = readRequests();
    requests.push(entry);
    writeRequests(requests);

    res.json({ success: true, request: entry });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// PATCH /api/requests — admin only (approve/reject)
app.patch('/api/requests', (req, res) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== getKey()) return res.status(401).json({ error: 'Unauthorized' });

  const { id, status } = req.body;
  if (!id || !['active', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid' });
  }

  const requests = readRequests();
  const ri = requests.findIndex(r => r.id === id);
  if (ri === -1) return res.status(404).json({ error: 'Not found' });

  requests[ri].status = status;
  writeRequests(requests);
  res.json({ success: true });
});

// POST /api/editor/auth — validate key
app.post('/api/editor/auth', (req, res) => {
  const { key } = req.body;
  if (!key || key !== getKey()) return res.status(401).json({ valid: false });
  res.json({ valid: true });
});

// GET /api/links/status — check all URLs from materials (cached 1h)
const linkStatusCache = new Map(); // url → { status, code, checkedAt }

app.get('/api/links/status', async (req, res) => {
  try {
    const materialien = readMaterials();
    const urls = [...new Set(materialien.flatMap(m => m.links.map(l => l.url)))];

    // Return cached results if fresh (< 1 hour)
    const now = Date.now();
    const cacheTTL = 3600000; // 1 hour
    const uncached = urls.filter(u => {
      const c = linkStatusCache.get(u);
      return !c || (now - c.checkedAt > cacheTTL);
    });

    // Check uncached URLs in parallel
    if (uncached.length > 0) {
      const results = await Promise.allSettled(
        uncached.map(async (url) => {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          try {
            // Try HEAD first; fall back to GET if blocked (403/405)
            const fetchOpts = {
              method: 'HEAD',
              signal: ctrl.signal,
              redirect: 'follow',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaterialDB/1.0; +https://github.com)' }
            };
            let resp = await fetch(url, fetchOpts);
            let usedGet = false;
            if (resp.status === 403 || resp.status === 405) {
              fetchOpts.method = 'GET';
              resp = await fetch(url, fetchOpts);
              usedGet = true;
            }
            clearTimeout(t);

            // For GET fallback, verify response has meaningful content
            let contentOK = true;
            if (usedGet && resp.ok) {
              try {
                const text = await resp.text();
                contentOK = text.length > 200; // short pages are likely error pages
              } catch { contentOK = true; }
            }

            const status = !resp.ok
              ? (resp.status === 403 ? 'blocked' : (resp.status >= 300 && resp.status < 400 ? 'redirect' : 'error'))
              : !contentOK ? 'error'
              : 'ok';
            return { url, status, code: resp.status };
          } catch (e) {
            clearTimeout(t);
            return { url, status: e.name === 'AbortError' ? 'timeout' : 'error', code: 0 };
          }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          linkStatusCache.set(r.value.url, { ...r.value, checkedAt: now });
        }
      }
    }

    // Build response
    const result = {};
    for (const url of urls) {
      const c = linkStatusCache.get(url);
      result[url] = c ? { status: c.status, code: c.code } : { status: 'unknown', code: 0 };
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to check links' });
  }
});

// --- Donations ---
const DONATIONS_PATH = join(__dirname, 'data', 'donations.json');
const DONATIONS_CACHE_PATH = join(__dirname, 'data', 'donations-cache.json');
let donationsCache = { total: 0, count: 0, checkedAt: 0 };

function readDonationsConfig() {
  if (!existsSync(DONATIONS_PATH)) return { kofiUser: '', goal: 120, goalLabel: 'Server-Kosten', overflowLabel: 'zukünftige Projekte', buttonText: '☕ Spenden', buttonUrl: '#' };
  return JSON.parse(readFileSync(DONATIONS_PATH, 'utf-8'));
}

function readDonationsCache() {
  if (!existsSync(DONATIONS_CACHE_PATH)) return { total: 0, count: 0 };
  return JSON.parse(readFileSync(DONATIONS_CACHE_PATH, 'utf-8'));
}

function writeDonationsCache(data) {
  writeFileSync(DONATIONS_CACHE_PATH, JSON.stringify(data, null, 2));
}

// Webhook: called by Ko-fi when a donation is received
app.post('/api/donations/webhook', express.urlencoded({ extended: true }), (req, res) => {
  try {
    const verif = req.body?.verification_token;
    // Accept Ko-fi webhooks (no strict verification needed for public counter)
    const amount = parseFloat(req.body?.amount) || 0;
    if (amount > 0) {
      const cache = readDonationsCache();
      cache.total = Math.round((cache.total + amount) * 100) / 100;
      cache.count += 1;
      writeDonationsCache(cache);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/donations', async (req, res) => {
  try {
    const config = readDonationsConfig();
    const now = Date.now();
    const cacheTTL = 900000; // 15 min

    // Test mode: _test_total bypasses all cache
    if (config._test_total !== undefined) {
      return res.json({
        total: config._test_total,
        count: 12,
        goal: config.goal,
        goalLabel: config.goalLabel,
        overflowLabel: config.overflowLabel,
        buttonText: config.buttonText,
        buttonUrl: config.buttonUrl
      });
    }

    // Read from webhook cache (populated by Ko-fi webhook)
    const cache = readDonationsCache();

    res.json({
      total: cache.total,
      count: cache.count,
      goal: config.goal,
      goalLabel: config.goalLabel,
      overflowLabel: config.overflowLabel,
      buttonText: config.buttonText,
      buttonUrl: config.buttonUrl
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  } else {
    res.json({ message: 'Use Vite dev server at http://localhost:5173' });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
