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

export type PropertyFilter =
  | { name: string; type: 'text'; value: string }
  | { name: string; type: 'dropdown'; value: string }
  | { name: string; type: 'range'; min: number; max: number };
