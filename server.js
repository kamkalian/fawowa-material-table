import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;
const CSV_PATH = join(__dirname, 'public', 'materials.csv');
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

// --- CSV Parser ---

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

    const eigenschaften = [];
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

      eigenschaften.push({
        name: pname.replace(/\s*\(.*?\)$/, ''),
        wert: val,
        einheit
      });
    }

    const links = [];
    const linkCol = cols[cols.length - 1] || '';
    if (linkCol.trim()) {
      linkCol.split('|').forEach(pair => {
        const [text, url] = pair.split(':');
        if (text && url) links.push({ text: text.trim(), url: url.trim() });
      });
    }

    materials.push({
      Materialname: name,
      Hersteller: (cols[1] || '').trim(),
      Eigenschaften: eigenschaften,
      Link: links
    });
  }
  return materials;
}

function materialsToCSV(materials) {
  if (!materials.length) return 'Materialname;Hersteller;Links\n';

  const allProps = new Set();
  materials.forEach(m => m.Eigenschaften.forEach(p => allProps.add(p.name)));
  const sortedProps = [...allProps].sort();

  const header = ['Materialname', 'Hersteller', ...sortedProps, 'Links'].join(';') + '\n';

  const rows = materials.map(m => {
    const row = [m.Materialname, m.Hersteller];
    sortedProps.forEach(pn => {
      const p = m.Eigenschaften.find(e => e.name === pn);
      row.push(p ? p.wert.replace('.', ',') : '');
    });
    row.push(m.Link.map(l => `${l.text}:${l.url}`).join('|'));
    return row.join(';');
  });

  return header + rows.join('\n');
}

// --- API Routes ---

// GET /api/materials — public
app.get('/api/materials', (req, res) => {
  try {
    if (!existsSync(CSV_PATH)) return res.json([]);
    const csv = readFileSync(CSV_PATH, 'utf-8');
    res.json(parseCSV(csv));
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
      const material = { ...reqEntry.material, status: 'active' };

      if (reqEntry.action === 'new') {
        // Append to CSV
        let materials = [];
        if (existsSync(CSV_PATH)) {
          materials = parseCSV(readFileSync(CSV_PATH, 'utf-8'));
        }
        materials.push(material);
        writeFileSync(CSV_PATH, materialsToCSV(materials));
      } else {
        // Update existing
        if (!existsSync(CSV_PATH)) return res.status(404).json({ error: 'CSV not found' });
        const materials = parseCSV(readFileSync(CSV_PATH, 'utf-8'));
        const mi = materials.findIndex(m => m.Materialname === reqEntry.originalMaterialName);
        if (mi !== -1) materials[mi] = material;
        else materials.push(material);
        writeFileSync(CSV_PATH, materialsToCSV(materials));
      }

      requests[ri].status = 'active';
      writeRequests(requests);
      return res.json({ message: 'Request approved' });
    }

    // Save all materials
    writeFileSync(CSV_PATH, materialsToCSV(body));
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
    if (!action || !material || !material.Materialname) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      status: 'check',
      action,
      material,
      originalMaterialName: action === 'change' ? material.Materialname : undefined,
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
