// Umwandlung der Texte aus Besucher-Meldungen in Eingaben für das Formular und die Admin-API.
// Besucher tippen Werte frei ein ("ja", "yes", "Holz"); der Admin bekommt sie passend zum Typ vorbelegt und kann sie korrigieren.

const JA = new Set(['ja', 'yes', 'true', '1', 'wahr', 'y']);
const NEIN = new Set(['nein', 'no', 'false', '0', 'falsch', 'n']);

/** 'ja' | 'nein' | '' */
export function jaNeinAusText(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (JA.has(t)) return 'ja';
  if (NEIN.has(t)) return 'nein';
  return '';
}

/** ID der passenden Option (deutsch oder englisch, ohne Beachtung der Groß-/Kleinschreibung) oder '' */
export function optionAusText(optionen, text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return '';
  const treffer = (optionen ?? []).find(o => [o.de, o.en].some(s => s && s.trim().toLowerCase() === t));
  return treffer ? treffer.id : '';
}

/** Entwurf eines Wertes (wie im Materialformular) aus dem Text eines Besuchers */
export function entwurfAusText(prop, text, einheit = '') {
  const leer = { text: '', option_id: '', ja_nein: '', einheit: '' };
  if (!prop) return leer;
  switch (prop.typ) {
    case 'zahl': return { ...leer, text: String(text ?? ''), einheit: einheit || prop.einheit || '' };
    case 'ja_nein': return { ...leer, ja_nein: jaNeinAusText(text) };
    case 'auswahl': return { ...leer, option_id: optionAusText(prop.optionen, text) };
    default: return { ...leer, text: String(text ?? '') };
  }
}

/** Daten für PUT /materialien/:id/werte/:kw bzw. POST /meldungen/:id/uebernehmen aus einem Entwurf */
export function wertDatenAusEntwurf(prop, entwurf, quelle = null) {
  const basis = { quelle: quelle || null };
  switch (prop.typ) {
    case 'zahl': return { ...basis, zahl: String(entwurf.text ?? '').trim(), einheit: String(entwurf.einheit ?? '').trim() || null };
    case 'ja_nein': return { ...basis, ja_nein: entwurf.ja_nein === '' ? null : entwurf.ja_nein === 'ja' };
    case 'auswahl': return { ...basis, option_id: entwurf.option_id === '' ? null : Number(entwurf.option_id) };
    default: return { ...basis, text: String(entwurf.text ?? '').trim() || null };
  }
}

/** Vorlage für das Materialformular aus einem Vorschlag. Das Material startet als Entwurf. */
export function vorlageAusVorschlag(meldung, eigenschaften) {
  const werte = {};
  for (const w of meldung.inhalt.werte) {
    const prop = eigenschaften.find(p => p.kurzwort === w.eigenschaft);
    if (prop) werte[w.eigenschaft] = entwurfAusText(prop, w.wert, w.einheit ?? '');
  }
  return {
    name_de: meldung.inhalt.name,
    hersteller: meldung.inhalt.hersteller ?? '',
    kategorie_id: meldung.inhalt.kategorie_id ?? undefined,
    status: 'entwurf',
    werte,
    links: meldung.quelle ? [{ beschriftung: 'Quelle', url: meldung.quelle }] : []
  };
}

/** Anzeige des aktuellen Wertes einer Fehlermeldung */
export function aktuellText(aktuell) {
  if (!aktuell) return '–';
  const wert = aktuell.zahl ?? aktuell.text ?? aktuell.option ?? (aktuell.ja_nein === null ? null : aktuell.ja_nein ? 'ja' : 'nein');
  if (wert === null || wert === undefined) return '–';
  return aktuell.einheit && aktuell.zahl !== null ? `${wert} ${aktuell.einheit}` : String(wert);
}
