<script>
  // Eingabe eines Wertes passend zum Typ der Eigenschaft: Zahl mit Einheit, Text, Ja/Nein oder Auswahl.
  import { t, pick } from '../lib/i18n.js';

  let { lang, prop, wert = $bindable(''), einheit = $bindable(''), label = '' } = $props();
</script>

{#if prop?.typ === 'zahl'}
  <input class="input" inputmode="decimal" bind:value={wert} aria-label={label} />
  <input class="input einheit" bind:value={einheit} placeholder={prop.einheit ?? t(lang, 'fieldUnit')} aria-label={t(lang, 'fieldUnit')} />
{:else if prop?.typ === 'ja_nein'}
  <select class="input" bind:value={wert} aria-label={label}>
    <option value="">–</option>
    <option value="ja">{t(lang, 'yes')}</option>
    <option value="nein">{t(lang, 'no')}</option>
  </select>
{:else if prop?.typ === 'auswahl'}
  <select class="input" bind:value={wert} aria-label={label}>
    <option value="">–</option>
    {#each prop.optionen as o (o.id)}
      <option value={o.de}>{pick({ de: o.de, en: o.en }, lang)}</option>
    {/each}
  </select>
{:else}
  <input class="input" bind:value={wert} aria-label={label} disabled={!prop} />
{/if}

<style>
  .einheit { max-width: 7rem; }
</style>
