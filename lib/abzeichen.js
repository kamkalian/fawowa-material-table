// Abzeichen, die der Betreiber Unterstützern von Hand zuordnet; eine Person kann mehrere haben. Jedes steht für eine Art der Hilfe.
// Die Zeichnungen stehen in src/shared/Icon.svelte (Name "badge-<id>"). Neue Abzeichen: hier eintragen und dort zeichnen.

export const ABZEICHEN = [
  { id: 'starthelfer', de: 'Starthelfer', en: 'Early backer',
    text_de: 'Hat das Projekt von Anfang an unterstützt', text_en: 'Supported the project from the start' },
  { id: 'kaffee', de: 'Kaffee spendiert', en: 'Bought a coffee',
    text_de: 'Hat einen Beitrag zu den Betriebskosten geleistet', text_en: 'Contributed to the running costs' },
  { id: 'wiederkehrend', de: 'Wiederkehrend', en: 'Returning supporter',
    text_de: 'Unterstützt das Projekt regelmäßig', text_en: 'Supports the project regularly' },
  { id: 'grosszuegig', de: 'Besonders großzügig', en: 'Extra generous',
    text_de: 'Hat das Projekt mit einem besonders hohen Betrag unterstützt', text_en: 'Supported the project with a particularly high amount' },
  { id: 'ideengeber', de: 'Ideengeber', en: 'Idea giver',
    text_de: 'Hilft mit Ideen und Vorschlägen', text_en: 'Helps with ideas and suggestions' },
  { id: 'datenpfleger', de: 'Datenpfleger', en: 'Data keeper',
    text_de: 'Hilft, die Materialdaten richtig und aktuell zu halten', text_en: 'Helps keep the material data correct and up to date' },
  { id: 'botschafter', de: 'Botschafter', en: 'Ambassador',
    text_de: 'Erzählt anderen von dem Projekt', text_en: 'Tells others about the project' }
];

export const ABZEICHEN_IDS = ABZEICHEN.map(a => a.id);

/** Bereinigt eine Liste von Abzeichen-IDs: nur bekannte, ohne Doppelte, in der Reihenfolge der Auswahl. Ein einzelner Text zählt als Liste mit einem Eintrag. */
export function normalisiereAbzeichen(wert) {
  const liste = Array.isArray(wert) ? wert : wert ? [wert] : [];
  return ABZEICHEN_IDS.filter(id => liste.includes(id));
}
