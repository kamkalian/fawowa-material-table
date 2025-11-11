// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { materialData } from '@/data/materials';
import FilterSection, { matchesOperator, PropertyFilter as FilterSectionPropertyFilter } from '@/components/FilterSection';
import MaterialTable from '@/components/MaterialTable';
import { Material, PropertyFilter as PropertyFilterType, SortState, PropertySortState, MaterialProperty } from '@/types';
import PropertyFilter from '@/components/PropertyFilter';

export default function MaterialDatabase() {
  const [hiddenProperties, setHiddenProperties] = useState<Set<string>>(new Set());
  const [propertyNames, setPropertyNames] = useState<string[]>([]);
  const [propertyFilters, setPropertyFilters] = useState<PropertyFilterType[]>([]);
  const [currentSort, setCurrentSort] = useState<SortState>({ column: '', direction: 'asc' });
  const [currentPropertySort, setCurrentPropertySort] = useState<PropertySortState>({ property: '', direction: 'asc' });
  const [materialFilter, setMaterialFilter] = useState<string>('');
  const [herstellerFilter, setHerstellerFilter] = useState<string>('');
  
  // Neue State für FilterSection PropertyFilters
  const [filterSectionPropertyFilters, setFilterSectionPropertyFilters] = useState<FilterSectionPropertyFilter[]>([]);

  // Collect all property names on component mount
  useEffect(() => {
    const names = new Set<string>();
    materialData.forEach((material) => {
      material.Eigenschaften.forEach((prop: MaterialProperty) => {
        names.add(prop.name);
      });
    });
    setPropertyNames(Array.from(names).sort());
  }, []);

  // Use useMemo to compute filtered and sorted materials
  const materials = useMemo(() => {
    let filtered: Material[] = [...materialData];
    
    // Apply text filters
    if (materialFilter) {
      filtered = filtered.filter(material => 
        material.Materialname.toLowerCase().includes(materialFilter.toLowerCase())
      );
    }

    if (herstellerFilter) {
      filtered = filtered.filter(material => 
        material.Hersteller.toLowerCase().includes(herstellerFilter.toLowerCase())
      );
    }
    
    // Apply FilterSection property filters
    const activeFilterSectionFilters = filterSectionPropertyFilters.filter(f => f.name && f.value);
    if (activeFilterSectionFilters.length > 0) {
      filtered = filtered.filter(material => {
        return activeFilterSectionFilters.every(filter => {
          const prop = material.Eigenschaften.find((p: MaterialProperty) => p.name === filter.name);
          if (!prop) return false;
          
          return matchesOperator(prop.wert, filter.operator, filter.value);
        });
      });
    }
    
    // Apply property filters (existing PropertyFilter components)
    const activeFilters = propertyFilters.filter((f) => f && f.enabled !== false);
    if (activeFilters.length > 0) {
      filtered = filtered.filter(material => {
        return activeFilters.every((filter) => {
          if (!filter) return true;
          
          const prop = material.Eigenschaften.find((p: MaterialProperty) => p.name === filter.name);
          if (!prop) return false;
          
          if (filter.type === 'text' && filter.value) {
            return prop.wert.toLowerCase().includes(filter.value.toLowerCase());
          } else if (filter.type === 'dropdown' && filter.value) {
            return prop.wert === filter.value;
          } else if (filter.type === 'range') {
            const num = parseFloat(prop.wert);
            const minOk = filter.min === undefined || (!isNaN(num) && num >= filter.min);
            const maxOk = filter.max === undefined || (!isNaN(num) && num <= filter.max);
            return minOk && maxOk;
          }
          return true;
        });
      });
    }
    
    // Apply sorting
    if (currentSort.column) {
      filtered.sort((a, b) => {
        const aValue = a[currentSort.column as keyof Material] as string;
        const bValue = b[currentSort.column as keyof Material] as string;
        return currentSort.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      });
    } else if (currentPropertySort.property) {
      filtered.sort((a, b) => {
        const aProp = a.Eigenschaften.find((p: MaterialProperty) => p.name === currentPropertySort.property);
        const bProp = b.Eigenschaften.find((p: MaterialProperty) => p.name === currentPropertySort.property);
        
        if (!aProp && !bProp) return 0;
        if (!aProp) return 1;
        if (!bProp) return -1;
        
        const aNum = parseFloat(aProp.wert);
        const bNum = parseFloat(bProp.wert);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return currentPropertySort.direction === 'asc' ? aNum - bNum : bNum - aNum;
        } else {
          return currentPropertySort.direction === 'asc' 
            ? aProp.wert.localeCompare(bProp.wert) 
            : bProp.wert.localeCompare(aProp.wert);
        }
      });
    }
    
    return filtered;
  }, [propertyFilters, filterSectionPropertyFilters, currentSort, currentPropertySort, materialFilter, herstellerFilter]);

  const togglePropertyVisibility = useCallback((propertyName: string) => {
    setHiddenProperties(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyName)) {
        newSet.delete(propertyName);
      } else {
        newSet.add(propertyName);
      }
      return newSet;
    });
  }, []);

  const sortTable = useCallback((column: string) => {
    setCurrentSort((prev: SortState) => ({
      column,
      direction: prev.column === column ? 
        (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
    setCurrentPropertySort({ property: '', direction: 'asc' });
  }, []);

  const sortByProperty = useCallback((property: string, direction: 'asc' | 'desc') => {
    setCurrentPropertySort({ property, direction });
    setCurrentSort({ column: '', direction: 'asc' });
  }, []);

  const handleFilterChange = useCallback(({ materialFilter, herstellerFilter, propertyFilters }: { 
    materialFilter: string; 
    herstellerFilter: string;
    propertyFilters: FilterSectionPropertyFilter[];
  }) => {
    setMaterialFilter(materialFilter);
    setHerstellerFilter(herstellerFilter);
    setFilterSectionPropertyFilters(propertyFilters);
  }, []);

  const handleAddPropertyFilter = useCallback(() => {
    if (propertyNames.length === 0) return;
    
    setPropertyFilters(prev => [
      ...prev, 
      { 
        name: propertyNames[0], 
        type: 'text', 
        value: '',
        enabled: true,
      }
    ]);
  }, [propertyNames]);

  const handlePropertyFilterChange = useCallback((index: number, filter: PropertyFilterType | null) => {
    setPropertyFilters(prev => {
      const newFilters = [...prev];
      if (filter === null) {
        newFilters.splice(index, 1);
      } else {
        newFilters[index] = filter;
      }
      return newFilters;
    });
  }, []);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Materialdatenbank</h1>
      
      <FilterSection 
        onFilterChange={handleFilterChange}
        propertyNames={propertyNames}
      />
      
      {propertyFilters.map((filter, index) => (
        <div key={`filter-${index}`} className="mb-4">
          <PropertyFilter
            filter={filter}
            propertyNames={propertyNames}
            onFilterChange={(newFilter) => handlePropertyFilterChange(index, newFilter)}
            onRemove={() => handlePropertyFilterChange(index, null)}
            propertyFilterTypeMap={{
              'Materialstärke': 'range',
              'Gewicht': 'range',
            }}
          />
        </div>
      ))}
      
      <MaterialTable
        materials={materials}
        hiddenProperties={hiddenProperties}
        togglePropertyVisibility={togglePropertyVisibility}
        propertyNames={propertyNames}
        sortTable={sortTable}
        sortByProperty={sortByProperty}
        currentSort={currentSort}
        currentPropertySort={currentPropertySort}
      />
    </main>
  );
}