'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
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
  currentPropertySort
}: MaterialTableProps) {
  const [showPropertyDropdown, setShowPropertyDropdown] = useState<boolean>(false);
  const [selectedProperty, setSelectedProperty] = useState<string>('');

  const toggleDropdown = () => {
    setShowPropertyDropdown(!showPropertyDropdown);
  };

  const handleSortByProperty = (direction: 'asc' | 'desc') => {
    if (selectedProperty) {
      sortByProperty(selectedProperty, direction);
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th 
              onClick={() => sortTable('Materialname')}
              className="p-3 text-left cursor-pointer"
            >
              <div className="flex items-center">
                Materialname
                <span className="sort-icon">
                  {currentSort.column === 'Materialname' ? 
                    (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                </span>
              </div>
            </th>
            <th 
              onClick={() => sortTable('Hersteller')}
              className="p-3 text-left cursor-pointer"
            >
              <div className="flex items-center">
                Hersteller
                <span className="sort-icon">
                  {currentSort.column === 'Hersteller' ? 
                    (currentSort.direction === 'asc' ? '↑' : '↓') : ''}
                </span>
              </div>
            </th>
            <th className="p-3 text-left">
              <div className="flex items-center">
                <span>Eigenschaften</span>
                <div className="property-visibility ml-2 relative">
                  <button 
                    className="property-visibility-btn text-sm bg-gray-200 px-2 py-1 rounded"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown();
                    }}
                  >
                    Ausblenden ▾
                  </button>
                  {showPropertyDropdown && (
                    <div className="property-dropdown show">
                      {propertyNames.map(propName => (
                        <div key={propName} className="property-checkbox flex items-center mb-1">
                          <input
                            type="checkbox"
                            id={`prop-${propName}`}
                            checked={!hiddenProperties.has(propName)}
                            onChange={() => togglePropertyVisibility(propName)}
                            className="mr-2"
                          />
                          <label htmlFor={`prop-${propName}`}>{propName}</label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="sort-controls flex items-center mt-2">
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="sort-select border rounded px-2 py-1 text-sm mr-2"
                >
                  <option value="">Nach Eigenschaft sortieren</option>
                  {propertyNames.map(propName => (
                    <option key={propName} value={propName}>{propName}</option>
                  ))}
                </select>
                <button 
                  onClick={() => handleSortByProperty('asc')}
                  className="sort-btn bg-gray-200 px-2 py-1 rounded text-sm mr-1"
                >
                  ↑
                </button>
                <button 
                  onClick={() => handleSortByProperty('desc')}
                  className="sort-btn bg-gray-200 px-2 py-1 rounded text-sm"
                >
                  ↓
                </button>
              </div>
            </th>
            <th className="p-3 text-left">Links</th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="p-3">{material.Materialname}</td>
              <td className="p-3">{material.Hersteller}</td>
              <td className="p-3">
                {material.Eigenschaften.map((prop: MaterialProperty, i: number) => (
                  <span
                    key={i}
                    className={`property-tag ${hiddenProperties.has(prop.name) ? 'hidden' : ''}`}
                    data-prop-name={prop.name}
                    data-prop-value={prop.wert}
                  >
                    {prop.einheit ? 
                      `${prop.name}: ${prop.wert} ${prop.einheit}` : 
                      `${prop.name}: ${prop.wert}`}
                  </span>
                ))}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1">
                  {material.Link.map((link: MaterialLink, i: number) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex items-center gap-1"
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {link.text}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}