import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '..', 'public', 'materials.csv');
const JSON_PATH = join(__dirname, '..', 'data', 'materials.json');

// --- CSV Parser (from server.js) ---
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
      eigenschaften[cleanName] = { wert: parseFloat(val) || val, einheit };
    }

    const links = [];
    const linkCol = cols[cols.length - 1] || '';
    if (linkCol.trim()) {
      linkCol.split('|').forEach(pair => {
        const [text, url] = pair.split(':');
        if (text && url) links.push({ text: text.trim(), url: url.trim() });
      });
    }

    // Generate stable ID from name (slug)
    const id = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    materials.push({
      id,
      name,
      hersteller: (cols[1] || '').trim(),
      eigenschaften,
      links
    });
  }
  return materials;
}

// --- Main ---
if (!existsSync(CSV_PATH)) {
  console.error('CSV not found at', CSV_PATH);
  process.exit(1);
}

const csv = readFileSync(CSV_PATH, 'utf-8');
const materialien = parseCSV(csv);

const data = { materialien };
writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));

console.log(`Migrated ${materialien.length} materials to ${JSON_PATH}`);
