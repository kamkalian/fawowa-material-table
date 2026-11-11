<script>
  import { t, pick } from '../lib/i18n.js';

  // props: Eigenschaften, sichtbare Spalten, Zustand, Callbacks
  let { lang, q, props, visibleKeys, onsearch, onaddfilter, oncolumns, onlang, ontheme } = $props();

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
    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
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

  <div class="toolbar-right">
    <div class="lang-switch" role="group" aria-label={t(lang, 'langSwitch')}>
      <button class="btn btn-sm {lang === 'de' ? 'btn-primary' : 'btn-ghost'}" aria-pressed={lang === 'de'} onclick={() => onlang('de')}>DE</button>
      <button class="btn btn-sm {lang === 'en' ? 'btn-primary' : 'btn-ghost'}" aria-pressed={lang === 'en'} onclick={() => onlang('en')}>EN</button>
    </div>
    <button class="btn btn-ghost btn-icon" title={t(lang, 'themeToggle')} aria-label={t(lang, 'themeToggle')} onclick={ontheme}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    </button>
  </div>
</div>

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin-bottom: .75rem; }
  .toolbar-search { flex: 1 1 260px; margin-bottom: 0; }
  .toolbar-right { display: flex; gap: .5rem; align-items: center; margin-left: auto; }
  .lang-switch { display: inline-flex; gap: .125rem; }
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
