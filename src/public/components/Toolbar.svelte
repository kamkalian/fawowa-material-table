<script>
  import Icon from '../../shared/Icon.svelte';
  import { t, pick } from '../lib/i18n.js';

  // props: Eigenschaften, sichtbare Spalten, Zustand, Callbacks
  let { lang, q, props, visibleKeys, gruppiert, onsearch, onaddfilter, oncolumns, ongruppen, onsuggest } = $props();

  let columnsOpen = $state(false);

  function toggleColumn(kw) {
    const set = new Set(visibleKeys);
    set.has(kw) ? set.delete(kw) : set.add(kw);
    // Reihenfolge wie in der Eigenschaften-Liste
    oncolumns(props.filter(p => set.has(p.kurzwort)).map(p => p.kurzwort));
  }
</script>

<div class="toolbar">
  <div class="search-toolbar toolbar-search">
    <span class="search-icon"><Icon name="ui-search" size={16} /></span>
    <input
      type="search"
      class="input search-input"
      placeholder={t(lang, 'search')}
      aria-label={t(lang, 'search')}
      value={q}
      oninput={(e) => onsearch(e.currentTarget.value)}
    />
  </div>

  <button class="btn btn-outline" onclick={onaddfilter}>
    <Icon name="ui-plus" size={14} />
    {t(lang, 'addFilter')}
  </button>

  <div class="dropdown">
    <button class="btn btn-outline" aria-expanded={columnsOpen} onclick={() => (columnsOpen = !columnsOpen)}>
      {t(lang, 'columns')}
    </button>
    {#if columnsOpen}
      <div class="dropdown-menu" role="menu">
        {#each props as p (p.kurzwort)}
          <label class="dropdown-item">
            <input type="checkbox" checked={visibleKeys.includes(p.kurzwort)} onchange={() => toggleColumn(p.kurzwort)} />
            {pick(p.name, lang)}
          </label>
        {/each}
        <button class="btn btn-ghost btn-sm dropdown-reset" onclick={() => oncolumns(null)}>
          {t(lang, 'columnsDefault')}
        </button>
      </div>
    {/if}
  </div>

  <button class="btn btn-outline" class:an={gruppiert} aria-pressed={gruppiert} title={t(lang, 'groupToggleTitle')} onclick={ongruppen}>
    {t(lang, 'groupToggle')}
  </button>

  <button class="btn btn-outline" onclick={onsuggest}>
    <Icon name="ui-plus" size={14} />
    {t(lang, 'suggest')}
  </button>

</div>

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .75rem; }
  .toolbar-search { flex: 1 1 260px; margin-bottom: 0; }
  .btn.an { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); }
  .dropdown { position: relative; }
  .dropdown-menu {
    position: absolute; right: 0; top: calc(100% + 4px); z-index: 30;
    background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
    padding: .5rem; min-width: 220px; max-height: 60vh; overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, .3);
  }
  .dropdown-item { display: flex; gap: .5rem; align-items: center; padding: .3rem .4rem; font-size: .8125rem; cursor: pointer; border-radius: var(--radius-sm); }
  .dropdown-item:hover { background: var(--bg-hover); }
  .dropdown-reset { margin-top: .25rem; width: 100%; justify-content: center; }
</style>
