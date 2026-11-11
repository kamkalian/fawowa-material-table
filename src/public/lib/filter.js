// Filtern, Sortieren und Anzeigen der Materialien. Reine Funktionen, ohne DOM.

import { pick, t } from './i18n.js';

export function displayName(m, lang) {
  return pick(m.name, lang);
}

export function categoryName(m, lang) {
  return pick(m.kategorie?.name, lang);
}

// --- Filter auf Materialien ---

function matchesText(m, q) {
  return [m.name.de, m.name.en, m.hersteller]
    .some(s => s && s.toLowerCase().includes(q));
}

function matchesFilter(m, f) {
  const w = m.werte[f.kw];
  if (!w || w.wert === null || w.wert === undefined) return false;

  switch (f.op) {
    case 'bis': return typeof w.wert === 'number' && w.einheit === f.unit && w.wert <= f.a;
    case 'ab': return typeof w.wert === 'number' && w.einheit === f.unit && w.wert >= f.a;
    case 'ist': return typeof w.wert === 'number' && w.einheit === f.unit && w.wert === f.a;
    case 'von': return typeof w.wert === 'number' && w.einheit === f.unit && w.wert >= f.a && w.wert <= f.b;
    case 'enthaelt': return typeof w.wert === 'string' && w.wert.toLowerCase().includes(f.text.toLowerCase());
    case 'in': return f.ids.includes(w.optionId);
    default: return w.wert === f.ja;
  }
}

/** Materialien nach Suche und Filtern. */
export function filterMaterials(materials, state) {
  const q = state.q.trim().toLowerCase();
  const cats = state.cats ?? [];
  return materials.filter(m =>
    (!cats.length || cats.includes(m.kategorie.slug)) &&
    (!q || matchesText(m, q)) &&
    state.filters.every(f => matchesFilter(m, f))
  );
}

// --- Sortieren ---

function sortValue(m, key, propMap, lang) {
  if (key === 'name') return displayName(m, lang);
  if (key === 'kategorie') return categoryName(m, lang);
  const w = m.werte[key];
  if (!w || w.wert === null || w.wert === undefined) return null;
  const typ = propMap.get(key)?.typ;
  if (typ === 'ja_nein') return w.wert ? 1 : 0;
  if (typ === 'auswahl') return pick(w.wert, lang);
  return w.wert;
}

/** Sortiert eine Kopie. Leere Werte stehen immer am Ende. */
export function sortMaterials(rows, sort, props, lang) {
  if (!sort) return rows;
  const propMap = new Map(props.map(p => [p.kurzwort, p]));
  const collator = new Intl.Collator(lang === 'en' ? 'en' : 'de', { numeric: true, sensitivity: 'base' });
  const sign = sort.dir === 'desc' ? -1 : 1;

  return rows.slice().sort((a, b) => {
    const va = sortValue(a, sort.key, propMap, lang);
    const vb = sortValue(b, sort.key, propMap, lang);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
    return collator.compare(String(va), String(vb)) * sign;
  });
}

// --- Anzeige ---

export function formatNumber(n, lang) {
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: 4 });
}

export function formatValue(prop, w, lang) {
  if (!w || w.wert === null || w.wert === undefined) return null;
  switch (prop.typ) {
    case 'zahl': return `${formatNumber(w.wert, lang)}${w.einheit ? ` ${w.einheit}` : ''}`;
    case 'ja_nein': return t(lang, w.wert ? 'yes' : 'no');
    case 'auswahl': return pick(w.wert, lang);
    default: return String(w.wert);
  }
}

export function vermerkText(w, lang) {
  if (!w?.vermerk) return null;
  return pick(w.vermerk, lang);
}

/** Lesbare Beschreibung eines Filters für die Chips. */
export function filterLabel(f, prop, lang) {
  const name = pick(prop.name, lang);
  switch (f.op) {
    case 'bis': return `${name} ${t(lang, 'opMax')} ${formatNumber(f.a, lang)} ${f.unit}`;
    case 'ab': return `${name} ${t(lang, 'opMin')} ${formatNumber(f.a, lang)} ${f.unit}`;
    case 'ist': return `${name} ${t(lang, 'opEq')} ${formatNumber(f.a, lang)} ${f.unit}`;
    case 'von': return `${name} ${formatNumber(f.a, lang)}–${formatNumber(f.b, lang)} ${f.unit}`;
    case 'enthaelt': return `${name} ${t(lang, 'opContains')} „${f.text}“`;
    case 'in': {
      const labels = f.ids
        .map(id => prop.optionen.find(o => o.id === id))
        .filter(Boolean)
        .map(o => pick({ de: o.de, en: o.en }, lang));
      return `${name} ${t(lang, 'opIn')}: ${labels.join(', ')}`;
    }
    default: return `${name}: ${t(lang, f.ja ? 'yes' : 'no')}`;
  }
}

/** Einheiten, die bei einer Zahl-Eigenschaft vorkommen (Standard zuerst). */
export function unitsFor(materials, prop) {
  const units = new Set(prop.einheit ? [prop.einheit] : []);
  materials.forEach(m => {
    const w = m.werte[prop.kurzwort];
    if (w?.einheit) units.add(w.einheit);
  });
  return [...units];
}

// --- Gruppieren gleichnamiger Materialien ---

/** Gleicher Name (deutsch, ohne Beachtung von Groß-/Kleinschreibung und doppelten Leerzeichen) in derselben Kategorie */
export function gruppenSchluessel(m) {
  return `${m.kategorie.slug}|${m.name.de.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

/**
 * Fasst Materialien mit gleichem Namen zu Gruppen zusammen. Die Reihenfolge bleibt erhalten:
 * eine Gruppe steht an der Stelle ihres ersten Mitglieds. Einzelne Materialien bleiben einzeln.
 * Ergebnis: [{ typ: 'gruppe', key, mitglieder }, { typ: 'einzel', material }, ...]
 */
export function gruppiere(rows) {
  const gruppen = new Map();
  for (const m of rows) {
    const key = gruppenSchluessel(m);
    if (!gruppen.has(key)) gruppen.set(key, []);
    gruppen.get(key).push(m);
  }
  return [...gruppen.entries()].map(([key, mitglieder]) =>
    mitglieder.length > 1 ? { typ: 'gruppe', key, mitglieder } : { typ: 'einzel', material: mitglieder[0] }
  );
}

/** Ohne Gruppierung: jedes Material für sich */
export function alsEinzelne(rows) {
  return rows.map(material => ({ typ: 'einzel', material }));
}

/**
 * Zusammenfassung einer Eigenschaft für die Kopfzeile einer Gruppe.
 * Zahlen: Bereich (z. B. "4–10 mm"), bei verschiedenen Einheiten "…". Sonst: der gemeinsame Wert, bei Abweichungen "…".
 * Liefert null, wenn kein Mitglied einen Wert hat.
 */
export function gruppenWert(prop, mitglieder, lang) {
  const werte = mitglieder
    .map(m => m.werte[prop.kurzwort])
    .filter(w => w && w.wert !== null && w.wert !== undefined);
  if (!werte.length) return null;

  if (prop.typ === 'zahl') {
    if (new Set(werte.map(w => w.einheit ?? '')).size > 1) return '…';
    const zahlen = werte.map(w => w.wert);
    const min = Math.min(...zahlen);
    const max = Math.max(...zahlen);
    const einheit = werte[0].einheit ? ` ${werte[0].einheit}` : '';
    return min === max
      ? `${formatNumber(min, lang)}${einheit}`
      : `${formatNumber(min, lang)}–${formatNumber(max, lang)}${einheit}`;
  }

  const texte = new Set(werte.map(w => formatValue(prop, w, lang)));
  return texte.size === 1 && werte.length === mitglieder.length ? [...texte][0] : '…';
}

/** Hat mindestens ein Mitglied bei dieser Eigenschaft einen Vermerk (z. B. "ungeprüft")? */
export function gruppenHatVermerk(prop, mitglieder) {
  return mitglieder.some(m => !!m.werte[prop.kurzwort]?.vermerk);
}
