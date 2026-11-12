// Gemeinsame Helfer der Textseiten (Datenschutz, Impressum): Sprache und Design merken

export function startSprache() {
  const aus = new URLSearchParams(location.search).get('lang');
  if (aus === 'de' || aus === 'en') return aus;
  try {
    const gespeichert = localStorage.getItem('lang');
    if (gespeichert === 'de' || gespeichert === 'en') return gespeichert;
  } catch { /* Speicher nicht verfügbar */ }
  return 'de';
}

export function speichereSprache(l) {
  history.replaceState(null, '', location.pathname + (l === 'en' ? '?lang=en' : ''));
  try { localStorage.setItem('lang', l); } catch { /* ignorieren */ }
}

export function wechsleDesign() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { /* ignorieren */ }
}
