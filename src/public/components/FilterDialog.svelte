<script>
  import { t, pick } from '../lib/i18n.js';

  // filterable: Eigenschaften, die gefiltert werden können
  // getUnits(kw): Einheiten, die bei dieser Eigenschaft vorkommen
  // initial: bestehender Filter (zum Bearbeiten) oder null
  let { lang, filterable, getUnits, initial, onsave, oncancel } = $props();

  const defaultOp = { zahl: 'bis', text: 'enthaelt', auswahl: 'in', ja_nein: 'ja' };

  let kw = $state(initial?.kw ?? '');
  let op = $state(initial?.op ?? '');
  let a = $state(initial?.a !== undefined ? String(initial.a) : '');
  let b = $state(initial?.b !== undefined ? String(initial.b) : '');
  let unit = $state(initial?.unit ?? '');
  let text = $state(initial?.text ?? '');
  let ids = $state(initial?.ids ?? []);
  let error = $state('');

  let prop = $derived(filterable.find(p => p.kurzwort === kw) ?? null);
  let units = $derived(prop && prop.typ === 'zahl' ? getUnits(prop.kurzwort) : []);

  function chooseProperty(newKw) {
    kw = newKw;
    const p = filterable.find(x => x.kurzwort === newKw);
    op = p ? defaultOp[p.typ] : '';
    a = ''; b = ''; text = ''; ids = [];
    unit = p?.einheit ?? '';
    error = '';
  }

  function toggleId(id) {
    ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
  }

  function parse(s) {
    const n = Number(String(s).trim().replace(',', '.'));
    return s.trim() !== '' && Number.isFinite(n) ? n : null;
  }

  function submit(e) {
    e.preventDefault();
    error = '';
    if (!prop) return;
    const base = { kw: prop.kurzwort };

    if (prop.typ === 'zahl') {
      const na = parse(a);
      if (na === null) { error = t(lang, 'dialogErrNumber'); return; }
      if (op === 'von') {
        const nb = parse(b);
        if (nb === null) { error = t(lang, 'dialogErrNumber'); return; }
        if (na > nb) { error = t(lang, 'dialogErrRange'); return; }
        return onsave({ ...base, op, a: na, b: nb, unit: unit || prop.einheit });
      }
      return onsave({ ...base, op, a: na, unit: unit || prop.einheit });
    }

    if (prop.typ === 'text') {
      if (!text.trim()) { error = t(lang, 'dialogErrText'); return; }
      return onsave({ ...base, op: 'enthaelt', text: text.trim() });
    }

    if (prop.typ === 'auswahl') {
      if (!ids.length) { error = t(lang, 'dialogErrOptions'); return; }
      return onsave({ ...base, op: 'in', ids: [...ids] });
    }

    return onsave({ ...base, op, ja: op === 'ja' });
  }

  const zahlOps = [
    ['bis', 'opMax'], ['ab', 'opMin'], ['ist', 'opEq'], ['von', 'opRange']
  ];
</script>

<div class="modal-overlay" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
  <div class="modal" role="dialog" aria-modal="true" aria-label={t(lang, 'dialogTitle')}>
  <form class="filter-dialog" onsubmit={submit}>
    <h2>{initial ? t(lang, 'editFilter') : t(lang, 'addFilter')}</h2>

    {#if !filterable.length}
      <p class="muted">{t(lang, 'dialogNoFilterable')}</p>
    {:else}
      <label class="field">
        <span>{t(lang, 'dialogProperty')}</span>
        <select class="input" value={kw} onchange={(e) => chooseProperty(e.currentTarget.value)}>
          <option value="" disabled>{t(lang, 'dialogChoose')}</option>
          {#each filterable as p (p.kurzwort)}
            <option value={p.kurzwort}>{pick(p.name, lang)}</option>
          {/each}
        </select>
      </label>

      {#if prop?.typ === 'zahl'}
        <label class="field">
          <span>{t(lang, 'dialogOp')}</span>
          <select class="input" bind:value={op}>
            {#each zahlOps as [value, key] (value)}
              <option value={value}>{t(lang, key)}</option>
            {/each}
          </select>
        </label>
        <div class="row">
          <label class="field">
            <span>{op === 'von' ? t(lang, 'dialogFrom') : t(lang, 'dialogValue')}</span>
            <input class="input" inputmode="decimal" bind:value={a} />
          </label>
          {#if op === 'von'}
            <label class="field">
              <span>{t(lang, 'dialogTo')}</span>
              <input class="input" inputmode="decimal" bind:value={b} />
            </label>
          {/if}
          {#if units.length > 1}
            <label class="field">
              <span>{t(lang, 'dialogUnit')}</span>
              <select class="input" bind:value={unit}>
                {#each units as u (u)}
                  <option value={u}>{u}</option>
                {/each}
              </select>
            </label>
          {:else if units.length === 1}
            <p class="muted">{t(lang, 'dialogUnit')}: {units[0]}</p>
          {/if}
        </div>
      {:else if prop?.typ === 'text'}
        <label class="field">
          <span>{t(lang, 'dialogContains')}</span>
          <input class="input" bind:value={text} />
        </label>
      {:else if prop?.typ === 'auswahl'}
        <fieldset class="field">
          <legend>{t(lang, 'dialogOptions')}</legend>
          {#each prop.optionen as o (o.id)}
            <label class="check">
              <input type="checkbox" checked={ids.includes(o.id)} onchange={() => toggleId(o.id)} />
              {pick({ de: o.de, en: o.en }, lang)}
            </label>
          {/each}
        </fieldset>
      {:else if prop?.typ === 'ja_nein'}
        <label class="field">
          <span>{t(lang, 'dialogOp')}</span>
          <select class="input" bind:value={op}>
            <option value="ja">{t(lang, 'opYes')}</option>
            <option value="nein">{t(lang, 'opNo')}</option>
          </select>
        </label>
      {/if}
    {/if}

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="actions">
      <button type="button" class="btn btn-ghost" onclick={oncancel}>{t(lang, 'cancel')}</button>
      <button type="submit" class="btn btn-primary" disabled={!prop}>{t(lang, 'apply')}</button>
    </div>
  </form>
  </div>
</div>

<style>
  .filter-dialog { display: flex; flex-direction: column; gap: .75rem; }
  .field { display: flex; flex-direction: column; gap: .25rem; font-size: .8125rem; flex: 1 1 140px; }
  .field > span, .field legend { color: var(--fg-muted); font-size: .75rem; }
  .row { display: flex; gap: .75rem; flex-wrap: wrap; align-items: flex-end; }
  .check { display: flex; gap: .5rem; align-items: center; font-size: .8125rem; padding: .2rem 0; }
  fieldset.field { border: none; padding: 0; }
  .muted { color: var(--fg-muted); font-size: .8125rem; }
  .error { color: var(--danger); font-size: .8125rem; }
  .actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .25rem; }
</style>
