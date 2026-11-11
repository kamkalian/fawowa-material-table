<script>
  import { t, pick } from '../lib/i18n.js';
  import { displayName, categoryName, formatValue, vermerkText } from '../lib/filter.js';
  import CategoryIcon from '../../shared/CategoryIcon.svelte';

  // material: das geöffnete Material, props: alle Eigenschaften
  let { lang, material, props, onclose } = $props();

  function onKey(e) {
    if (e.key === 'Escape') onclose();
  }

  function isLink(s) {
    return typeof s === 'string' && /^https?:\/\//.test(s);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="modal-overlay" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal detail" role="dialog" aria-modal="true" aria-label={displayName(material, lang)}>
    <div class="detail-head">
      <div>
        <h2 class="titel">
          <CategoryIcon name={material.kategorie.icon} size={30} />
          {displayName(material, lang)}
        </h2>
        <p class="muted">
          {t(lang, 'detailCategory')}: {categoryName(material, lang)}
          {#if material.hersteller}
            · {t(lang, 'detailManufacturer')}: {material.hersteller}
          {/if}
        </p>
      </div>
      <button class="btn btn-ghost btn-icon" aria-label={t(lang, 'close')} title={t(lang, 'close')} onclick={onclose}>×</button>
    </div>

    {#if pick(material.notiz, lang)}
      <p class="note"><strong>{t(lang, 'detailNote')}:</strong> {pick(material.notiz, lang)}</p>
    {/if}

    <h3>{t(lang, 'detailProperties')}</h3>
    <table class="props">
      <tbody>
        {#each props as p (p.kurzwort)}
          {@const w = material.werte[p.kurzwort]}
          {@const text = formatValue(p, w, lang)}
          <tr>
            <th scope="row">{pick(p.name, lang)}</th>
            <td>
              {#if text}
                {text}
                {#if vermerkText(w, lang)}
                  <span class="badge badge-check" title={t(lang, 'unverifiedTitle')}>{vermerkText(w, lang)}</span>
                {/if}
                {#if isLink(w.quelle)}
                  <br /><a class="small" href={w.quelle} target="_blank" rel="noopener noreferrer">{t(lang, 'detailSource')}</a>
                {/if}
              {:else}
                <span class="muted">{t(lang, 'empty')}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if material.links.length}
      <h3>{t(lang, 'detailLinks')}</h3>
      <ul class="links">
        {#each material.links as l (l.url)}
          <li><a href={l.url} target="_blank" rel="noopener noreferrer">{l.beschriftung}</a></li>
        {/each}
      </ul>
    {/if}

    <div class="detail-actions">
      <button class="btn btn-outline" disabled title={t(lang, 'detailReportSoon')}>{t(lang, 'detailReport')}</button>
    </div>
  </div>
</div>

<style>
  .detail { max-width: 640px; }
  .detail-head { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
  .detail-head h2 { margin-bottom: .25rem; }
  .titel { display: flex; align-items: center; gap: .5rem; }
  .muted { color: var(--fg-muted); font-size: .8125rem; }
  .note { font-size: .8125rem; margin: .75rem 0; }
  h3 { font-size: .8125rem; margin: 1rem 0 .5rem; color: var(--fg-muted); text-transform: uppercase; letter-spacing: .04em; }
  .props { width: 100%; font-size: .8125rem; border-collapse: collapse; }
  .props th, .props td { text-align: left; padding: .4rem .5rem; border-top: 1px solid var(--border); vertical-align: top; }
  .props th { font-weight: 500; color: var(--fg-muted); width: 45%; }
  .links { list-style: none; font-size: .8125rem; display: flex; flex-direction: column; gap: .25rem; }
  .links a, .small { color: var(--primary); }
  .small { font-size: .75rem; }
  .detail-actions { margin-top: 1.25rem; }
  .badge { margin-left: .375rem; vertical-align: middle; }
</style>
