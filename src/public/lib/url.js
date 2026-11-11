// Zustand der Tabelle <-> Adresse (URL).
//
// Beispiel:
//   ?q=sperrholz&cat=holz,metall&f=gewicht:bis:3&f=staerke:4..10&f=wasserfest:ja&sort=gewicht&cols=staerke,gewicht&lang=de&m=12
//
// cat: Kurznamen der gewählten Kategorien (mehrere möglich, ohne Angabe gelten alle).
//
// Filter (Teil nach "f="):
//   zahl:       kw:bis:V[:Einheit]   kw:ab:V[:Einheit]   kw:ist:V[:Einheit]   kw:A..B[:Einheit]
//   text:       kw:enthaelt:TEXT
//   auswahl:    kw:in:ID,ID
//   ja/nein:    kw:ja   kw:nein
// Ohne Einheit gilt die Standard-Einheit der Eigenschaft.

export const LANGS = ['de', 'en'];

export function emptyState(lang = 'de') {
  return { q: '', cats: [], filters: [], sort: null, cols: null, lang, m: null };
}

/**
 * Liest die Adresse. Liefert den Zustand und eine Liste der ignorierten Teile.
 * props: Eigenschaften aus der API; kategorien: Kurznamen der bekannten Kategorien (ohne Angabe gilt jeder).
 */
export function parseSearch(search, props, kategorien = null) {
  const params = new URLSearchParams(search);
  const propMap = new Map(props.map(p => [p.kurzwort, p]));
  const fehler = [];
  const urlLang = params.get('lang');
  const state = emptyState(LANGS.includes(urlLang) ? urlLang : 'de');
  state.q = params.get('q') || '';

  for (const slug of (params.get('cat') || '').split(',').map(s => s.trim()).filter(Boolean)) {
    if (kategorien && !kategorien.includes(slug)) fehler.push(`cat=${slug}`);
    else if (!state.cats.includes(slug)) state.cats.push(slug);
  }

  for (const raw of params.getAll('f')) {
    try {
      state.filters.push(parseFilter(raw, propMap));
    } catch {
      fehler.push(raw);
    }
  }

  const sort = params.get('sort');
  if (sort) {
    const key = sort.replace(/^-/, '');
    if (key === 'name' || key === 'kategorie' || propMap.has(key)) {
      state.sort = { key, dir: sort.startsWith('-') ? 'desc' : 'asc' };
    } else {
      fehler.push(`sort=${sort}`);
    }
  }

  const cols = params.get('cols');
  if (cols !== null) {
    const keys = cols.split(',').map(s => s.trim()).filter(Boolean);
    state.cols = keys.filter(k => propMap.has(k));
    keys.filter(k => !propMap.has(k)).forEach(k => fehler.push(`cols=${k}`));
  }

  const m = params.get('m');
  if (m && /^\d+$/.test(m)) state.m = Number(m);

  return { state, fehler };
}

/** Baut die Adresse aus dem Zustand. */
export function buildSearch(state, props) {
  const propMap = new Map(props.map(p => [p.kurzwort, p]));
  const pairs = [];
  if (state.q) pairs.push(['q', state.q]);
  if (state.cats.length) pairs.push(['cat', state.cats.join(',')]);
  state.filters.forEach(f => pairs.push(['f', serializeFilter(f, propMap.get(f.kw))]));
  if (state.sort) pairs.push(['sort', (state.sort.dir === 'desc' ? '-' : '') + state.sort.key]);
  if (state.cols !== null) pairs.push(['cols', state.cols.join(',')]);
  pairs.push(['lang', state.lang]);
  if (state.m) pairs.push(['m', String(state.m)]);
  // Doppelpunkt, Komma und Schrägstrich bleiben lesbar; der Rest wird kodiert.
  const enc = (s) => encodeURIComponent(s).replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%2F/g, '/');
  return `?${pairs.map(([k, v]) => `${k}=${enc(v)}`).join('&')}`;
}

// --- Filter ---

function number(text) {
  const s = String(text ?? '').trim().replace(',', '.');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) throw new Error('number');
  return Number(s);
}

export function parseFilter(raw, propMap) {
  const [kw, ...rest] = raw.split(':');
  const p = propMap.get(kw);
  if (!p || !p.filterbar) throw new Error('property');
  const op = rest[0];

  if (p.typ === 'zahl') {
    if (op === 'bis' || op === 'ab' || op === 'ist') {
      const a = number(rest[1]);
      return { kw, op, a, unit: rest[2] || p.einheit };
    }
    const m = /^(.+)\.\.(.+)$/.exec(op ?? '');
    if (m) {
      const a = number(m[1]);
      const b = number(m[2]);
      if (a > b) throw new Error('range');
      return { kw, op: 'von', a, b, unit: rest[1] || p.einheit };
    }
    throw new Error('op');
  }

  if (p.typ === 'text') {
    if (op !== 'enthaelt') throw new Error('op');
    const text = rest.slice(1).join(':');
    if (!text) throw new Error('empty');
    return { kw, op: 'enthaelt', text };
  }

  if (p.typ === 'auswahl') {
    if (op !== 'in') throw new Error('op');
    const valid = new Set((p.optionen || []).map(o => o.id));
    const ids = (rest[1] || '').split(',').map(Number).filter(id => valid.has(id));
    if (!ids.length) throw new Error('options');
    return { kw, op: 'in', ids: [...new Set(ids)] };
  }

  if (p.typ === 'ja_nein') {
    if (op !== 'ja' && op !== 'nein') throw new Error('op');
    return { kw, op, ja: op === 'ja' };
  }

  throw new Error('typ');
}

export function serializeFilter(f, p) {
  switch (f.op) {
    case 'bis':
    case 'ab':
    case 'ist': {
      const unit = f.unit && f.unit !== p?.einheit ? `:${f.unit}` : '';
      return `${f.kw}:${f.op}:${f.a}${unit}`;
    }
    case 'von': {
      const unit = f.unit && f.unit !== p?.einheit ? `:${f.unit}` : '';
      return `${f.kw}:${f.a}..${f.b}${unit}`;
    }
    case 'enthaelt':
      return `${f.kw}:enthaelt:${f.text}`;
    case 'in':
      return `${f.kw}:in:${f.ids.join(',')}`;
    default:
      return `${f.kw}:${f.ja ? 'ja' : 'nein'}`;
  }
}
