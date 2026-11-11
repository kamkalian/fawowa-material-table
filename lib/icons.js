// Auswahl an Kategorie-Icons, in drei Gruppen:
//  - Linien-Icons (eigene Zeichnungen, einfarbig): Holzstapel, Baumscheibe, Stahlträger, Mutter, Flasche, Blasen, Verbundplatte
//  - farbige Material-Icons ("mat-…", eigene Zeichnungen)
//  - Symbole aus Lucide
// Alle sind in src/shared/CategoryIcon.svelte hinterlegt; neue Namen müssen dort ebenfalls eingetragen werden.

export const LINIEN_ICONS = [
  'wood-logs', 'tree-rings', 'metal-beam', 'metal-nut', 'plastic-bottle', 'foam-bubbles', 'sandwich-panel'
];

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

export const ICON_NAMEN = [...LINIEN_ICONS, ...MATERIAL_ICONS, ...SYMBOL_ICONS];

export const STANDARD_ICON = 'circle';

// Vorschläge für die Kategorien der Startdaten
export const ICON_NACH_SLUG = {
  'holz': 'wood-logs',
  'sperrholz': 'layers',
  'metall': 'metal-beam',
  'schaum-daemmung': 'foam-bubbles',
  'kunststoff': 'plastic-bottle',
  'verbundplatte': 'sandwich-panel',
  'textil': 'shirt',
  'staebe-leisten': 'ruler'
};

// Frühere Vorschläge (auch die farbigen). Die einmalige Migration ersetzt sie durch die aktuellen.
// Eine später von Hand gewählte Wahl bleibt erhalten, weil die Migration nur einmal je Version läuft.
export const ALTE_ICON_VORSCHLAEGE = {
  'holz': ['tree-pine', 'log', 'wood-logs', 'mat-holz'],
  'sperrholz': ['layers', 'mat-sperrholz'],
  'metall': ['wrench', 'metal-ingot', 'metal-beam', 'mat-metall'],
  'schaum-daemmung': ['snowflake', 'foam-bubbles', 'mat-schaum'],
  'kunststoff': ['box', 'plastic-bottle', 'mat-kunststoff'],
  'verbundplatte': ['panels-top-left', 'sandwich-panel', 'mat-verbund'],
  'textil': ['shirt', 'mat-textil'],
  'staebe-leisten': ['ruler', 'mat-staebe']
};

// Version der Icon-Vorschläge; wird in der Datenbank (user_version) gemerkt, damit die Migration nur einmal läuft.
export const ICON_VERSION = 4;
