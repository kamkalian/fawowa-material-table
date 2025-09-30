'use client';

import { useState, useEffect } from 'react';

// Exportiere den Typ, damit der Parent ihn optional verwenden kann
export type PropertyFilter = { name: string; operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'contains'; value: string };

interface FilterSectionProps {
  onFilterChange: (filters: { materialFilter: string; herstellerFilter: string; propertyFilters: PropertyFilter[] }) => void;
  onAddPropertyFilter: () => void;
  propertyNames: string[];
}

export default function FilterSection({ 
  onFilterChange, 
  onAddPropertyFilter,
  propertyNames 
}: FilterSectionProps) {
  const [materialFilter, setMaterialFilter] = useState<string>('');
  const [herstellerFilter, setHerstellerFilter] = useState<string>('');

  // Lokale Eigenschaftsfilter
  const [propertyFilters, setPropertyFilters] = useState<PropertyFilter[]>([]);

  const handleAddPropertyFilter = () => {
    onAddPropertyFilter();
    setPropertyFilters((prev) => [...prev, { name: '', operator: '=', value: '' }]);
  };

  const updatePropertyFilter = (index: number, patch: Partial<PropertyFilter>) => {
    setPropertyFilters((prev) => {
      const next = prev.slice();
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removePropertyFilter = (index: number) => {
    setPropertyFilters((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    onFilterChange({ materialFilter, herstellerFilter, propertyFilters });
  }, [materialFilter, herstellerFilter, propertyFilters, onFilterChange]);

  // Hilfsfunktion
  function matchesOperator(rowValue: unknown, operator: string, filterValue: string): boolean {
    const rv = rowValue;
    const fvNum = Number(filterValue);
    const rvNum = typeof rv === 'number' ? rv : (typeof rv === 'string' && !isNaN(Number(rv)) ? Number(rv) : NaN);

    switch (operator) {
      case '=': return String(rv) === filterValue;
      case '!=': return String(rv) !== filterValue;
      case '<': return !isNaN(rvNum) && !isNaN(fvNum) && rvNum < fvNum;
      case '<=': return !isNaN(rvNum) && !isNaN(fvNum) && rvNum <= fvNum;
      case '>': return !isNaN(rvNum) && !isNaN(fvNum) && rvNum > fvNum;
      case '>=': return !isNaN(rvNum) && !isNaN(fvNum) && rvNum >= fvNum;
      case 'contains': return String(rv ?? '').toLowerCase().includes(filterValue.toLowerCase());
      default: return true;
    }
  }

  return (
    <div className="filter-container bg-amber-200 p-2 m-0 rounded-md">
      <div className="filter-row flex items-center">
          <label htmlFor="materialFilter" className="mr-2">Materialname:</label>
          <input
            type="text"
            id="materialFilter"
            className="border rounded px-2 py-1 mr-4 bg-white"
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
          />
          <label htmlFor="herstellerFilter" className="mr-2">Hersteller:</label>
          <input
            type="text"
            id="herstellerFilter"
            className="border rounded px-2 py-1 bg-white"
            value={herstellerFilter}
            onChange={(e) => setHerstellerFilter(e.target.value)}
          />
          <button 
            onClick={handleAddPropertyFilter}
            className="bg-amber-600 text-white px-3 py-1 rounded hover:bg-amber-800 ml-auto"
          >
            + Eigenschaftsfilter hinzufügen
          </button>
      </div>

      <div id="propertyFiltersContainer" className="mt-2 space-y-2">
        {propertyFilters.length === 0 ? (
          <div className="text-sm text-gray-600">Keine Eigenschaftsfilter hinzugefügt.</div>
        ) : (
          propertyFilters.map((pf, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="border rounded px-2 py-1 bg-white"
                value={pf.name}
                onChange={(e) => updatePropertyFilter(idx, { name: e.target.value })}
              >
                <option value="">Eigenschaft wählen...</option>
                {propertyNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <select
                className="border rounded px-2 py-1 bg-white"
                value={pf.operator}
                onChange={(e) => updatePropertyFilter(idx, { operator: e.target.value as PropertyFilter['operator'] })}
              >
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value="<">{'<'}</option>
                <option value="<=">{'<='}</option>
                <option value=">">{'>'}</option>
                <option value=">=">{'>='}</option>
                <option value="contains">enthält</option>
              </select>

              <input
                type="text"
                className="border rounded px-2 py-1 bg-white"
                placeholder="Wert"
                value={pf.value}
                onChange={(e) => updatePropertyFilter(idx, { value: e.target.value })}
              />

              <button
                type="button"
                className="text-red-700 hover:underline"
                onClick={() => removePropertyFilter(idx)}
              >
                Entfernen
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}