// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import FilterSection, { matchesOperator, PropertyFilter as FilterSectionPropertyFilter } from '@/components/FilterSection';
import MaterialTable from '@/components/MaterialTable';
import { Material, PropertyFilter as PropertyFilterType, SortState, PropertySortState, MaterialProperty } from '@/types';
import PropertyFilter from '@/components/PropertyFilter';
import { Button } from '@/components/ui/button';

export default function MaterialDatabase() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenProperties, setHiddenProperties] = useState<Set<string>>(new Set());
  const [propertyNames, setPropertyNames] = useState<string[]>([]);
  const [propertyFilters, setPropertyFilters] = useState<PropertyFilterType[]>([]);
  const [currentSort, setCurrentSort] = useState<SortState>({ column: '', direction: 'asc' });
  const [currentPropertySort, setCurrentPropertySort] = useState<PropertySortState>({ property: '', direction: 'asc' });
  const [materialFilter, setMaterialFilter] = useState<string>('');
  const [herstellerFilter, setHerstellerFilter] = useState<string>('');
  const [filterSectionPropertyFilters, setFilterSectionPropertyFilters] = useState<FilterSectionPropertyFilter[]>([]);

  // Materialien aus CSV laden
  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/materials');
      const data = await response.json();
      setMaterials(data);
      updatePropertyNames(data);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePropertyNames = (materialsData: Material[]) => {
    const names = new Set<string>();
    materialsData.forEach((material: Material) => {
      material.Eigenschaften.forEach((prop: MaterialProperty) => {
        names.add(prop.name);
      });
    });
    setPropertyNames(Array.from(names).sort());
  };

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // Gefilterte Materialien
  const filteredMaterials = useMemo(() => {
    let filtered: Material[] = [...materials];
    
    // Text-Filter anwenden
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
    
    // FilterSection Eigenschaftsfilter anwenden
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
    
    // PropertyFilter Komponenten anwenden
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
    
    // Sortierung anwenden
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
  }, [materials, propertyFilters, filterSectionPropertyFilters, currentSort, currentPropertySort, materialFilter, herstellerFilter]);

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

  if (loading) {
    return <div className="container mx-auto p-4">Lade Materialien aus CSV...</div>;
  }

  return (
    <main className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Materialdatenbank</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {materials.length} Materialien
          </div>
          <Button 
            onClick={() => window.location.href = '/editor'}
            variant="outline"
          >
            Zum Editor
          </Button>
        </div>
      </div>
      
      <FilterSection 
        onFilterChange={handleFilterChange}
        propertyNames={propertyNames}
      />
      
      {propertyFilters.map((filter, index) => (
        <div key={`filter-${index}`} className="mb-4">
          <PropertyFilter
            filter={filter}
            propertyNames={propertyNames}
            materials={materials}
            onFilterChange={(newFilter) => handlePropertyFilterChange(index, newFilter)}
            onRemove={() => handlePropertyFilterChange(index, null)}
            propertyFilterTypeMap={{
              'Materialstärke': 'range',
              'Gewicht': 'range',
            }}
          />
        </div>
      ))}
      
      <div className="rounded-lg border overflow-hidden">
        <MaterialTable
          materials={filteredMaterials}
          hiddenProperties={hiddenProperties}
          togglePropertyVisibility={togglePropertyVisibility}
          propertyNames={propertyNames}
          sortTable={sortTable}
          sortByProperty={sortByProperty}
          currentSort={currentSort}
          currentPropertySort={currentPropertySort}
        />
      </div>
    </main>
  );
}