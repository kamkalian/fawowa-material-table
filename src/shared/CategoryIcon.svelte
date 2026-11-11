<script>
  // Zeigt das Icon einer Kategorie. Alle Icons sind selbst gezeichnet: einfarbige Linien in der Akzentfarbe,
  // Zeichenfläche 24 × 24. Unbekannte oder fehlende Namen ergeben einen neutralen Kreis.
  // Schlüssel = Namen aus lib/icons.js
  const ICONS = {
    // Zwei Bäume: links ein Laubbaum mit wolkiger Krone, rechts eine Tanne
    'trees': `
      <path d="M3.2 9.5a3.3 3.3 0 0 1 6.6 0 3.2 3.2 0 0 1-.9 6.3H5.1a3.2 3.2 0 0 1-1.9-6.3z"/>
      <path d="M6.5 15.8V22"/>
      <path d="M16.5 2.5L13 8.5h2L12 13.5h2L11 18.5h11L19 13.5h2L18 8.5h2z"/>
      <path d="M16.5 18.5V22"/>`,
    // Holzstapel: drei Stämme mit Jahresringen von der Stirnseite
    'wood-logs': `
      <circle cx="7.5" cy="16" r="4.5"/><circle cx="16.5" cy="16" r="4.5"/><circle cx="12" cy="8" r="4.5"/>
      <circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/><circle cx="12" cy="8" r="1.5"/>`,
    // Baumscheibe mit Jahresringen und Riss
    'tree-rings': `
      <circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.5"/><path d="M14.5 12h7"/>`,
    // Stahlträger (I-Profil)
    'metal-beam': `<path d="M4 4h16v3.5h-6.25v9H20V20H4v-3.5h6.25v-9H4z"/>`,
    // Sechskantmutter
    'metal-nut': `<path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z"/><circle cx="12" cy="12" r="3.5"/>`,
    // Kunststoffflasche mit Deckel und Etikett
    'plastic-bottle': `
      <path d="M9.5 2.5h5V5h-5z"/>
      <path d="M10 5v1.8c0 1.6-2.5 2-2.5 4.2v8.5a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2V11c0-2.2-2.5-2.6-2.5-4.2V5"/>
      <path d="M7.5 13h9"/><path d="M7.5 17h9"/>`,
    // Schaum als Blasen
    'foam-bubbles': `
      <circle cx="8" cy="8.5" r="4"/><circle cx="17" cy="7.5" r="2.5"/><circle cx="16" cy="16" r="4.5"/><circle cx="6.5" cy="18" r="2"/>`,
    // Verbundplatte: Platte mit sichtbaren Schichten an der Kante
    'sandwich-panel': `
      <path d="M12 3l9 4-9 4-9-4z"/><path d="M3 7v9l9 4 9-4V7"/><path d="M12 11v9"/>
      <path d="M3 10l9 4 9-4" stroke-width="1.5"/><path d="M3 13l9 4 9-4" stroke-width="1.5"/>`,
    // T-Shirt mit kurzen Ärmeln, rundem Halsausschnitt und abgerundeten Ecken
    'shirt': `
      <path d="M8 2.5L3.7 4A2 2 0 0 0 2.4 6.2l.6 3.4a1 1 0 0 0 1 .8h2.2v9.6c0 1.1.9 2 2 2h7.6c1.1 0 2-.9 2-2v-9.6H20a1 1 0 0 0 1-.8l.6-3.4A2 2 0 0 0 20.3 4L16 2.5a4 4 0 0 1-8 0z"/>`,
    // Lineal, schräg, mit Teilstrichen
    'ruler': `
      <g transform="rotate(-45 12 12)">
        <rect x="1.5" y="8" width="21" height="8" rx="1.5"/>
        <path d="M5.5 8v3M9.5 8v4.5M13.5 8v3M17.5 8v4.5"/>
      </g>`,
    // Neutral
    'circle': `<circle cx="12" cy="12" r="8"/>`
  };

  let { name = null, size = 16, title = '' } = $props();
  let zeichnung = $derived(ICONS[name] ?? ICONS.circle);
</script>

<span class="cat-icon" role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : 'true'} {title}>
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html zeichnung}</svg>
</span>

<style>
  .cat-icon { display: inline-flex; align-items: center; vertical-align: middle; flex-shrink: 0; color: var(--primary); }
</style>
