<script>
  // Zeigt das Icon einer Kategorie. Unbekannte oder fehlende Namen ergeben einen Kreis.
  //
  // Nur einfarbige Symbole in der Akzentfarbe:
  //  - Linien-Icons für typische Materialien (eigene Zeichnungen)
  //  - allgemeine Symbole aus Lucide
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

  // --- Linien-Icons (Zeichenfläche 24 × 24, einfarbig in der Akzentfarbe) ---
  const LINIEN = {
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
      <path d="M3 10l9 4 9-4" stroke-width="1.5"/><path d="M3 13l9 4 9-4" stroke-width="1.5"/>`
  };

  let { name = null, size = 16, title = '' } = $props();
  let Symbol = $derived(SYMBOLE[name] ?? Circle);
  let linie = $derived(LINIEN[name] ?? null);
</script>

<span class="cat-icon" role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : 'true'} {title}>
  {#if linie}
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html linie}</svg>
  {:else}
    <Symbol {size} strokeWidth={2} />
  {/if}
</span>

<style>
  .cat-icon { display: inline-flex; align-items: center; vertical-align: middle; flex-shrink: 0; color: var(--primary); }
</style>
