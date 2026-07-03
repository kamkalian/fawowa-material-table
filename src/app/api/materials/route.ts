import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, materialsToCSV } from '@/lib/csv-utils';
import { Material, RequestEntry } from '@/types';
import fs from 'fs';
import path from 'path';

const CSV_PATH = path.join(process.cwd(), 'public', 'materials.csv');
const REQUESTS_PATH = path.join(process.cwd(), 'data', 'requests.json');
const KEY_PATH = path.join(process.cwd(), 'data', 'editor-key.txt');

function getStoredKey(): string {
  if (!fs.existsSync(KEY_PATH)) return '';
  return fs.readFileSync(KEY_PATH, 'utf-8').trim();
}

function readRequests(): RequestEntry[] {
  if (!fs.existsSync(REQUESTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(REQUESTS_PATH, 'utf-8'));
}

function writeRequests(requests: RequestEntry[]) {
  fs.writeFileSync(REQUESTS_PATH, JSON.stringify(requests, null, 2));
}

function addMaterialToCSV(material: Material): void {
  if (!fs.existsSync(CSV_PATH)) {
    const csv = materialsToCSV([material]);
    fs.writeFileSync(CSV_PATH, csv);
    return;
  }
  const existingContent = fs.readFileSync(CSV_PATH, 'utf-8').trim();
  const existingMaterials = parseCSV(existingContent);
  existingMaterials.push(material);
  const newCsv = materialsToCSV(existingMaterials);
  fs.writeFileSync(CSV_PATH, newCsv);
}

export async function GET() {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 });
    }
    
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const materials = parseCSV(csvContent);
    
    // Only return active materials to public
    const activeMaterials = materials.filter(m => m.status !== 'rejected');
    
    return NextResponse.json(activeMaterials);
  } catch (error) {
    console.error('Error reading CSV:', error);
    return NextResponse.json({ error: 'Failed to read CSV file' }, { status: 500 });
  }
}

// POST: Save materials (admin only) or approve a request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('x-admin-key');
    const storedKey = getStoredKey();

    // If this is an approve-request action
    if (body.approveRequestId) {
      if (!authHeader || authHeader !== storedKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const requests = readRequests();
      const reqIdx = requests.findIndex((r: RequestEntry) => r.id === body.approveRequestId);
      if (reqIdx === -1) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      const reqEntry = requests[reqIdx];
      const material: Material = { ...reqEntry.material, status: 'active' };

      if (reqEntry.action === 'new') {
        // Add new material to CSV
        addMaterialToCSV(material);
      } else if (reqEntry.action === 'change') {
        // Update existing material in CSV
        if (!fs.existsSync(CSV_PATH)) {
          return NextResponse.json({ error: 'CSV file not found' }, { status: 404 });
        }
        const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
        const materials = parseCSV(csvContent);
        const matIdx = materials.findIndex(
          m => m.Materialname === reqEntry.originalMaterialName
        );
        if (matIdx !== -1) {
          materials[matIdx] = { ...material, status: 'active' };
        } else {
          materials.push({ ...material, status: 'active' });
        }
        const newCsv = materialsToCSV(materials);
        fs.writeFileSync(CSV_PATH, newCsv);
      }

      // Mark request as active
      requests[reqIdx].status = 'active';
      writeRequests(requests);

      return NextResponse.json({ message: 'Request approved and material saved' });
    }

    // Regular save (admin only)
    if (!authHeader || authHeader !== storedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const materials: Material[] = body;
    const csvContent = materialsToCSV(materials);
    fs.writeFileSync(CSV_PATH, csvContent);
    
    return NextResponse.json({ message: 'Materials saved successfully', count: materials.length });
  } catch (error) {
    console.error('Error saving materials:', error);
    return NextResponse.json({ error: 'Failed to save materials' }, { status: 500 });
  }
}