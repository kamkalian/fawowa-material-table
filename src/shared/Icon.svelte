<script>
  // Alle Icons der Anwendung sind selbst gezeichnet und folgen einem gemeinsamen Linienstil.
  //
  // Stilregeln ("Feinstrich"):
  //  1. Zeichenfläche 24 × 24, Inhalt mit mindestens 2 Einheiten Rand (Bereich 2 bis 22).
  //  2. Nur Linien, keine Füllungen: Strichstärke 1,5, runde Enden und Ecken, Farbe = currentColor.
  //  3. Form aus einfachen Grundelementen: Kreise, gerade Linien, Bögen; Winkel möglichst 45° oder 90°.
  //  4. Parallele Linien haben mindestens 3 Einheiten Abstand, damit sie auch bei 16 px getrennt bleiben.
  //  5. Innenlinien (Details) haben dieselbe Stärke wie die Außenlinie, höchstens eine Detailebene.
  //  6. Aufstehende Dinge (Bäume, Flasche) stehen auf einer Grundlinie bei y = 21.
  //
  // Kategorie-Icons stehen in lib/icons.js (ICON_NAMEN); die Bedienelemente haben eigene Namen (ui-…).
  const ICONS = {
    // --- Kategorien ---
    // Zwei Bäume auf einer Grundlinie: links Laubbaum mit runder Krone, rechts Tanne aus zwei Stufen
    'trees': `
      <circle cx="7" cy="9" r="4.5"/><path d="M7 13.5V21"/>
      <path d="M17 3l-3.5 6h7z"/><path d="M17 10.5l-4.5 6h9z"/><path d="M17 16.5V21"/>
      <path d="M3 21h18"/>`,
    // Holzstapel: drei Stämme mit Jahresringen von der Stirnseite
    'wood-logs': `
      <circle cx="7.5" cy="16" r="4.5"/><circle cx="16.5" cy="16" r="4.5"/><circle cx="12" cy="8" r="4.5"/>
      <circle cx="7.5" cy="16" r="1.25"/><circle cx="16.5" cy="16" r="1.25"/><circle cx="12" cy="8" r="1.25"/>`,
    // Baumscheibe mit Jahresringen und Riss
    'tree-rings': `
      <circle cx="12" cy="12" r="9.25"/><circle cx="12" cy="12" r="5.75"/><circle cx="12" cy="12" r="2.25"/><path d="M14.5 12h6.75"/>`,
    // Stahlträger (I-Profil)
    'metal-beam': `<path d="M4 4h16v3.5h-6.25v9H20V20H4v-3.5h6.25v-9H4z"/>`,
    // Sechskantmutter
    'metal-nut': `<path d="M12 2.75l8 4.5v9.5l-8 4.5-8-4.5v-9.5z"/><circle cx="12" cy="12" r="3.5"/>`,
    // Kunststoffflasche mit Deckel und Etikett
    'plastic-bottle': `
      <path d="M9.5 2.75h5V5.5h-5z"/>
      <path d="M10 5.5v1.5c0 1.6-2.5 2-2.5 4.2v8.3a1.75 1.75 0 0 0 1.75 1.75h5.5a1.75 1.75 0 0 0 1.75-1.75v-8.3c0-2.2-2.5-2.6-2.5-4.2V5.5"/>
      <path d="M7.5 13h9"/><path d="M7.5 17h9"/>`,
    // Schaum als Blasen
    'foam-bubbles': `
      <circle cx="8" cy="8.5" r="4.25"/><circle cx="17" cy="7.5" r="2.5"/><circle cx="16" cy="16" r="4.5"/><circle cx="6.5" cy="18" r="2"/>`,
    // Verbundplatte: Platte mit sichtbaren Schichten an der Kante
    'sandwich-panel': `
      <path d="M12 3l9 4-9 4-9-4z"/><path d="M3 7v9l9 4 9-4V7"/><path d="M12 11v9"/>
      <path d="M3 10.5l9 4 9-4"/>`,
    // T-Shirt mit schrägen Ärmeln und rundem Ausschnitt
    'shirt': `
      <path d="M8.5 3.5L3 6.5l2 4 2.5-1.2v11.2h9V9.3l2.5 1.2 2-4-5.5-3c-.8 1.6-2 2.5-3.5 2.5S9.3 5.1 8.5 3.5z"/>`,
    // Lineal, schräg, mit Teilstrichen
    'ruler': `
      <g transform="rotate(-45 12 12)">
        <rect x="1.75" y="8" width="20.5" height="8" rx="1.5"/>
        <path d="M5.5 8v3M9.5 8v4.5M13.5 8v3M17.5 8v4.5"/>
      </g>`,
    // Neutral
    'circle': `<circle cx="12" cy="12" r="8"/>`,

    // --- Bedienelemente ---
    'ui-plus': `<path d="M12 5v14M5 12h14"/>`,
    'ui-search': `<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>`,
    'ui-moon': `<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>`,
    'ui-flag': `<path d="M6 21V3.5"/><path d="M6 5h11l-2.5 4 2.5 4H6"/>`,
    'ui-cup': `<path d="M4.5 9.5h11v5a4.5 4.5 0 0 1-4.5 4.5h-2a4.5 4.5 0 0 1-4.5-4.5z"/><path d="M15.5 11h1.25a2.75 2.75 0 0 1 0 5.5H15"/><path d="M8 3.5v2.5M12 3.5v2.5"/>`,
    'ui-medal': `<circle cx="12" cy="9" r="5"/><path d="M9 13.5 7.5 20.5 12 18l4.5 2.5-1.5-7"/>`,
    'ui-chevron': `<path d="M9 5l7 7-7 7"/>`
  };

  let { name = 'circle', size = 16 } = $props();
  let zeichnung = $derived(ICONS[name] ?? ICONS.circle);
</script>

<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{@html zeichnung}</svg>
