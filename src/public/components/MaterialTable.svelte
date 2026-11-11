<script>
  import { t, pick } from '../lib/i18n.js';
  import {
    displayName, categoryName, formatValue, vermerkText, gruppenWert, gruppenHatVermerk
  } from '../lib/filter.js';
  import CategoryIcon from '../../shared/CategoryIcon.svelte';
  import Flag from '@lucide/svelte/icons/flag';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';

  // items: Zeilen der Tabelle, entweder einzelne Materialien oder Gruppen gleichnamiger Materialien
  //        [{ typ: 'einzel', material } | { typ: 'gruppe', key, mitglieder }]
  // offen: Schlüssel der aufgeklappten Gruppen; columns: sichtbare Eigenschaften; sort: {key, dir} oder null
  let { lang, items, offen, columns, sort, onsort, onopen, onreport, ontoggle } = $props();

  function sortIcon(key) {
    if (!sort || sort.key !== key) return '↕';
    return sort.dir === 'asc' ? '↑' : '↓';
  }

  function ariaSort(key) {
    if (!sort || sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }

  const schluessel = (it) => (it.typ === 'gruppe' ? it.key : it.material.id);
</script>

<!-- Zeile eines einzelnen Materials; eingerueckt = Mitglied einer aufgeklappten Gruppe -->
{#snippet materialZeile(m, eingerueckt)}
  <tr class="clickable" class:mitglied={eingerueckt} onclick={() => onopen(m.id)}>
    <td class="sticky">
      <button class="name-btn" onclick={(e) => { e.stopPropagation(); onopen(m.id); }}>{displayName(m, lang)}</button>
    </td>
    <td class="muted-cell">
      <span class="name-wrap">
        <CategoryIcon name={m.kategorie.icon} size={18} />
        {categoryName(m, lang)}
      </span>
    </td>
    {#each columns as p (p.kurzwort)}
      {@const w = m.werte[p.kurzwort]}
      {@const text = formatValue(p, w, lang)}
      <td>
        {#if text}
          {text}
          {#if vermerkText(w, lang)}
            <span class="badge badge-check" title={t(lang, 'unverifiedTitle')}>{t(lang, 'unverified')}</span>
          {/if}
        {:else}
          <span class="muted-cell">{t(lang, 'empty')}</span>
        {/if}
      </td>
    {/each}
    <td class="melden">
      <button class="melden-btn" title={t(lang, 'reportRow')} aria-label="{t(lang, 'reportRow')}: {displayName(m, lang)}"
        onclick={(e) => { e.stopPropagation(); onreport(m); }}>
        <Flag size={15} />
      </button>
    </td>
  </tr>
{/snippet}

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th class="sticky" aria-sort={ariaSort('name')}>
          <button class="th-btn" onclick={() => onsort('name')}>
            {t(lang, 'colName')} <span class="sort-icon" class:active={sort?.key === 'name'}>{sortIcon('name')}</span>
          </button>
        </th>
        <th aria-sort={ariaSort('kategorie')}>
          <button class="th-btn" onclick={() => onsort('kategorie')}>
            {t(lang, 'colCategory')} <span class="sort-icon" class:active={sort?.key === 'kategorie'}>{sortIcon('kategorie')}</span>
          </button>
        </th>
        {#each columns as p (p.kurzwort)}
          <th aria-sort={ariaSort(p.kurzwort)}>
            <button class="th-btn" onclick={() => onsort(p.kurzwort)}>
              {pick(p.name, lang)} <span class="sort-icon" class:active={sort?.key === p.kurzwort}>{sortIcon(p.kurzwort)}</span>
            </button>
          </th>
        {/each}
        <th class="melden"><span class="sr-only">{t(lang, 'reportRow')}</span></th>
      </tr>
    </thead>
    <tbody>
      {#if !items.length}
        <tr class="empty-row"><td colspan={columns.length + 3}>{t(lang, 'noResults')}</td></tr>
      {/if}

      {#each items as it (schluessel(it))}
        {#if it.typ === 'einzel'}
          {@render materialZeile(it.material, false)}
        {:else}
          {@const erstes = it.mitglieder[0]}
          {@const aufgeklappt = offen.includes(it.key)}
          <tr class="gruppe" class:aufgeklappt onclick={() => ontoggle(it.key)}>
            <td class="sticky">
              <button class="gruppen-btn" aria-expanded={aufgeklappt}
                aria-label="{aufgeklappt ? t(lang, 'groupCollapse') : t(lang, 'groupExpand')}: {displayName(erstes, lang)}"
                onclick={(e) => { e.stopPropagation(); ontoggle(it.key); }}>
                <span class="pfeil"><ChevronRight size={16} /></span>
                <span class="gruppen-name">{displayName(erstes, lang)}</span>
                <span class="anzahl" title={t(lang, 'groupVariants', it.mitglieder.length)}>{it.mitglieder.length}</span>
              </button>
            </td>
            <td class="muted-cell">
              <span class="name-wrap">
                <CategoryIcon name={erstes.kategorie.icon} size={18} />
                {categoryName(erstes, lang)}
              </span>
            </td>
            {#each columns as p (p.kurzwort)}
              {@const text = gruppenWert(p, it.mitglieder, lang)}
              <td>
                {#if text}
                  {text}
                  {#if gruppenHatVermerk(p, it.mitglieder)}
                    <span class="badge badge-check" title={t(lang, 'unverifiedTitle')}>{t(lang, 'unverified')}</span>
                  {/if}
                {:else}
                  <span class="muted-cell">{t(lang, 'empty')}</span>
                {/if}
              </td>
            {/each}
            <td class="melden"></td>
          </tr>

          {#if aufgeklappt}
            {#each it.mitglieder as m (m.id)}
              {@render materialZeile(m, true)}
            {/each}
          {/if}
        {/if}
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-wrap { overflow-x: auto; }
  table { min-width: 100%; }
  th { white-space: nowrap; }
  .th-btn {
    background: none; border: none; color: inherit; font: inherit; cursor: pointer; padding: 0;
    text-transform: inherit; letter-spacing: inherit;
  }
  .th-btn:hover { color: var(--fg); }
  .melden { width: 1%; text-align: right; }
  .melden-btn {
    background: none; border: none; color: var(--fg-muted); cursor: pointer; padding: .25rem;
    border-radius: var(--radius-sm); display: inline-flex; opacity: .6;
  }
  tr:hover .melden-btn, .melden-btn:focus-visible { opacity: 1; }
  .melden-btn:hover { color: var(--amber); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .sort-icon { font-size: .625rem; opacity: .5; margin-left: .2rem; }
  .sort-icon.active { color: var(--primary); opacity: 1; }
  td { white-space: nowrap; }
  .muted-cell { color: var(--fg-muted); }
  .name-wrap { display: inline-flex; align-items: center; gap: .5rem; }
  .muted-cell :global(.cat-icon) { color: var(--fg-muted); }
  tr.clickable { cursor: pointer; }
  .name-btn { background: none; border: none; color: var(--fg); font: inherit; cursor: pointer; padding: 0; text-align: left; }
  .name-btn:hover { color: var(--primary); text-decoration: underline; }
  .sticky { position: sticky; left: 0; background: var(--bg-card); z-index: 1; }
  thead .sticky { background: var(--bg-card); }
  .badge { margin-left: .375rem; vertical-align: middle; }

  /* Gruppen gleichnamiger Materialien */
  tr.gruppe { cursor: pointer; }
  tr.gruppe td { font-weight: 500; }
  .gruppen-btn {
    display: inline-flex; align-items: center; gap: .375rem; background: none; border: none; color: var(--fg);
    font: inherit; font-weight: 500; cursor: pointer; padding: 0; text-align: left;
  }
  .gruppen-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--radius-sm); }
  .pfeil { display: inline-flex; color: var(--fg-muted); transition: transform .15s; }
  tr.aufgeklappt .pfeil { transform: rotate(90deg); color: var(--primary); }
  .anzahl {
    font-size: .6875rem; font-weight: 500; color: var(--fg-muted); border: 1px solid var(--border);
    border-radius: 999px; padding: 0 .4rem; line-height: 1.3;
  }
  /* Mitglieder einer aufgeklappten Gruppe: leicht eingerückt, mit Linie am linken Rand */
  tr.mitglied td { background: var(--bg-hover); }
  tr.mitglied td.sticky { background: var(--bg-hover); box-shadow: inset 2px 0 0 var(--primary); padding-left: 1.75rem; }
</style>
