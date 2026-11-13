<script>
  import { t } from '../lib/i18n.js';
  import Icon from '../../shared/Icon.svelte';
  import { ABZEICHEN } from '../../../lib/abzeichen.js';

  // Bereich „Projekt unterstützen“: Fortschrittsbalken, Zahlungswege und Unterstützer mit Abzeichen.
  // angaben: { wege: { kofi, paypal, ueberweisung }, ziel, erreicht, waehrung, text, zielText, unterstuetzer: [{ name, abzeichen }] }
  // aus /api/v2/einstellungen. Beträge einzelner Personen gibt es dort nicht.
  let { lang, angaben, onsuggest = null } = $props();

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

  let bankOffen = $state(false);
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

  <div class="spalten">
    <div class="links">
      <h3>{t(lang, 'supportWays')}</h3>

      <div class="weg">
        <h4>{t(lang, 'supportKnowTitle')}</h4>
        <p class="text">{t(lang, 'supportKnowText')}</p>
        {#if onsuggest}
          <button class="btn btn-outline btn-sm" type="button" onclick={onsuggest}>{t(lang, 'suggest')}</button>
        {/if}
      </div>

      <div class="weg">
        <h4>{t(lang, 'supportMoneyTitle')}</h4>
        <p class="text">{t(lang, 'supportMoneyText')}</p>
        <p class="text">{t(lang, 'supportFees')}</p>
        <p class="text">{t(lang, 'supportSync')}</p>
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
          {#if bank}
            <button class="btn btn-outline btn-sm" type="button" onclick={() => (bankOffen = true)}>
              <Icon name="ui-cup" size={14} /> {t(lang, 'supportBank')}
            </button>
          {/if}
        </div>

      </div>
    </div>

    <div class="rechts">
      {#if angaben.ziel > 0}
        <div class="stand-block">
          <p class="betrag">{stand}</p>
          {#if zielText}<p class="ziel">{zielText}</p>{/if}
          <div class="balken" role="progressbar" aria-valuemin="0" aria-valuemax={angaben.ziel}
            aria-valuenow={Math.min(angaben.erreicht, angaben.ziel)} aria-label={zielText || stand}>
            <div class="fuellung" style:width="{anteil}%"></div>
          </div>
        </div>
      {/if}

      {#if angaben.unterstuetzer?.length}
        <div class="danke">
          <h3>{t(lang, 'supportThanks')}</h3>
          <ul class="kacheln">
            {#each angaben.unterstuetzer as u (u.name)}
              <li class="kachel">
                <span class="name">{u.name}</span>
                {#if u.abzeichen?.length}
                  <span class="abzeichen">
                    {#each u.abzeichen as id (id)}
                      <span class="medaille" title={abzeichenName(id)}><Icon name={'badge-' + id} size={26} /></span>
                    {/each}
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
          {#if vergeben.length}
            <ul class="legende">
              {#each vergeben as a (a.id)}
                <li><span class="medaille"><Icon name={'badge-' + a.id} size={16} /></span> <span><strong>{lang === 'en' ? a.en : a.de}:</strong> {sprache(a, 'text')}</span></li>
              {/each}
            </ul>
          {/if}
          <p class="notiz">{t(lang, 'supportThanksNote')}</p>
        </div>
      {/if}
    </div>
  </div>
</section>

<svelte:window onkeydown={(e) => e.key === 'Escape' && bankOffen && (bankOffen = false)} />

{#if bankOffen && bank}
  <div class="modal-overlay" role="presentation">
    <div class="modal bank-modal" role="dialog" aria-modal="true" aria-label={t(lang, 'bankTitle')}>
      <div class="bank-kopf">
        <h2>{t(lang, 'bankTitle')}</h2>
        <button type="button" class="btn btn-ghost btn-icon" aria-label={t(lang, 'close')} title={t(lang, 'close')} onclick={() => (bankOffen = false)}>×</button>
      </div>
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
  </div>
{/if}

<style>
  .unterstuetzen { margin-top: 2rem; padding: 1.5rem; border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; gap: .75rem; }
  h2 { font-size: 1.125rem; font-weight: 600; margin: 0; }
  h3 { font-size: .875rem; font-weight: 600; margin: 0 0 .5rem; }
  h4 { font-size: .9375rem; font-weight: 600; margin: 0; }
  h5 { font-size: .8125rem; font-weight: 600; margin: 0 0 .35rem; }
  .text { font-size: .875rem; color: var(--fg-muted); margin: 0; max-width: 60ch; }

  /* Zwei Spalten: links die Erklärung und Wege, rechts Stand und Unterstützer. Auf kleinen Bildschirmen untereinander. */
  .spalten { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-top: .5rem; }
  @media (min-width: 760px) {
    .spalten { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 2rem; }
    .rechts { border-left: 1px solid var(--border); padding-left: 2rem; }
  }
  .links, .rechts { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
  .links > h3 { margin-bottom: 0; }
  .weg { display: flex; flex-direction: column; align-items: flex-start; gap: .5rem; }
  .weg + .weg { padding-top: 1rem; border-top: 1px solid var(--border); }
  .wege { display: flex; flex-wrap: wrap; gap: .5rem; }

  .bank-modal { max-width: 28rem; padding: 1.25rem 1.5rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; font-size: .9375rem; }
  .bank-kopf { display: flex; justify-content: space-between; align-items: center; }
  .bank-kopf h2 { margin: 0; font-size: 1.0625rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .15rem .75rem; margin: 0; }
  dt { color: var(--fg-muted); }
  dd { margin: 0; word-break: break-word; }
  .iban { font-family: var(--mono, ui-monospace, monospace); letter-spacing: .02em; }

  .stand-block { display: flex; flex-direction: column; gap: .35rem; }
  .betrag { font-size: 1.5rem; font-weight: 600; margin: 0; line-height: 1.2; }
  .ziel { font-size: .8125rem; color: var(--fg-muted); margin: 0; }
  .balken { width: 100%; height: 1rem; background: var(--bg-hover); border: 1px solid var(--border); border-radius: 999px; overflow: hidden; margin-top: .25rem; }
  .fuellung { height: 100%; background: var(--primary); border-radius: 999px; transition: width .4s; }

  .kacheln { list-style: none; margin: 0 0 .75rem; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: .6rem; }
  .kachel { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .4rem; padding: .75rem .5rem; min-height: 5rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-hover); text-align: center; }
  .name { font-size: 1rem; font-weight: 600; overflow-wrap: anywhere; }
  .abzeichen { display: flex; flex-wrap: wrap; justify-content: center; gap: .35rem; }
  .medaille { display: inline-flex; color: var(--primary); }
  .legende { list-style: none; margin: 0 0 .5rem; padding: 0; display: flex; flex-direction: column; gap: .35rem; font-size: .8125rem; color: var(--fg-muted); }
  .legende li { display: flex; align-items: flex-start; gap: .5rem; }
  .legende strong { color: var(--fg); font-weight: 600; }
  .notiz { font-size: .75rem; color: var(--fg-muted); margin: 0; }
</style>
