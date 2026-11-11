<script>
  import { t } from '../lib/i18n.js';
  import { filterLabel } from '../lib/filter.js';

  // filters: Liste der aktiven Filter, propMap: kurzwort -> Eigenschaft
  let { lang, filters, propMap, hasSearch, onedit, onremove, onreset } = $props();
</script>

{#if filters.length || hasSearch}
  <div class="chips">
    {#each filters as f, i (i + f.kw + f.op)}
      <span class="chip">
        <button class="chip-label" title={t(lang, 'editFilter')} onclick={() => onedit(i)}>
          {filterLabel(f, propMap.get(f.kw), lang)}
        </button>
        <button class="chip-remove" aria-label={t(lang, 'chipRemove')} title={t(lang, 'chipRemove')} onclick={() => onremove(i)}>×</button>
      </span>
    {/each}
    {#if filters.length || hasSearch}
      <button class="btn btn-ghost btn-sm" onclick={onreset}>{t(lang, 'resetFilters')}</button>
    {/if}
  </div>
{/if}

<style>
  .chips { display: flex; flex-wrap: wrap; gap: .375rem; align-items: center; margin-bottom: .75rem; }
  .chip {
    display: inline-flex; align-items: center; gap: .125rem;
    border-radius: 999px; border: 1px solid var(--tag-border); background: var(--tag-bg);
    color: var(--primary); font-size: .75rem;
  }
  .chip-label {
    background: none; border: none; color: inherit; font: inherit;
    padding: .25rem .25rem .25rem .6rem; cursor: pointer;
  }
  .chip-remove {
    background: none; border: none; color: inherit; font: inherit; line-height: 1;
    padding: .25rem .5rem .25rem .25rem; cursor: pointer; opacity: .7;
  }
  .chip-remove:hover { opacity: 1; }
</style>
