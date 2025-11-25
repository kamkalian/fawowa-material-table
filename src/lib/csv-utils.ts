import { Material, MaterialProperty, MaterialLink } from '@/types';

export function parseCSV(csvText: string): Material[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  const materials: Material[] = [];
  
  // Header-Zeile auslesen
  const header = lines[0].split(';');
  const fixedColumns = ['Materialname', 'Hersteller', 'Links'];
  
  // Dynamische Eigenschaften-Spalten ermitteln
  const propertyColumns = header.filter(col => 
    col.trim() && !fixedColumns.includes(col.trim())
  );
  
  // Materialien parsen
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(';');
    const materialname = columns[0];
    
    if (!materialname || !materialname.trim()) continue;
    
    const eigenschaften: MaterialProperty[] = [];
    const hersteller = columns[1] ? columns[1].trim() : '';
    const linksColumn = columns[columns.length - 1]; // Links ist immer die letzte Spalte
    
    // Alle Eigenschaften-Spalten durchgehen
    for (let j = 0; j < propertyColumns.length; j++) {
      const columnIndex = j + 2; // Nach Materialname und Hersteller
      const propertyName = propertyColumns[j].trim();
      const propertyValue = columns[columnIndex];
      
      if (propertyValue && propertyValue.trim()) {
        let einheit = '';
        
        // Einheit aus Spaltenname extrahieren (falls vorhanden)
        const unitMatch = propertyName.match(/\((.*?)\)$/);
        if (unitMatch) {
          einheit = unitMatch[1];
        } else {
          // Standard-Einheiten zuweisen
          if (propertyName.toLowerCase().includes('stärke') || propertyName.toLowerCase().includes('dicke')) {
            einheit = 'mm';
          } else if (propertyName.toLowerCase().includes('gewicht')) {
            einheit = 'kg/m²';
          } else if (propertyName.toLowerCase().includes('temperatur')) {
            einheit = '°C';
          } else if (propertyName.toLowerCase().includes('druck')) {
            einheit = 'bar';
          }
        }
        
        eigenschaften.push({
          name: propertyName.replace(/\s*\(.*?\)$/, ''), // Name ohne Einheit
          wert: propertyValue.replace(',', '.').trim(),
          einheit: einheit
        });
      }
    }
    
    // Links parsen (Format: "Text:URL|Text2:URL2")
    const materialLinks: MaterialLink[] = [];
    if (linksColumn && linksColumn.trim()) {
      const linkPairs = linksColumn.split('|');
      for (const pair of linkPairs) {
        const [text, url] = pair.split(':');
        if (text && url) {
          materialLinks.push({ text: text.trim(), url: url.trim() });
        }
      }
    }
    
    materials.push({
      Materialname: materialname.trim(),
      Hersteller: hersteller,
      Eigenschaften: eigenschaften,
      Link: materialLinks
    });
  }
  
  return materials;
}

export function materialsToCSV(materials: Material[]): string {
  if (materials.length === 0) {
    return 'Materialname;Hersteller;Links\n';
  }
  
  // Alle verfügbaren Eigenschaften sammeln
  const allProperties = new Set<string>();
  materials.forEach(material => {
    material.Eigenschaften.forEach(prop => {
      allProperties.add(prop.name);
    });
  });
  
  const sortedProperties = Array.from(allProperties).sort();
  
  // Header erstellen
  const header = ['Materialname', 'Hersteller', ...sortedProperties, 'Links'].join(';') + '\n';
  
  // Datenzeilen erstellen
  const rows = materials.map(material => {
    const row = [];
    
    // Materialname und Hersteller
    row.push(material.Materialname);
    row.push(material.Hersteller);
    
    // Alle Eigenschaften in der richtigen Reihenfolge
    sortedProperties.forEach(propName => {
      const prop = material.Eigenschaften.find(p => p.name === propName);
      if (prop) {
        // Dezimaltrennzeichen für deutsche CSV
        row.push(prop.wert.replace('.', ','));
      } else {
        row.push(''); // Leere Zelle wenn Eigenschaft nicht vorhanden
      }
    });
    
    // Links
    const links = material.Link.map(l => `${l.text}:${l.url}`).join('|');
    row.push(links);
    
    return row.join(';');
  });
  
  return header + rows.join('\n');
}