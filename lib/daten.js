// Lesende Abfragen auf dem Speicher. Die Form der Antworten entspricht der öffentlichen API (/api/v2/...).

export const LINK_STATUS = 'linkstatus';

/** Prüfergebnisse der Links: { [url]: { status, geprueft_am } } (lokale Datei, nicht im Repo) */
export function linkStatus(s) {
  return s.lokal.lies(LINK_STATUS, {});
}

export function listKategorien(s) {
  return s.kategorien.map(k => ({
    id: k.id, slug: k.slug, icon: k.icon || null, name: { de: k.name_de, en: k.name_en || null }, reihenfolge: k.reihenfolge
  }));
}

export function listEigenschaften(s) {
  return s.eigenschaften.map(e => ({
    id: e.id,
    kurzwort: e.kurzwort,
    name: { de: e.name_de, en: e.name_en || null },
    typ: e.typ,
    einheit: e.standard_einheit,
    reihenfolge: e.reihenfolge,
    standardSichtbar: !!e.standard_sichtbar,
    filterbar: !!e.filterbar,
    mehrfach: !!e.mehrfach,
    optionen: e.optionen.map(o => ({ id: o.id, de: o.de, en: o.en }))
  }));
}

function mapWert(e, w) {
  const base = {
    einheit: w.einheit ?? null,
    vermerk: w.vermerk_de ? { de: w.vermerk_de, en: w.vermerk_en || null } : null
  };
  switch (e.typ) {
    case 'zahl': return { ...base, wert: w.zahl };
    case 'ja_nein': return { ...base, wert: w.ja_nein === null ? null : !!w.ja_nein };
    case 'auswahl': {
      // Mehrfachauswahl: wert ist eine Liste, sonst ein einzelner Eintrag. optionIds enthält immer eine Liste.
      const gewaehlt = w.option_ids.map(id => e.optionen.find(x => x.id === id)).filter(Boolean)
        .map(o => ({ id: o.id, de: o.de, en: o.en || null }));
      const frei = (o) => ({ de: o.de, en: o.en });
      if (e.mehrfach) return { ...base, optionIds: gewaehlt.map(o => o.id), wert: gewaehlt.length ? gewaehlt.map(frei) : null };
      return { ...base, optionId: gewaehlt[0]?.id ?? null, optionIds: gewaehlt.map(o => o.id), wert: gewaehlt[0] ? frei(gewaehlt[0]) : null };
    }
    default: return { ...base, wert: w.text };
  }
}

/** Materialien mit allen Werten und Links, sortiert nach Kategorie, Name und ID. Standardmäßig nur veröffentlichte. */
export function listMaterialien(s, { alle = false } = {}) {
  const status = linkStatus(s);
  return s.materialien
    .filter(m => alle || m.status === 'veroeffentlicht')
    .map(m => {
      const k = s.kategorie(m.kategorie_id);
      const werte = {};
      for (const e of s.eigenschaften) if (m.werte[e.kurzwort]) werte[e.kurzwort] = mapWert(e, m.werte[e.kurzwort]);
      return {
        id: m.id,
        name: { de: m.name_de, en: m.name_en || null },
        hersteller: m.hersteller || null,
        kategorie: { id: k.id, slug: k.slug, icon: k.icon || null, name: { de: k.name_de, en: k.name_en || null } },
        notiz: { de: m.notiz_de || null, en: m.notiz_en || null },
        status: m.status,
        werte,
        links: m.links.map(l => ({ beschriftung: l.beschriftung, url: l.url, status: status[l.url]?.status ?? null })),
        _sortierung: [k.reihenfolge, m.name_de]
      };
    })
    .sort((a, b) => a._sortierung[0] - b._sortierung[0] || vergleiche(a._sortierung[1], b._sortierung[1]) || a.id - b.id)
    .map(({ _sortierung, ...m }) => m);
}

const vergleiche = (a, b) => (a < b ? -1 : a > b ? 1 : 0); // wie bisher: Reihenfolge nach Zeichencode

export function getMaterial(s, id, { alle = false } = {}) {
  return listMaterialien(s, { alle: true }).find(m => m.id === Number(id) && (alle || m.status === 'veroeffentlicht')) || null;
}
