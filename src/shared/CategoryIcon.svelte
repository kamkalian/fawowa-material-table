<script>
  // Zeigt das Icon einer Kategorie. Unbekannte oder fehlende Namen ergeben einen Kreis.
  //
  // Zwei Arten von Icons:
  //  - "mat-…": farbige Material-Icons mit der typischen Farbe und Struktur des Materials (eigene Zeichnungen)
  //  - übrige Namen: einfarbige Symbole aus Lucide
  // Schlüssel = Namen aus lib/icons.js
  import TreePine from '@lucide/svelte/icons/tree-pine';
  import Trees from '@lucide/svelte/icons/trees';
  import Leaf from '@lucide/svelte/icons/leaf';
  import Sprout from '@lucide/svelte/icons/sprout';
  import Layers from '@lucide/svelte/icons/layers';
  import Layers2 from '@lucide/svelte/icons/layers-2';
  import PanelsTopLeft from '@lucide/svelte/icons/panels-top-left';
  import LayoutPanelTop from '@lucide/svelte/icons/layout-panel-top';
  import BrickWall from '@lucide/svelte/icons/brick-wall';
  import Wrench from '@lucide/svelte/icons/wrench';
  import Hammer from '@lucide/svelte/icons/hammer';
  import Anvil from '@lucide/svelte/icons/anvil';
  import Cog from '@lucide/svelte/icons/cog';
  import Axe from '@lucide/svelte/icons/axe';
  import Snowflake from '@lucide/svelte/icons/snowflake';
  import Shield from '@lucide/svelte/icons/shield';
  import Flame from '@lucide/svelte/icons/flame';
  import Droplets from '@lucide/svelte/icons/droplets';
  import Wind from '@lucide/svelte/icons/wind';
  import Sun from '@lucide/svelte/icons/sun';
  import Zap from '@lucide/svelte/icons/zap';
  import Box from '@lucide/svelte/icons/box';
  import Package from '@lucide/svelte/icons/package';
  import Cuboid from '@lucide/svelte/icons/cuboid';
  import Hexagon from '@lucide/svelte/icons/hexagon';
  import Triangle from '@lucide/svelte/icons/triangle';
  import Circle from '@lucide/svelte/icons/circle';
  import Grid3x3 from '@lucide/svelte/icons/grid-3x3';
  import Shirt from '@lucide/svelte/icons/shirt';
  import Scissors from '@lucide/svelte/icons/scissors';
  import Ruler from '@lucide/svelte/icons/ruler';
  import Feather from '@lucide/svelte/icons/feather';
  import Gem from '@lucide/svelte/icons/gem';
  import Mountain from '@lucide/svelte/icons/mountain';
  import Paintbrush from '@lucide/svelte/icons/paintbrush';
  import Puzzle from '@lucide/svelte/icons/puzzle';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  const SYMBOLE = {
    'tree-pine': TreePine, 'trees': Trees, 'leaf': Leaf, 'sprout': Sprout,
    'layers': Layers, 'layers-2': Layers2, 'panels-top-left': PanelsTopLeft,
    'layout-panel-top': LayoutPanelTop, 'brick-wall': BrickWall,
    'wrench': Wrench, 'hammer': Hammer, 'anvil': Anvil, 'cog': Cog, 'axe': Axe,
    'snowflake': Snowflake, 'shield': Shield, 'flame': Flame, 'droplets': Droplets,
    'wind': Wind, 'sun': Sun, 'zap': Zap,
    'box': Box, 'package': Package, 'cuboid': Cuboid, 'hexagon': Hexagon,
    'triangle': Triangle, 'circle': Circle, 'grid-3x3': Grid3x3,
    'shirt': Shirt, 'scissors': Scissors, 'ruler': Ruler, 'feather': Feather,
    'gem': Gem, 'mountain': Mountain, 'paintbrush': Paintbrush, 'puzzle': Puzzle,
    'sparkles': Sparkles
  };

  // --- Farbige Material-Icons (Zeichenfläche 32 × 32) ---
  // Ein dezenter dunkler Rand sorgt dafür, dass die Icons auf hellem und dunklem Hintergrund erkennbar bleiben.
  const RAND = 'stroke="#0f172a" stroke-opacity=".45" stroke-width="1" stroke-linejoin="round"';

  // Platte in Schrägansicht aus Schichten: [[Dicke, Farbe links, Farbe rechts], …]; Deckfläche oben.
  function platte(deckfarbe, schichten) {
    const gesamt = schichten.reduce((s, [d]) => s + d, 0);
    let y = 0;
    let links = '';
    let rechts = '';
    for (const [dicke, farbeL, farbeR] of schichten) {
      const y1 = y + dicke;
      links += `<path d="M4 ${10 + y}l12 6v${dicke}l-12-6z" fill="${farbeL}"/>`;
      rechts += `<path d="M16 ${16 + y}l12-6v${dicke}l-12 6z" fill="${farbeR}"/>`;
      y = y1;
    }
    return `${links}${rechts}
      <path d="M4 10v${gesamt}l12 6 12-6V10M16 16v${gesamt}" fill="none" ${RAND}/>
      <path d="M16 4l12 6-12 6-12-6z" fill="${deckfarbe}" ${RAND}/>`;
  }

  // Ein Metallbarren: x = linke Kante, y = Unterkante der Vorderseite
  function barren(x, y) {
    return `<path d="M${x} ${y}l1.4-4.5h9.2L${x + 12} ${y}z" fill="#9fb0c5" ${RAND}/>
      <path d="M${x + 1.4} ${y - 4.5}l1.4-2.5h6.4l1.4 2.5z" fill="#dfe7f0" ${RAND}/>
      <path d="M${x + 3.2} ${y - 2.8}h5.6" stroke="#f6f9fc" stroke-width="1.1" stroke-linecap="round" opacity=".9"/>`;
  }

  const FARBIG = {
    // Holz: liegender Stamm mit Rinde und Jahresringen an der Schnittfläche
    'mat-holz': `
      <path d="M22 7H10a5.5 9 0 0 0 0 18h12z" fill="#8b5a2b" ${RAND}/>
      <path d="M9 11.5h12M7 16h14M9 20.5h12" stroke="#5e3b1a" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/>
      <ellipse cx="22" cy="16" rx="5.5" ry="9" fill="#ecc489" ${RAND}/>
      <ellipse cx="22" cy="16" rx="3.9" ry="6.4" fill="none" stroke="#b9803c" stroke-width="1"/>
      <ellipse cx="22" cy="16" rx="2.2" ry="3.7" fill="none" stroke="#b9803c" stroke-width="1"/>
      <ellipse cx="22" cy="16" rx=".9" ry="1.3" fill="#8a5a28"/>`,

    // Sperrholz: Platte, an der Kante sieht man die gekreuzten Furnierlagen
    'mat-sperrholz': platte('#f6e2b8', [
      [1.6, '#e0be84', '#f0d6a3'], [1.6, '#9c6a2e', '#b9803c'], [1.6, '#e0be84', '#f0d6a3'],
      [1.6, '#9c6a2e', '#b9803c'], [1.6, '#e0be84', '#f0d6a3']
    ]) + '<path d="M8 12L18 7M12 14.5L24 8.5" stroke="#c99a55" stroke-width="1" fill="none"/>',

    // Metall: Stapel aus drei glänzenden Barren
    'mat-metall': barren(3, 24) + barren(17, 24) + barren(10, 17),

    // Schaum und Dämmung: gelber Block mit Poren
    'mat-schaum': `
      <rect x="3.5" y="8" width="25" height="16" rx="4.5" fill="#fde68a" ${RAND}/>
      <g fill="#f2bd3a">
        <circle cx="9" cy="13" r="2.1"/><circle cx="15.5" cy="11.8" r="1.5"/><circle cx="21.5" cy="14" r="2.6"/>
        <circle cx="12" cy="19.5" r="2.3"/><circle cx="19.5" cy="20" r="1.7"/><circle cx="25" cy="19" r="1.3"/>
        <circle cx="7" cy="19" r="1.3"/><circle cx="25" cy="12.5" r="1.1"/>
      </g>
      <g fill="#fffbeb"><circle cx="8.4" cy="12.4" r=".6"/><circle cx="20.8" cy="13.2" r=".8"/><circle cx="11.3" cy="18.8" r=".7"/></g>`,

    // Kunststoff: blaue, durchscheinende Flasche
    'mat-kunststoff': `
      <path d="M13.5 6v3.2C13.5 11.5 9.5 12.5 9.5 16V26a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3V16c0-3.5-4-4.5-4-6.8V6z" fill="#7dd3fc" ${RAND}/>
      <rect x="12.5" y="2.5" width="7" height="3.5" rx="1" fill="#0369a1" ${RAND}/>
      <rect x="9.5" y="17.5" width="13" height="6.5" fill="#e0f2fe"/>
      <path d="M12 19.5h8M12 21.5h5" stroke="#0284c7" stroke-width="1" stroke-linecap="round"/>
      <path d="M11.8 13v3" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>`,

    // Verbundplatte: graue Deckschichten mit gelbem Kern
    'mat-verbund': platte('#a3b1c4', [
      [1.8, '#475569', '#64748b'], [4.4, '#d99a0f', '#fbbf24'], [1.8, '#475569', '#64748b']
    ]),

    // Textil: kariertes Gewebe mit Saumnaht
    'mat-textil': `
      <rect x="4" y="6" width="24" height="20" rx="2.5" fill="#a78bfa" ${RAND}/>
      <path d="M9 7v18M14 7v18M19 7v18M24 7v18" stroke="#c4b5fd" stroke-width="1.6" opacity=".9"/>
      <path d="M5 11.5h22M5 16h22M5 20.5h22" stroke="#6d28d9" stroke-width="1.3" opacity=".55"/>
      <rect x="6.5" y="8.5" width="19" height="15" rx="1.2" fill="none" stroke="#f5f3ff" stroke-width="1" stroke-dasharray="2 1.8"/>`,

    // Stäbe und Leisten: zwei Bambusrohre mit Knoten
    'mat-staebe': `
      <g transform="translate(11 16) rotate(35)">
        <rect x="-2.2" y="-12" width="4.4" height="24" rx="2.2" fill="#a3e635" ${RAND}/>
        <path d="M-2.2 -4h4.4M-2.2 4.5h4.4" stroke="#4d7c0f" stroke-width="1.3"/>
      </g>
      <g transform="translate(21 16) rotate(35)">
        <rect x="-2.2" y="-12" width="4.4" height="24" rx="2.2" fill="#bef264" ${RAND}/>
        <path d="M-2.2 -6.5h4.4M-2.2 2h4.4" stroke="#4d7c0f" stroke-width="1.3"/>
      </g>`
  };

  let { name = null, size = 16, title = '' } = $props();
  let Symbol = $derived(SYMBOLE[name] ?? Circle);
  let farbig = $derived(FARBIG[name] ?? null);
</script>

<span class="cat-icon" class:farbig={!!farbig} role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : 'true'} {title}>
  {#if farbig}
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">{@html farbig}</svg>
  {:else}
    <Symbol {size} strokeWidth={2} />
  {/if}
</span>

<style>
  .cat-icon { display: inline-flex; align-items: center; vertical-align: middle; flex-shrink: 0; color: var(--primary); }
</style>
