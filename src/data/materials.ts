import { Material } from '@/types';

export const materialData: Material[] = [
  {
    "Materialname": "Evazote 4mm",
    "Hersteller": "Firma Zotefoams plc, UK",
    "Eigenschaften": [
      {"name": "Materialstärke", "wert": "4", "einheit": "mm"},
      {"name": "Gewicht", "wert": "0.19", "einheit": "kg/m²"},
    ],
    "Link": [
      {"text": "Technisches Datenblatt", "url": "https://example.com/abs-datasheet"},
      {"text": "Bestellseite", "url": "https://example.com/abs-order"}
    ]
  },
  {
    "Materialname": "Evazote 10mm",
    "Hersteller": "Firma Zotefoams plc, UK",
    "Eigenschaften": [
      {"name": "Materialstärke", "wert": "10", "einheit": "mm"},
      {"name": "Gewicht", "wert": "0.5", "einheit": "kg/m²"},
    ],
    "Link": [
      {"text": "Technisches Datenblatt", "url": "https://example.com/abs-datasheet"},
      {"text": "Bestellseite", "url": "https://example.com/abs-order"}
    ]
  },
];