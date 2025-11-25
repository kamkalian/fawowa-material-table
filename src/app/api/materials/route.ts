import { NextRequest, NextResponse } from 'next/server';
import { parseCSV, materialsToCSV } from '@/lib/csv-utils';
import fs from 'fs';
import path from 'path';

const CSV_PATH = path.join(process.cwd(), 'public', 'materials.csv');

export async function GET() {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      return NextResponse.json({ error: 'CSV file not found' }, { status: 404 });
    }
    
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const materials = parseCSV(csvContent);
    
    return NextResponse.json(materials);
  } catch (error) {
    console.error('Error reading CSV:', error);
    return NextResponse.json({ error: 'Failed to read CSV file' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const materials = await request.json();
    const csvContent = materialsToCSV(materials);
    
    fs.writeFileSync(CSV_PATH, csvContent);
    
    return NextResponse.json({ message: 'Materials saved successfully', count: materials.length });
  } catch (error) {
    console.error('Error saving materials:', error);
    return NextResponse.json({ error: 'Failed to save materials' }, { status: 500 });
  }
}