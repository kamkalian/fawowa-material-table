'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import FilterSection, { matchesOperator, PropertyFilter as FilterSectionPropertyFilter } from '@/components/FilterSection';
import MaterialTable from '@/components/MaterialTable';
import RequestForm from '@/components/RequestForm';
import { Material, PropertyFilter as PropertyFilterType, SortState, PropertySortState, MaterialProperty } from '@/types';
import PropertyFilter from '@/components/PropertyFilter';
import { Button } from '@/components/ui/button';
import { Database, PlusCircle, Search, X } from 'lucide-react';

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
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return materials;
    const q = searchQuery.toLowerCase();
    return materials.filter(m => {
      if (m.Materialname.toLowerCase().includes(q)) return true;
      if (m.Hersteller.toLowerCase().includes(q)) return true;
      return m.Eigenschaften.some(p =>
        p.name.toLowerCase().includes(q) ||
        p.wert.toLowerCase().includes(q) ||
        (p.einheit && p.einheit.toLowerCase().includes(q))
      );
    });
  }, [materials, searchQuery]);

  const filteredMaterials = useMemo(() => {
    let filtered: Material[] = [...searchFiltered];
    
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
  }, [searchFiltered, propertyFilters, filterSectionPropertyFilters, currentSort, currentPropertySort, materialFilter, herstellerFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Database className="h-8 w-8 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Lade Materialien...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold glow-text">Materialdatenbank</h1>
              <p className="text-sm text-muted-foreground">
                {materials.length} Materialien verfügbar
              </p>
            </div>
            <Button
              onClick={() => setShowRequestForm(!showRequestForm)}
              variant={showRequestForm ? 'outline' : 'default'}
              size="sm"
            >
              {showRequestForm ? (
                <><X className="h-4 w-4 mr-2" /> Schließen</>
              ) : (
                <><PlusCircle className="h-4 w-4 mr-2" /> Material anfragen</>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {showRequestForm && (
          <RequestForm
            onClose={() => setShowRequestForm(false)}
          />
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Materialien, Eigenschaften oder Hersteller durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        <FilterSection 
          onFilterChange={handleFilterChange}
          propertyNames={propertyNames}
        />
        
        {propertyFilters.map((filter, index) => (
          <div key={`filter-${index}`}>
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
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filteredMaterials.length} von {materials.length} Materialien angezeigt
          </p>
        </div>

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
      </main>

      <footer className="border-t border-border mt-12 py-6 text-center text-xs text-muted-foreground">
        Materialdatenbank — Admin-Bereich unter <code className="text-primary/70 bg-secondary px-1 rounded">/admin</code>
      </footer>
    </div>
  );
}
