<script>
  import { t } from '../lib/i18n.js';
  import Icon from '../../shared/Icon.svelte';
  import { ABZEICHEN } from '../../../lib/abzeichen.js';

  // Bereich „Projekt unterstützen“: Fortschrittsbalken, Zahlungswege und Unterstützer mit Abzeichen.
  // angaben: { wege: { kofi, paypal, ueberweisung }, ziel, erreicht, waehrung, text, zielText, unterstuetzer: [{ name, abzeichen }] }
  // aus /api/v2/einstellungen. Beträge einzelner Personen gibt es dort nicht.
  let { lang, angaben } = $props();

  let text = $derived(angaben.text?.[lang] || angaben.text?.de || t(lang, 'supportText'));
  let zielText = $derived(angaben.zielText?.[lang] || angaben.zielText?.de || '');
  let geld = $derived(new Intl.NumberFormat(lang, { style: 'currency', currency: angaben.waehrung, maximumFractionDigits: 0 }));
  let anteil = $derived(angaben.ziel > 0 ? Math.min(100, Math.round((angaben.erreicht / angaben.ziel) * 100)) : 0);
  let stand = $derived(t(lang, 'supportProgress', geld.format(angaben.erreicht), geld.format(angaben.ziel)));
  let bank = $derived(angaben.wege.ueberweisung);

  const sprache = (a, feld) => a[lang === 'en' ? feld + '_en' : feld + '_de'];
  const abzeichenName = (id) => { const a = ABZEICHEN.find(x => x.id === id); return a ? (lang === 'en' ? a.en : a.de) : ''; };
  // Abzeichen, die tatsächlich vergeben sind, für die Erklärung darunter
  let vergeben = $derived(ABZEICHEN.filter(a => angaben.unterstuetzer?.some(u => u.abzeichen?.includes(a.id))));

  let kopiert = $state(false);
  async function kopiere(iban) {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s+/g, ''));
      kopiert = true;
      setTimeout(() => (kopiert = false), 2000);
    } catch { /* Kopieren nicht möglich: die IBAN steht sichtbar daneben */ }
  }
</script>

<section class="unterstuetzen" aria-labelledby="unterstuetzen-titel">
  <h2 id="unterstuetzen-titel">{t(lang, 'supportTitle')}</h2>
  <p class="text">{text}</p>

  {#if angaben.ziel > 0}
    <div class="balken" role="progressbar" aria-valuemin="0" aria-valuemax={angaben.ziel}
      aria-valuenow={Math.min(angaben.erreicht, angaben.ziel)} aria-label={zielText || stand}>
      <div class="fuellung" style:width="{anteil}%"></div>
    </div>
    <p class="stand">{stand}{zielText ? ` · ${zielText}` : ''}</p>
  {/if}

  <div class="wege">
    {#if angaben.wege.kofi}
      <a class="btn btn-outline btn-sm" href={angaben.wege.kofi} target="_blank" rel="noopener noreferrer">
        <Icon name="ui-cup" size={14} /> {t(lang, 'supportKofi')}
      </a>
    {/if}
    {#if angaben.wege.paypal}
      <a class="btn btn-outline btn-sm" href={angaben.wege.paypal} target="_blank" rel="noopener noreferrer">
        <Icon name="ui-cup" size={14} /> {t(lang, 'supportPaypal')}
      </a>
    {/if}
  </div>

  {#if bank}
    <div class="bank">
      <h3>{t(lang, 'supportBank')}</h3>
      <dl>
        <dt>{t(lang, 'supportHolder')}</dt><dd>{bank.inhaber}</dd>
        <dt>IBAN</dt>
        <dd>
          <span class="iban">{bank.iban}</span>
          <button class="btn btn-ghost btn-sm" type="button" onclick={() => kopiere(bank.iban)}>
            {kopiert ? t(lang, 'supportCopied') : t(lang, 'supportCopy')}
          </button>
        </dd>
        {#if bank.bic}<dt>{t(lang, 'supportBic')}</dt><dd>{bank.bic}</dd>{/if}
        {#if bank.zweck}<dt>{t(lang, 'supportReference')}</dt><dd>{bank.zweck}</dd>{/if}
      </dl>
    </div>
  {/if}

  {#if angaben.unterstuetzer?.length}
    <div class="danke">
      <h3>{t(lang, 'supportThanks')}</h3>
      <ul>
        {#each angaben.unterstuetzer as u (u.name)}
          <li class="unterstuetzer">
            {#each u.abzeichen ?? [] as id (id)}
              <span class="medaille" title={abzeichenName(id)}><Icon name={'badge-' + id} size={16} /></span>
            {/each}
            <span class="name">{u.name}</span>
          </li>
        {/each}
      </ul>
      {#if vergeben.length}
        <ul class="legende">
          {#each vergeben as a (a.id)}
            <li><span class="medaille"><Icon name={'badge-' + a.id} size={14} /></span> <strong>{lang === 'en' ? a.en : a.de}:</strong> {sprache(a, 'text')}</li>
          {/each}
        </ul>
      {/if}
      <p class="stand">{t(lang, 'supportThanksNote')}</p>
    </div>
  {/if}
</section>

<style>
  .unterstuetzen { margin-top: 2rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; align-items: flex-start; gap: .75rem; max-width: 40rem; }
  h2 { font-size: 1rem; font-weight: 600; margin: 0; }
  h3 { font-size: .8125rem; font-weight: 600; margin: 0 0 .35rem; }
  .text { font-size: .8125rem; color: var(--fg-muted); }
  .balken { width: 100%; height: .5rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; }
  .fuellung { height: 100%; background: var(--primary); border-radius: 999px; transition: width .4s; }
  .stand { font-size: .75rem; color: var(--fg-muted); margin: 0; }
  .balken + .stand { margin-top: -.35rem; }
  .wege { display: flex; flex-wrap: wrap; gap: .5rem; }
  .bank { font-size: .8125rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .15rem .75rem; margin: 0; }
  dt { color: var(--fg-muted); }
  dd { margin: 0; word-break: break-word; }
  .iban { font-family: var(--mono, ui-monospace, monospace); letter-spacing: .02em; }
  .danke ul { list-style: none; margin: 0 0 .5rem; padding: 0; display: flex; flex-wrap: wrap; gap: .4rem .5rem; }
  .unterstuetzer { display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .65rem; border: 1px solid var(--border); border-radius: 999px; font-size: .8125rem; }
  .medaille { display: inline-flex; color: var(--primary); }
  .danke ul.legende { display: flex; flex-direction: column; gap: .2rem; margin: .5rem 0; font-size: .75rem; color: var(--fg-muted); }
  .legende li { display: flex; align-items: center; gap: .35rem; }
  .legende strong { color: var(--fg); font-weight: 600; }
</style>
