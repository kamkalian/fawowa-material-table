<script>
  import { ICON_NAMEN } from '../../lib/icons.js';
  import CategoryIcon from '../shared/CategoryIcon.svelte';

  let { value, onchange } = $props();
</script>

<!-- Eine einzige Auswahl: zuerst die Symbole für typische Materialien, dann die allgemeinen Symbole -->
<div class="raster" role="radiogroup" aria-label="Icon">
  {#each ICON_NAMEN as name (name)}
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
      <CategoryIcon {name} size={24} />
    </button>
  {/each}
</div>

<style>
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(2.75rem, 1fr)); gap: .375rem; }
  .icon-btn {
    display: flex; align-items: center; justify-content: center; height: 2.75rem;
    background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-sm);
    cursor: pointer; color: var(--fg-muted);
  }
  .icon-btn:hover { border-color: var(--primary); }
  .icon-btn.aktiv { border-color: var(--primary); background: var(--primary-bg); }
</style>
