'use client';

import { useState, useEffect, useCallback } from 'react';
import { PropertyFilter as PropertyFilterType, FilterType } from '@/types';

interface PropertyFilterProps {
  propertyNames: string[];
  onFilterChange: (filter: PropertyFilterType | null) => void;
  onRemove: () => void;
  propertyFilterTypeMap: Record<string, FilterType>;
}

export default function PropertyFilter({ 
  propertyNames,
  onFilterChange,
  onRemove,
  propertyFilterTypeMap
}: PropertyFilterProps) {
  const [propertyName, setPropertyName] = useState<string>('');
  const [filterType, setFilterType] = useState<FilterType>('text');
  const [textValue, setTextValue] = useState<string>('');
  const [dropdownValue, setDropdownValue] = useState<string>('');
  const [minValue, setMinValue] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(100);
  const [uniqueValues, setUniqueValues] = useState<string[]>([]);

  // Memoize the filter creation to prevent unnecessary updates
  /*const createFilter = useCallback((): PropertyFilterType | null => {
    if (!propertyName) return null;
    
    if (filterType === 'text' && textValue) {
      return { name: propertyName, type: 'text', value: textValue };
    } 
    if (filterType === 'dropdown' && dropdownValue) {
      return { name: propertyName, type: 'dropdown', value: dropdownValue };
    } 
    if (filterType === 'range') {
      return { name: propertyName, type: 'range', min: minValue, max: maxValue };
    }
    
    return null;
  }, [propertyName, filterType, textValue, dropdownValue, minValue, maxValue]);
  */

  // Only call onFilterChange when the filter actually changes
  // Update filter when any relevant state changes
  useEffect(() => {
    let currentFilter: PropertyFilterType | null = null;
    
    if (propertyName) {
      if (filterType === 'text' && textValue) {
        currentFilter = { name: propertyName, type: 'text', value: textValue };
      } 
      else if (filterType === 'dropdown' && dropdownValue) {
        currentFilter = { name: propertyName, type: 'dropdown', value: dropdownValue };
      } 
      else if (filterType === 'range') {
        currentFilter = { name: propertyName, type: 'range', min: minValue, max: maxValue };
      }
    }
    
    onFilterChange(currentFilter);
  }, [propertyName, filterType, textValue, dropdownValue, minValue, maxValue, onFilterChange]);
  

  // Update unique values when property changes
  useEffect(() => {
    if (propertyName) {
      const mappedFilterType = propertyFilterTypeMap[propertyName] || 'text';
      setFilterType(mappedFilterType);
      // Here you would calculate unique values or range for the selected property
      // For now, we'll use a simple mock
      const values = ['Wert 1', 'Wert 2', 'Wert 3']; // Replace with actual values
      setUniqueValues(values);
      
      // Reset other values when property changes
      setTextValue('');
      setDropdownValue('');
      setMinValue(0);
      setMaxValue(100);
    }
  }, [propertyName]);

  return (
    <div className="property-filter-group mb-4 mt-2 p-2 rounded bg-amber-200">
      <div className="flex flex-wrap gap-2 mb-2">
        <select
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
          className="property-name-select border rounded px-2 py-1 bg-white"
        >
          <option value="">Eigenschaft wählen...</option>
          {propertyNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {filterType === 'text' && (
          <div className="text-filter-container">
            <input
              type="text"
              className="property-value-input border rounded px-2 py-1 w-full bg-white"
              placeholder="Wert (optional)"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
            />
          </div>
        )}

        {filterType === 'dropdown' && (
          <div className="dropdown-filter-container">
            <select
              value={dropdownValue}
              onChange={(e) => setDropdownValue(e.target.value)}
              className="dropdown-select border rounded px-2 py-1 w-full bg-white"
            >
              <option value="">Wert auswählen...</option>
              {uniqueValues.map(value => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        )}

        {filterType === 'range' && (
          <div className="range-filter-container">
            <div className="range-inputs flex items-center mb-2">
              <input
                type="number"
                className="range-min-input range-input border rounded px-2 py-1 w-20"
                value={minValue}
                onChange={(e) => setMinValue(parseFloat(e.target.value) || 0)}
              />
              <span className="mx-2">bis</span>
              <input
                type="number"
                className="range-max-input range-input border rounded px-2 py-1 w-20"
                value={maxValue}
                onChange={(e) => setMaxValue(parseFloat(e.target.value) || 100)}
              />
            </div>
          </div>
        )}
        
        <button 
          onClick={onRemove}
          className="remove-filter bg-amber-600 text-white px-2 py-1 rounded"
        >
          x
        </button>
      </div>
    </div>
  );
}