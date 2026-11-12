<script>
  import { t, pick } from '../lib/i18n.js';
  import CategoryIcon from '../../shared/CategoryIcon.svelte';

  // kategorien: [{ slug, icon, name, anzahl }], aktiv: gewählte Kurznamen
  let { lang, kategorien, aktiv, ontoggle, onclear } = $props();
</script>

<div class="kategorien" role="group" aria-label={t(lang, 'categories')}>
  <button type="button" class="kat kat-alle" class:aktiv={aktiv.length === 0} aria-pressed={aktiv.length === 0} onclick={onclear}>
    {t(lang, 'allCategories')}
  </button>
  {#each kategorien as k (k.slug)}
    <button type="button" class="kat" class:aktiv={aktiv.includes(k.slug)} aria-pressed={aktiv.includes(k.slug)} onclick={() => ontoggle(k.slug)}>
      <CategoryIcon name={k.icon} size={30} />
      <span class="name">{pick(k.name, lang)}</span>
      <span class="anzahl">{k.anzahl}</span>
    </button>
  {/each}
</div>

<style>
  .kategorien { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: 1rem; }
  .kat {
    display: inline-flex; align-items: center; gap: .5rem;
    padding: .4rem .85rem .4rem .6rem; background: var(--bg-card); color: var(--fg);
    border: 1px solid var(--border); border-radius: var(--radius); font: inherit; font-size: .8125rem;
    cursor: pointer; transition: border-color .15s, background .15s;
  }
  .kat-alle { padding-left: .85rem; }
  .kat:hover { border-color: var(--primary); }
  .kat:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  .kat.aktiv { border-color: var(--primary); background: var(--primary-bg); }
  .name { font-weight: 500; }
  .anzahl { color: var(--fg-muted); font-size: .75rem; }
  .kat.aktiv .anzahl { color: var(--primary); }
  /* Auf dem Handy eine Zeile zum Wischen statt vieler Zeilen */
  @media (max-width: 640px) {
    .kategorien { flex-wrap: nowrap; overflow-x: auto; padding-bottom: .375rem; scrollbar-width: thin; }
    .kat { flex-shrink: 0; white-space: nowrap; }
  }
</style>
