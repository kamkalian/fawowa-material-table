<script>
  import { onMount } from 'svelte';
  import { t, pick } from '../lib/i18n.js';
  import { displayName, formatValue } from '../lib/filter.js';
  import ValueInput from './ValueInput.svelte';

  // mode: "fehler" (zu einem bestehenden Material) oder "vorschlag" (neues Material)
  let { lang, mode, material = null, props, kategorien, onclose } = $props();

  const istFehler = mode === 'fehler';

  let token = $state('');
  let status = $state('form'); // form | senden | fertig
  let fehler = $state('');
  let website = $state(''); // Honigtopf: bleibt bei Menschen leer

  // Nach dem Absenden: darf der Melder als Unterstützer genannt werden?
  let nennung = $state({ id: null, token: null, phase: 'frage' }); // phase: frage | senden | ja | nein | fehler

  let kommentar = $state('');
  let quelle = $state('');
  let kontakt = $state('');
  let melderName = $state('');

  // Fehlermeldung
  let eigenschaft = $state('');
  let neuerWert = $state('');
  let einheit = $state('');

  // Vorschlag
  let name = $state('');
  let hersteller = $state('');
  let kategorieId = $state('');
  let zeilen = $state([{ eigenschaft: '', wert: '', einheit: '' }]);

  let gewaehlt = $derived(props.find(p => p.kurzwort === eigenschaft) ?? null);

  onMount(async () => {
    try {
      const res = await fetch('/api/v2/formular-token');
      if (!res.ok) throw new Error('HTTP');
      token = (await res.json()).token;
    } catch {
      fehler = t(lang, 'formLoadError');
    }
  });

  function eigenschaftGewaehlt(kw) {
    eigenschaft = kw;
    neuerWert = '';
    const p = props.find(x => x.kurzwort === kw);
    // Einheit des aktuellen Wertes vorschlagen
    einheit = material?.werte[kw]?.einheit ?? p?.einheit ?? '';
  }

  function zeileGewaehlt(zeile, kw) {
    zeile.eigenschaft = kw;
    zeile.wert = '';
    zeile.einheit = props.find(p => p.kurzwort === kw)?.einheit ?? '';
  }

  function aktuellerWert(p) {
    return formatValue(p, material?.werte[p.kurzwort], lang) ?? t(lang, 'empty');
  }

  async function zustimmen() {
    nennung.phase = 'senden';
    try {
      const res = await fetch(`/api/v2/meldungen/${nennung.id}/nennung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: nennung.token })
      });
      nennung.phase = res.ok ? 'ja' : 'fehler';
    } catch {
      nennung.phase = 'fehler';
    }
  }

  async function senden(e) {
    e.preventDefault();
    fehler = '';

    let koerper;
    if (istFehler) {
      if (!kommentar.trim() && !(eigenschaft && neuerWert.trim())) { fehler = t(lang, 'needCommentOrValue'); return; }
      koerper = {
        art: 'fehler',
        material_id: material.id,
        eigenschaft: eigenschaft || null,
        neuer_wert: neuerWert,
        einheit: gewaehlt?.typ === 'zahl' ? einheit : null
      };
    } else {
      if (!name.trim()) { fehler = t(lang, 'needName'); return; }
      const werte = zeilen.filter(z => z.wert.trim());
      if (!werte.length || werte.some(z => !z.eigenschaft)) { fehler = t(lang, 'needValue'); return; }
      koerper = {
        art: 'vorschlag',
        name,
        hersteller,
        kategorie_id: kategorieId === '' ? null : Number(kategorieId),
        werte: werte.map(z => ({
          eigenschaft: z.eigenschaft,
          wert: z.wert,
          einheit: props.find(p => p.kurzwort === z.eigenschaft)?.typ === 'zahl' ? z.einheit : null
        }))
      };
    }

    status = 'senden';
    try {
      const res = await fetch('/api/v2/meldungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...koerper, kommentar, quelle, kontakt, melder_name: melderName, token, website })
      });
      if (res.status === 201) {
        const antwort = await res.json().catch(() => ({}));
        nennung = { id: antwort.id ?? null, token: antwort.token ?? null, phase: 'frage' };
        status = 'fertig';
        return;
      }
      const daten = await res.json().catch(() => ({}));
      fehler = daten.error || t(lang, 'sendError');
      // Ein abgelaufener oder zu schneller Token wird neu geholt, damit ein zweiter Versuch klappt
      if (daten.grund) {
        try { token = (await (await fetch('/api/v2/formular-token')).json()).token; } catch { /* ignorieren */ }
      }
    } catch {
      fehler = t(lang, 'sendError');
    }
    status = 'form';
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && status !== 'senden' && onclose()} />

<div class="modal-overlay" role="presentation">
  <div class="modal report" role="dialog" aria-modal="true" aria-label={istFehler ? t(lang, 'reportTitle', displayName(material, lang)) : t(lang, 'suggestTitle')}>
    <div class="kopf">
      <h2>{istFehler ? t(lang, 'reportTitle', displayName(material, lang)) : t(lang, 'suggestTitle')}</h2>
      <button type="button" class="btn btn-ghost btn-icon" aria-label={t(lang, 'close')} title={t(lang, 'close')} onclick={onclose}>×</button>
    </div>

    {#if status === 'fertig'}
      <div class="danke" role="status">
        <h3>{t(lang, 'thanksTitle')}</h3>
        <p>{t(lang, 'thanksText')}</p>

        {#if nennung.token && melderName.trim() && nennung.phase !== 'nein'}
          <div class="nennung">
            {#if nennung.phase === 'ja'}
              <p>{t(lang, 'nameAskDone')}</p>
            {:else}
              <h4>{t(lang, 'nameAskTitle')}</h4>
              <p class="hinweis">{t(lang, 'nameAskText', melderName.trim())}</p>
              {#if nennung.phase === 'fehler'}<p class="fehler" role="alert">{t(lang, 'nameAskError')}</p>{/if}
              <div class="aktionen">
                <button type="button" class="btn btn-ghost" disabled={nennung.phase === 'senden'} onclick={() => (nennung.phase = 'nein')}>{t(lang, 'nameAskNo')}</button>
                <button type="button" class="btn btn-outline" disabled={nennung.phase === 'senden'} onclick={zustimmen}>{t(lang, 'nameAskYes')}</button>
              </div>
            {/if}
          </div>
        {/if}
        <button type="button" class="btn btn-primary" onclick={onclose}>{t(lang, 'close')}</button>
      </div>
    {:else}
      <form onsubmit={senden}>
        <p class="intro">{istFehler ? t(lang, 'reportIntro') : t(lang, 'suggestIntro')}</p>

        {#if istFehler}
          <label class="feld">
            <span>{t(lang, 'fieldProperty')}</span>
            <select class="input" value={eigenschaft} onchange={(e) => eigenschaftGewaehlt(e.currentTarget.value)}>
              <option value="">{t(lang, 'fieldPropertyNone')}</option>
              {#each props as p (p.kurzwort)}
                <option value={p.kurzwort}>{pick(p.name, lang)} ({aktuellerWert(p)})</option>
              {/each}
            </select>
          </label>

          {#if gewaehlt}
            <div class="feld">
              <span>{t(lang, 'fieldNewValue')} <small class="aktuell">{t(lang, 'fieldCurrent', aktuellerWert(gewaehlt))}</small></span>
              <div class="wertzeile">
                <ValueInput {lang} prop={gewaehlt} bind:wert={neuerWert} bind:einheit label={t(lang, 'fieldNewValue')} />
              </div>
            </div>
          {/if}
        {:else}
          <label class="feld">
            <span>{t(lang, 'fieldName')}</span>
            <input class="input" bind:value={name} maxlength="200" required />
          </label>
          <div class="zweispaltig">
            <label class="feld">
              <span>{t(lang, 'fieldManufacturer')}</span>
              <input class="input" bind:value={hersteller} maxlength="200" />
            </label>
            <label class="feld">
              <span>{t(lang, 'fieldCategory')}</span>
              <select class="input" bind:value={kategorieId}>
                <option value="">{t(lang, 'fieldCategoryNone')}</option>
                {#each kategorien as k (k.id)}
                  <option value={k.id}>{pick(k.name, lang)}</option>
                {/each}
              </select>
            </label>
          </div>

          <fieldset class="werte">
            <legend>{t(lang, 'valuesTitle')}</legend>
            {#each zeilen as zeile, i (i)}
              {@const p = props.find(x => x.kurzwort === zeile.eigenschaft) ?? null}
              <div class="zeile">
                <select class="input" value={zeile.eigenschaft} aria-label={t(lang, 'valueProperty')} onchange={(e) => zeileGewaehlt(zeile, e.currentTarget.value)}>
                  <option value="">{t(lang, 'valueChoose')}</option>
                  {#each props as q (q.kurzwort)}
                    <option value={q.kurzwort}>{pick(q.name, lang)}</option>
                  {/each}
                </select>
                <div class="wertzeile">
                  <ValueInput {lang} prop={p} bind:wert={zeile.wert} bind:einheit={zeile.einheit} label={t(lang, 'valueValue')} />
                </div>
                {#if zeilen.length > 1}
                  <button type="button" class="btn btn-ghost btn-sm" onclick={() => (zeilen = zeilen.filter((_, j) => j !== i))}>{t(lang, 'valueRemove')}</button>
                {/if}
              </div>
            {/each}
            <button type="button" class="btn btn-outline btn-sm" disabled={zeilen.length >= 20} onclick={() => (zeilen = [...zeilen, { eigenschaft: '', wert: '', einheit: '' }])}>
              {t(lang, 'valueAdd')}
            </button>
            <p class="hinweis">{t(lang, 'missingPropertyHint')}</p>
          </fieldset>
        {/if}

        <label class="feld">
          <span>{t(lang, 'fieldComment')}</span>
          <textarea class="input" rows="3" maxlength="2000" bind:value={kommentar}></textarea>
        </label>
        <label class="feld">
          <span>{t(lang, 'fieldReporter')}</span>
          <input class="input" maxlength="60" autocomplete="nickname" bind:value={melderName} />
          <span class="hinweis">{t(lang, 'fieldReporterHint')}</span>
        </label>

        <div class="zweispaltig">
          <label class="feld">
            <span>{t(lang, 'fieldSource')}</span>
            <input class="input" type="url" maxlength="500" placeholder="https://" bind:value={quelle} />
          </label>
          <label class="feld">
            <span>{t(lang, 'fieldContact')}</span>
            <input class="input" maxlength="200" autocomplete="off" bind:value={kontakt} />
          </label>
        </div>

        <!-- Honigtopf gegen Bots: für Menschen unsichtbar und nicht erreichbar -->
        <div class="hp" aria-hidden="true">
          <label>Website <input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} /></label>
        </div>

        {#if fehler}<p class="fehler" role="alert">{fehler}</p>{/if}

        <div class="aktionen">
          <button type="button" class="btn btn-ghost" onclick={onclose} disabled={status === 'senden'}>{t(lang, 'cancel')}</button>
          <button type="submit" class="btn btn-primary" disabled={status === 'senden' || !token}>
            {status === 'senden' ? t(lang, 'sending') : t(lang, 'send')}
          </button>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .report { max-width: 640px; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .kopf h2 { margin-bottom: .5rem; }
  .intro { color: var(--fg-muted); font-size: .8125rem; margin-bottom: 1rem; }
  form { display: flex; flex-direction: column; gap: .875rem; }
  .feld { display: flex; flex-direction: column; gap: .25rem; font-size: .8125rem; min-width: 0; }
  .feld > span { color: var(--fg-muted); font-size: .75rem; }
  .aktuell { margin-left: .5rem; color: var(--primary); }
  .zweispaltig { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .75rem; }
  .wertzeile { display: flex; gap: .5rem; align-items: center; }
  fieldset.werte { border: 1px solid var(--border); border-radius: var(--radius); padding: .75rem; display: flex; flex-direction: column; gap: .5rem; }
  fieldset.werte legend { font-size: .75rem; color: var(--fg-muted); padding: 0 .35rem; }
  .zeile { display: grid; grid-template-columns: minmax(130px, 1fr) 2fr auto; gap: .5rem; align-items: center; }
  .hinweis { color: var(--fg-muted); font-size: .75rem; }
  .fehler { color: var(--danger); font-size: .8125rem; }
  .aktionen { display: flex; justify-content: flex-end; gap: .5rem; }
  .nennung { border-top: 1px solid var(--border); padding-top: 1rem; width: 100%; text-align: left; display: flex; flex-direction: column; gap: .5rem; }
  .nennung h4 { margin: 0; font-size: .9375rem; }
  .danke { text-align: center; padding: 1.5rem .5rem; display: flex; flex-direction: column; gap: .75rem; align-items: center; }
  .hp { position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }
  @media (max-width: 560px) { .zeile { grid-template-columns: 1fr; } }
</style>
