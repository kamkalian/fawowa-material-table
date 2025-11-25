// Central domain types used across the app

export interface MaterialProperty {
  name: string;
  wert: string; // numeric values are stored as numeric strings where applicable
  einheit?: string;
}

export interface MaterialLink {
  text: string;
  url: string;
}

export interface Material {
  id?: number;
  Materialname: string;
  Hersteller: string;
  Eigenschaften: MaterialProperty[];
  Link: MaterialLink[];
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface PropertySortState {
  property: string;
  direction: SortDirection;
}

export type FilterType = 'text' | 'dropdown' | 'range';

export interface PropertyFilter {
  name: string;
  type: 'text' | 'dropdown' | 'range';
  value?: string;
  min?: number;
  max?: number;
  enabled?: boolean;
}
