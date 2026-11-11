<script>
  import { t, pick } from '../lib/i18n.js';
  import { displayName, categoryName, formatValue, vermerkText } from '../lib/filter.js';
  import CategoryIcon from '../../shared/CategoryIcon.svelte';
  import Flag from '@lucide/svelte/icons/flag';

  // rows: sichtbare Materialien, columns: sichtbare Eigenschaften, sort: {key, dir} oder null
  let { lang, rows, columns, sort, onsort, onopen, onreport } = $props();

  function sortIcon(key) {
    if (!sort || sort.key !== key) return '↕';
    return sort.dir === 'asc' ? '↑' : '↓';
  }

  function ariaSort(key) {
    if (!sort || sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  }
</script>

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
      {#if !rows.length}
        <tr class="empty-row"><td colspan={columns.length + 3}>{t(lang, 'noResults')}</td></tr>
      {/if}
      {#each rows as m (m.id)}
        <tr class="clickable" onclick={() => onopen(m.id)}>
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
</style>
