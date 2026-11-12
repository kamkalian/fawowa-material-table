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
    case 'in': return (w.optionIds ?? [w.optionId]).some(id => f.ids.includes(id)); // bei Mehrfachauswahl genügt eine
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

/** Auswahl als Text: eine Liste (Mehrfachauswahl) wird mit Komma verbunden */
function alsText(wert, lang) {
  return Array.isArray(wert) ? wert.map(o => pick(o, lang)).join(', ') : pick(wert, lang);
}

function sortValue(m, key, propMap, lang) {
  if (key === 'name') return displayName(m, lang);
  if (key === 'kategorie') return categoryName(m, lang);
  const w = m.werte[key];
  if (!w || w.wert === null || w.wert === undefined) return null;
  const typ = propMap.get(key)?.typ;
  if (typ === 'ja_nein') return w.wert ? 1 : 0;
  if (typ === 'auswahl') return alsText(w.wert, lang);
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

// formatValue steht unten; alsText oben dient beiden
export function formatNumber(n, lang) {
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: 4 });
}

export function formatValue(prop, w, lang) {
  if (!w || w.wert === null || w.wert === undefined) return null;
  switch (prop.typ) {
    case 'zahl': return `${formatNumber(w.wert, lang)}${w.einheit ? ` ${w.einheit}` : ''}`;
    case 'ja_nein': return t(lang, w.wert ? 'yes' : 'no');
    case 'auswahl': return alsText(w.wert, lang);
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

// --- Gruppieren nach Namensteilen (wie die Tabellengruppen in phpMyAdmin) ---

/** Namensteile: am Unterstrich getrennt, ohne doppelte Leerzeichen; leere Teile entfallen. */
export function namensTeile(m) {
  const teile = m.name.de.split('_').map(t => t.trim().replace(/\s+/g, ' ')).filter(Boolean);
  return teile.length ? teile : [''];
}

/** Schlüssel eines Materials auf voller Länge: Kategorie und alle Namensteile (ohne Groß-/Kleinschreibung) */
export function gruppenSchluessel(m) {
  return `${m.kategorie.slug}|${namensTeile(m).join('_').toLowerCase()}`;
}

function zuItem(knoten) {
  if (knoten.anzahl === 1) return { typ: 'einzel', material: knoten.alle[0] };
  // Kette ohne Verzweigung zusammenziehen: "Holz" → "Pappel" wird zu "Holz_Pappel"
  while (knoten.kinder.length === 1 && knoten.kinder[0].knoten) {
    const kind = knoten.kinder[0].knoten;
    knoten = { ...kind, label: `${knoten.label}_${kind.label}` };
  }
  return {
    typ: 'gruppe',
    key: knoten.key,
    label: knoten.label,
    mitglieder: knoten.alle,
    kinder: knoten.kinder.map(k => (k.knoten ? zuItem(k.knoten) : { typ: 'einzel', material: k.material }))
  };
}

/**
 * Fasst Materialien zu Gruppen zusammen, wenn ihre Namen am Anfang gleiche Teile haben (Teile sind durch "_" getrennt).
 * Gruppen können verschachtelt sein: Holz_Pappel_4mm, Holz_Pappel_10mm, Holz_Kiefer → Gruppe "Holz" mit der
 * Untergruppe "Pappel" und dem Einzelnen "Kiefer". Gleiche Namen ohne Unterstrich (Pappelsperrholz ×3) bilden
 * ebenfalls eine Gruppe. Gruppiert wird nur innerhalb einer Kategorie. Die Reihenfolge bleibt erhalten:
 * eine Gruppe steht an der Stelle ihres ersten Mitglieds; Einzelne bleiben einzeln.
 * Ergebnis: [{ typ: 'gruppe', key, label, mitglieder, kinder: [Items] }, { typ: 'einzel', material }, ...]
 */
export function gruppiere(rows) {
  const wurzeln = new Map(); // Kategorie → Knoten
  const oben = [];           // Reihenfolge der obersten Knoten
  for (const m of rows) {
    let eltern = wurzeln.get(m.kategorie.slug);
    if (!eltern) {
      eltern = { kinder: [], index: new Map() };
      wurzeln.set(m.kategorie.slug, eltern);
    }
    let pfad = '';
    let knoten = eltern;
    const teile = namensTeile(m);
    teile.forEach((teil) => {
      pfad = pfad ? `${pfad}_${teil.toLowerCase()}` : teil.toLowerCase();
      let kind = knoten.index.get(teil.toLowerCase());
      if (!kind) {
        kind = { key: `${m.kategorie.slug}|${pfad}`, label: teil, kinder: [], index: new Map(), alle: [], anzahl: 0 };
        knoten.index.set(teil.toLowerCase(), kind);
        knoten.kinder.push({ knoten: kind });
        if (knoten === eltern) oben.push(kind);
      }
      kind.alle.push(m);
      kind.anzahl++;
      knoten = kind;
    });
    knoten.kinder.push({ material: m }); // das Material selbst am Ende seines Namenspfads
  }
  return oben.map(zuItem);
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
