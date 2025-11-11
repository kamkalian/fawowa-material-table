'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X } from 'lucide-react';

export type PropertyFilter = { name: string; operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'contains'; value: string };

// Exportiere die Hilfsfunktion für den Parent
export function matchesOperator(rowValue: unknown, operator: string, filterValue: string): boolean {
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

interface FilterSectionProps {
  onFilterChange: (filters: { materialFilter: string; herstellerFilter: string; propertyFilters: PropertyFilter[] }) => void;
  propertyNames: string[];
}

export default function FilterSection({ 
  onFilterChange, 
  propertyNames 
}: FilterSectionProps) {
  const [materialFilter, setMaterialFilter] = useState<string>('');
  const [herstellerFilter, setHerstellerFilter] = useState<string>('');
  const [propertyFilters, setPropertyFilters] = useState<PropertyFilter[]>([]);

  const handleAddPropertyFilter = () => {
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

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="materialFilter">Materialname</Label>
              <Input
                id="materialFilter"
                placeholder="Material suchen..."
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="herstellerFilter">Hersteller</Label>
              <Input
                id="herstellerFilter"
                placeholder="Hersteller suchen..."
                value={herstellerFilter}
                onChange={(e) => setHerstellerFilter(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={handleAddPropertyFilter}
              className="flex items-center gap-2"
              variant="default"
            >
              <Plus className="h-4 w-4" />
              Eigenschaftsfilter hinzufügen
            </Button>
          </div>

          {propertyFilters.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Eigenschaftsfilter</Label>
              <div className="space-y-2">
                {propertyFilters.map((pf, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center p-2 bg-muted/50 rounded-md">
                    <Select
                      value={pf.name}
                      onValueChange={(value) => updatePropertyFilter(idx, { name: value })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Eigenschaft wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={pf.operator}
                      onValueChange={(value) => updatePropertyFilter(idx, { operator: value as PropertyFilter['operator'] })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="=">=</SelectItem>
                        <SelectItem value="!=">!=</SelectItem>
                        <SelectItem value="<">{'<'}</SelectItem>
                        <SelectItem value="<=">{'<='}</SelectItem>
                        <SelectItem value=">">{'>'}</SelectItem>
                        <SelectItem value=">=">{'>='}</SelectItem>
                        <SelectItem value="contains">enthält</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      className="h-8"
                      placeholder="Wert eingeben..."
                      value={pf.value}
                      onChange={(e) => updatePropertyFilter(idx, { value: e.target.value })}
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePropertyFilter(idx)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}