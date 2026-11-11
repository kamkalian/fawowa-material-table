// Auswahl an Kategorie-Icons. Alle sind selbst gezeichnet (einfarbige Linien in der Akzentfarbe).
// Die Zeichnungen stehen in src/shared/CategoryIcon.svelte; neue Namen müssen dort ebenfalls eingetragen werden.

export const ICON_NAMEN = [
  'trees',          // zwei Bäume
  'wood-logs',      // Holzstapel
  'tree-rings',     // Baumscheibe
  'metal-beam',     // Stahlträger
  'metal-nut',      // Mutter
  'plastic-bottle', // Flasche
  'foam-bubbles',   // Blasen
  'sandwich-panel', // Verbundplatte
  'shirt',          // T-Shirt
  'ruler',          // Lineal
  'circle'          // neutral
];

export const STANDARD_ICON = 'circle';

// Vorschläge für die Kategorien der Startdaten
export const ICON_NACH_SLUG = {
  'holz': 'trees',
  'metall': 'metal-beam',
  'schaum-daemmung': 'foam-bubbles',
  'kunststoff': 'plastic-bottle',
  'verbundplatte': 'sandwich-panel',
  'textil': 'shirt',
  'staebe-leisten': 'ruler'
};

// Frühere Vorschläge. Die einmalige Migration ersetzt sie durch die aktuellen.
// Eine später von Hand gewählte Wahl bleibt erhalten, weil die Migration nur einmal je Version läuft.
export const ALTE_ICON_VORSCHLAEGE = {
  'holz': ['tree-pine', 'log', 'wood-logs', 'mat-holz'],
  'metall': ['wrench', 'metal-ingot', 'metal-beam', 'mat-metall'],
  'schaum-daemmung': ['snowflake', 'foam-bubbles', 'mat-schaum'],
  'kunststoff': ['box', 'plastic-bottle', 'mat-kunststoff'],
  'verbundplatte': ['panels-top-left', 'sandwich-panel', 'mat-verbund'],
  'textil': ['shirt', 'mat-textil'],
  'staebe-leisten': ['ruler', 'mat-staebe']
};

// Version der Icon-Vorschläge; wird in der Datenbank (user_version) gemerkt, damit die Migration nur einmal läuft.
// Version 6: nur noch selbst gezeichnete Icons. Wer ein anderes (früheres) Icon trägt, bekommt das Standard-Symbol.
export const ICON_VERSION = 6;
