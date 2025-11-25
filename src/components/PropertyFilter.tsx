'use client';

import { useMemo } from 'react';
import { PropertyFilter as PropertyFilterType, FilterType, Material, MaterialProperty } from '@/types';

interface PropertyFilterProps {
  filter: PropertyFilterType;
  propertyNames: string[];
  onFilterChange: (filter: PropertyFilterType) => void;
  onRemove: () => void;
  propertyFilterTypeMap: Record<string, FilterType>;
  materials?: Material[]; // Neue Prop für die Materialien
}

export default function PropertyFilter({
  filter,
  propertyNames,
  onFilterChange,
  onRemove,
  propertyFilterTypeMap,
  materials = [], // Default leeres Array
}: PropertyFilterProps) {
  const enabled = filter.enabled !== false;
  const currentType: FilterType = propertyFilterTypeMap[filter.name] || filter.type || 'text';

  const dropdownOptions = useMemo(() => {
    if (currentType !== 'dropdown' || !filter.name) return [] as string[];
    const values = new Set<string>();
    for (const m of materials) {
      const p = m.Eigenschaften.find((e: MaterialProperty) => e.name === filter.name);
      if (p?.wert) values.add(p.wert);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'de'));
  }, [currentType, filter.name, materials]);

  return (
    <div className="property-filter-group mb-4 mt-2 p-2 rounded bg-amber-200">
      <div className="flex flex-wrap gap-2 mb-2 items-center">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onFilterChange({ ...filter, enabled: e.target.checked })}
          />
          <span className="text-sm">Aktiv</span>
        </label>

        <select
          className="property-name-select border rounded px-2 py-1 bg-white"
          value={filter.name}
          onChange={(e) => {
            const name = e.target.value;
            const mapped = propertyFilterTypeMap[name] || 'text';
            const base = { enabled, name } as Partial<PropertyFilterType>;
            if (mapped === 'range') onFilterChange({ ...(base as any), type: 'range' });
            else if (mapped === 'dropdown') onFilterChange({ ...(base as any), type: 'dropdown', value: '' });
            else onFilterChange({ ...(base as any), type: 'text', value: '' });
          }}
          disabled={!enabled}
        >
          <option value="">Eigenschaft wählen...</option>
          {propertyNames.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        {currentType === 'text' && (
          <input
            type="text"
            className="property-value-input border rounded px-2 py-1 w-full bg-white"
            placeholder="Wert (optional)"
            value={filter.type === 'text' ? filter.value ?? '' : ''}
            onChange={(e) => onFilterChange({ ...filter, type: 'text', value: e.target.value })}
            disabled={!enabled}
          />
        )}

        {currentType === 'dropdown' && (
          <select
            value={filter.type === 'dropdown' ? filter.value ?? '' : ''}
            onChange={(e) => onFilterChange({ ...filter, type: 'dropdown', value: e.target.value })}
            className="dropdown-select border rounded px-2 py-1 w-full bg-white"
            disabled={!enabled}
          >
            <option value="">Wert auswählen...</option>
            {dropdownOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        )}

        {currentType === 'range' && (
          <div className="range-filter-container flex items-center gap-2">
            <input
              type="number"
              className="range-min-input range-input border rounded px-2 py-1 w-24"
              value={filter.type === 'range' && filter.min !== undefined ? filter.min : ''}
              onChange={(e) => onFilterChange({ ...filter, type: 'range', min: e.target.value === '' ? undefined : Number(e.target.value) })}
              disabled={!enabled}
              placeholder="min"
            />
            <span>bis</span>
            <input
              type="number"
              className="range-max-input range-input border rounded px-2 py-1 w-24"
              value={filter.type === 'range' && filter.max !== undefined ? filter.max : ''}
              onChange={(e) => onFilterChange({ ...filter, type: 'range', max: e.target.value === '' ? undefined : Number(e.target.value) })}
              disabled={!enabled}
              placeholder="max"
            />
          </div>
        )}

        <button onClick={onRemove} className="remove-filter bg-amber-600 text-white px-2 py-1 rounded">
          x
        </button>
      </div>
    </div>
  );
}