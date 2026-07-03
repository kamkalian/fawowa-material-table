'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpDown, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { Material, SortState, PropertySortState, MaterialProperty, MaterialLink } from '@/types';

interface MaterialTableProps {
  materials: Material[];
  hiddenProperties: Set<string>;
  togglePropertyVisibility: (propertyName: string) => void;
  propertyNames: string[];
  sortTable: (column: string) => void;
  sortByProperty: (property: string, direction: 'asc' | 'desc') => void;
  currentSort: SortState;
  currentPropertySort: PropertySortState;
}

export default function MaterialTable({ 
  materials, 
  hiddenProperties, 
  togglePropertyVisibility,
  propertyNames,
  sortTable,
  sortByProperty,
  currentSort,
}: MaterialTableProps) {
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPropertyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const SortIcon = ({ column }: { column: string }) => (
    <ArrowUpDown className={`h-3 w-3 ml-1 inline-block transition-colors ${
      currentSort.column === column ? 'text-primary' : 'text-muted-foreground'
    }`} />
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="material-table w-full border-collapse">
          <thead>
            <tr className="bg-secondary/50">
              <th onClick={() => sortTable('Materialname')} className="cursor-pointer hover:text-primary transition-colors">
                <div className="flex items-center gap-1">
                  Materialname
                  <SortIcon column="Materialname" />
                </div>
              </th>
              <th onClick={() => sortTable('Hersteller')} className="cursor-pointer hover:text-primary transition-colors">
                <div className="flex items-center gap-1">
                  Hersteller
                  <SortIcon column="Hersteller" />
                </div>
              </th>
              <th>
                <div className="flex items-center justify-between">
                  <span>Eigenschaften</span>
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowPropertyDropdown(!showPropertyDropdown); }}
                      className="inline-flex items-center gap-1 text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded-md transition-colors"
                    >
                      {hiddenProperties.size > 0 ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      Spalten
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showPropertyDropdown && (
                      <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-md shadow-lg p-2 min-w-[180px]">
                        <div className="text-xs text-muted-foreground mb-2 px-1">Eigenschaften anzeigen</div>
                        {propertyNames.map(propName => (
                          <label key={propName} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-secondary cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={!hiddenProperties.has(propName)}
                              onChange={() => togglePropertyVisibility(propName)}
                              className="rounded accent-primary"
                            />
                            {propName}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className="text-xs bg-input border border-border rounded px-2 py-1 flex-1 text-foreground"
                  >
                    <option value="">Nach Eigenschaft sortieren</option>
                    {propertyNames.map(propName => (
                      <option key={propName} value={propName}>{propName}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => selectedProperty && sortByProperty(selectedProperty, 'asc')}
                    className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded transition-colors"
                    title="Aufsteigend"
                  >
                    ↑
                  </button>
                  <button 
                    onClick={() => selectedProperty && sortByProperty(selectedProperty, 'desc')}
                    className="text-xs bg-secondary hover:bg-secondary/80 px-2 py-1 rounded transition-colors"
                    title="Absteigend"
                  >
                    ↓
                  </button>
                </div>
              </th>
              <th>Links</th>
            </tr>
          </thead>
          <tbody>
            {materials.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-12">
                  Keine Materialien gefunden
                </td>
              </tr>
            ) : (
              materials.map((material, index) => (
                <tr key={index}>
                  <td className="font-medium text-foreground">{material.Materialname}</td>
                  <td className="text-muted-foreground">{material.Hersteller || '—'}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {material.Eigenschaften.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        material.Eigenschaften.map((prop: MaterialProperty, i: number) => (
                          <span
                            key={i}
                            className={`property-tag ${hiddenProperties.has(prop.name) ? 'hidden' : ''}`}
                          >
                            {prop.einheit 
                              ? `${prop.name}: ${prop.wert} ${prop.einheit}` 
                              : `${prop.name}: ${prop.wert}`}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {material.Link.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        material.Link.map((link: MaterialLink, i: number) => (
                          <Button
                            key={i}
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-7 text-xs border-border hover:border-primary/50 hover:text-primary transition-colors"
                          >
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                              {link.text}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}