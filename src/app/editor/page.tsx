'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, Download, Upload } from 'lucide-react';
import { Material, MaterialProperty, MaterialLink } from '@/types';
import { materialsToCSV, parseCSV } from '@/lib/csv-utils';

export default function MaterialEditor() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [isNewMaterial, setIsNewMaterial] = useState(false);
  const [loading, setLoading] = useState(true);

  // Materialien aus CSV laden
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const response = await fetch('/api/materials');
        if (response.ok) {
          const data = await response.json();
          setMaterials(data);
        } else {
          console.error('Failed to load materials');
          setMaterials([]);
        }
      } catch (error) {
        console.error('Error loading materials:', error);
        setMaterials([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, []);

  // Automatisch in CSV speichern
  const saveToCSV = async (materialsToSave: Material[]) => {
    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(materialsToSave),
      });

      if (!response.ok) {
        throw new Error('Failed to save materials');
      }
    } catch (error) {
      console.error('Error saving materials:', error);
      alert('Fehler beim Speichern der Materialien');
    }
  };

  const createNewMaterial = (): Material => ({
    Materialname: '',
    Hersteller: '',
    Eigenschaften: [],
    Link: []
  });

  const handleNewMaterial = () => {
    const newMaterial = createNewMaterial();
    setEditingMaterial(newMaterial);
    setEditingIndex(-1);
    setIsNewMaterial(true);
  };

  const handleEditMaterial = (material: Material, index: number) => {
    setEditingMaterial({ ...material });
    setEditingIndex(index);
    setIsNewMaterial(false);
  };

  const handleSaveMaterial = async () => {
    if (!editingMaterial) return;

    let updatedMaterials: Material[];

    if (isNewMaterial) {
      updatedMaterials = [...materials, editingMaterial];
    } else {
      updatedMaterials = materials.map((material, index) => 
        index === editingIndex ? editingMaterial : material
      );
    }
    
    // Sofort in CSV speichern
    await saveToCSV(updatedMaterials);
    
    // State aktualisieren
    setMaterials(updatedMaterials);
    setEditingMaterial(null);
    setEditingIndex(-1);
    setIsNewMaterial(false);
  };

  const handleDeleteMaterial = async (index: number) => {
    const confirmed = confirm('Material wirklich löschen?');
    if (!confirmed) return;

    const updatedMaterials = materials.filter((_, i) => i !== index);
    
    // Sofort in CSV speichern
    await saveToCSV(updatedMaterials);
    
    // State aktualisieren
    setMaterials(updatedMaterials);
  };

  const updateEditingMaterial = (updates: Partial<Material>) => {
    if (!editingMaterial) return;
    setEditingMaterial({ ...editingMaterial, ...updates });
  };

  const addProperty = () => {
    if (!editingMaterial) return;
    const newProperty: MaterialProperty = { name: '', wert: '', einheit: '' };
    updateEditingMaterial({
      Eigenschaften: [...editingMaterial.Eigenschaften, newProperty]
    });
  };

  const updateProperty = (index: number, property: MaterialProperty) => {
    if (!editingMaterial) return;
    const newProperties = [...editingMaterial.Eigenschaften];
    newProperties[index] = property;
    updateEditingMaterial({ Eigenschaften: newProperties });
  };

  const removeProperty = (index: number) => {
    if (!editingMaterial) return;
    updateEditingMaterial({
      Eigenschaften: editingMaterial.Eigenschaften.filter((_, i) => i !== index)
    });
  };

  const addLink = () => {
    if (!editingMaterial) return;
    const newLink: MaterialLink = { text: '', url: '' };
    updateEditingMaterial({
      Link: [...editingMaterial.Link, newLink]
    });
  };

  const updateLink = (index: number, link: MaterialLink) => {
    if (!editingMaterial) return;
    const newLinks = [...editingMaterial.Link];
    newLinks[index] = link;
    updateEditingMaterial({ Link: newLinks });
  };

  const removeLink = (index: number) => {
    if (!editingMaterial) return;
    updateEditingMaterial({
      Link: editingMaterial.Link.filter((_, i) => i !== index)
    });
  };

  const exportCSV = () => {
    const csvContent = materialsToCSV(materials);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'materials_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (materials.length > 0) {
      const confirmed = confirm(
        `Achtung: Beim Import werden alle ${materials.length} vorhandenen Materialien überschrieben. Fortfahren?`
      );
      if (!confirmed) {
        event.target.value = '';
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const newMaterials = parseCSV(text);
      
      // Sofort in CSV speichern
      await saveToCSV(newMaterials);
      
      // State aktualisieren
      setMaterials(newMaterials);
      alert(`${newMaterials.length} Materialien importiert`);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (loading) {
    return <div className="container mx-auto p-4">Lade Materialien...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Material Editor</h1>
        <div className="flex gap-2">
          <Button onClick={handleNewMaterial}>
            <Plus className="h-4 w-4 mr-2" />
            Neues Material
          </Button>
          <Button onClick={exportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            CSV Exportieren
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={importCSV}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              CSV Importieren
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material List */}
        <Card>
          <CardHeader>
            <CardTitle>Materialien ({materials.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 overflow-y-auto">
              {materials.map((material, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex-1">
                    <div className="font-medium">{material.Materialname}</div>
                    <div className="text-sm text-gray-500">{material.Hersteller}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditMaterial(material, index)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteMaterial(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Editor Form */}
        {editingMaterial && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isNewMaterial ? 'Neues Material' : 'Material bearbeiten'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="materialname">Materialname</Label>
                <Input
                  id="materialname"
                  value={editingMaterial.Materialname}
                  onChange={(e) => updateEditingMaterial({ Materialname: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hersteller">Hersteller</Label>
                <Input
                  id="hersteller"
                  value={editingMaterial.Hersteller}
                  onChange={(e) => updateEditingMaterial({ Hersteller: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Eigenschaften</Label>
                  <Button size="sm" onClick={addProperty}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingMaterial.Eigenschaften.map((property, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 items-center">
                      <Input
                        placeholder="Name (z.B. Materialstärke)"
                        value={property.name}
                        onChange={(e) => updateProperty(index, { ...property, name: e.target.value })}
                      />
                      <Input
                        placeholder="Wert"
                        value={property.wert}
                        onChange={(e) => updateProperty(index, { ...property, wert: e.target.value })}
                      />
                      <div className="flex gap-1">
                        <Input
                          placeholder="Einheit (z.B. mm)"
                          value={property.einheit || ''}
                          onChange={(e) => updateProperty(index, { ...property, einheit: e.target.value })}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeProperty(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Links</Label>
                  <Button size="sm" onClick={addLink}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {editingMaterial.Link.map((link, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2 items-center">
                      <Input
                        placeholder="Link Text"
                        value={link.text}
                        onChange={(e) => updateLink(index, { ...link, text: e.target.value })}
                      />
                      <div className="flex gap-1">
                        <Input
                          placeholder="URL"
                          value={link.url}
                          onChange={(e) => updateLink(index, { ...link, url: e.target.value })}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeLink(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveMaterial}>
                  Speichern
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingMaterial(null);
                    setIsNewMaterial(false);
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}