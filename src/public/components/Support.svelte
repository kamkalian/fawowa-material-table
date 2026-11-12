<script>
  import { t } from '../lib/i18n.js';
  import Icon from '../../shared/Icon.svelte';

  // angaben: { url, ziel, erreicht, waehrung, text, button, zielText } aus /api/v2/einstellungen (alles aus der .env)
  let { lang, angaben } = $props();

  const wahl = (feld, standard) => angaben[feld]?.[lang] || angaben[feld]?.de || standard;
  let text = $derived(wahl('text', t(lang, 'supportText')));
  let knopf = $derived(wahl('button', t(lang, 'supportButton')));
  let zielText = $derived(angaben.zielText?.[lang] || angaben.zielText?.de || '');
  let geld = $derived(new Intl.NumberFormat(lang, { style: 'currency', currency: angaben.waehrung, maximumFractionDigits: 0 }));
  let anteil = $derived(angaben.ziel > 0 ? Math.min(100, Math.round((angaben.erreicht / angaben.ziel) * 100)) : 0);
  let stand = $derived(t(lang, 'supportProgress', geld.format(angaben.erreicht), geld.format(angaben.ziel)));
</script>

<div class="unterstuetzen">
  <p class="text">{text}</p>

  {#if angaben.ziel > 0}
    <div class="balken" role="progressbar" aria-valuemin="0" aria-valuemax={angaben.ziel}
      aria-valuenow={Math.min(angaben.erreicht, angaben.ziel)} aria-label={zielText || stand}>
      <div class="fuellung" style:width="{anteil}%"></div>
    </div>
    <p class="stand">{stand}{zielText ? ` · ${zielText}` : ''}</p>
  {/if}

  <a class="btn btn-outline btn-sm" href={angaben.url} target="_blank" rel="noopener noreferrer">
    <Icon name="ui-cup" size={14} /> {knopf}
  </a>
</div>

<style>
  .unterstuetzen { display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; max-width: 26rem; }
  .text { font-size: .8125rem; color: var(--fg-muted); }
  .balken { width: 100%; height: .5rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .fuellung { height: 100%; background: var(--primary); border-radius: 999px; transition: width .4s; }
  .stand { font-size: .75rem; color: var(--fg-muted); margin-top: -.25rem; }
</style>
