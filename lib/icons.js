// Auswahl an Kategorie-Icons.
// "mat-…" sind farbige Material-Icons (eigene Zeichnungen), die übrigen einfarbige Symbole aus Lucide.
// Alle sind in src/shared/CategoryIcon.svelte hinterlegt; neue Namen müssen dort ebenfalls eingetragen werden.

export const MATERIAL_ICONS = [
  'mat-holz', 'mat-sperrholz', 'mat-metall', 'mat-kunststoff',
  'mat-schaum', 'mat-verbund', 'mat-textil', 'mat-staebe'
];

export const SYMBOL_ICONS = [
  'tree-pine', 'trees', 'leaf', 'sprout',
  'layers', 'layers-2', 'panels-top-left', 'layout-panel-top', 'brick-wall',
  'wrench', 'hammer', 'anvil', 'cog', 'axe',
  'snowflake', 'shield', 'flame', 'droplets', 'wind', 'sun', 'zap',
  'box', 'package', 'cuboid', 'hexagon', 'triangle', 'circle', 'grid-3x3',
  'shirt', 'scissors', 'ruler', 'feather', 'gem', 'mountain', 'paintbrush', 'puzzle', 'sparkles'
];

export const ICON_NAMEN = [...MATERIAL_ICONS, ...SYMBOL_ICONS];

export const STANDARD_ICON = 'circle';

// Vorschläge für die Kategorien der Startdaten
export const ICON_NACH_SLUG = {
  'holz': 'mat-holz',
  'sperrholz': 'mat-sperrholz',
  'metall': 'mat-metall',
  'schaum-daemmung': 'mat-schaum',
  'kunststoff': 'mat-kunststoff',
  'verbundplatte': 'mat-verbund',
  'textil': 'mat-textil',
  'staebe-leisten': 'mat-staebe'
};

// Frühere Vorschläge. Die einmalige Migration ersetzt sie durch die neuen, damit bestehende Datenbanken die besseren Icons bekommen.
export const ALTE_ICON_VORSCHLAEGE = {
  'holz': ['tree-pine', 'log', 'wood-logs'],
  'sperrholz': ['layers'],
  'metall': ['wrench', 'metal-ingot', 'metal-beam'],
  'schaum-daemmung': ['snowflake', 'foam-bubbles'],
  'kunststoff': ['box', 'plastic-bottle'],
  'verbundplatte': ['panels-top-left', 'sandwich-panel'],
  'textil': ['shirt'],
  'staebe-leisten': ['ruler']
};

// Version der Icon-Vorschläge; wird in der Datenbank (user_version) gemerkt, damit die Migration nur einmal läuft.
export const ICON_VERSION = 3;
