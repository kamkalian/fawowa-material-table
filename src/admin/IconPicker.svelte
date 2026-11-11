<script>
  import { LINIEN_ICONS, MATERIAL_ICONS, SYMBOL_ICONS } from '../../lib/icons.js';
  import CategoryIcon from '../shared/CategoryIcon.svelte';

  let { value, onchange } = $props();

  // [Titel, Namen, Größe]; die farbigen Icons sind größer dargestellt
  const GRUPPEN = [
    ['Material-Icons (Linien)', LINIEN_ICONS, 28],
    ['Material-Icons (farbig)', MATERIAL_ICONS, 34],
    ['Symbole', SYMBOL_ICONS, 22]
  ];
</script>

<div class="gruppen" role="radiogroup" aria-label="Icon">
  {#each GRUPPEN as [titel, namen, groesse] (titel)}
    <div class="gruppe">
      <span class="gruppen-titel">{titel}</span>
      <div class="raster" class:gross={groesse > 22}>
        {#each namen as name (name)}
          <button
            type="button"
            class="icon-btn"
            class:aktiv={value === name}
            role="radio"
            aria-checked={value === name}
            title={name}
            aria-label={name}
            onclick={() => onchange(name)}
          >
            <CategoryIcon {name} size={groesse} />
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .gruppen { display: flex; flex-direction: column; gap: 1rem; }
  .gruppe { display: flex; flex-direction: column; gap: .4rem; }
  .gruppen-titel { font-size: .75rem; color: var(--fg-muted); }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr)); gap: .375rem; }
  .raster.gross { grid-template-columns: repeat(auto-fill, minmax(3.75rem, 1fr)); }
  .icon-btn {
    display: flex; align-items: center; justify-content: center; height: 2.5rem;
    background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
    cursor: pointer; color: var(--fg-muted);
  }
  .raster.gross .icon-btn { height: 3.75rem; }
  .icon-btn:hover { border-color: var(--primary); }
  .icon-btn.aktiv { border-color: var(--primary); background: var(--primary-bg); }
</style>
