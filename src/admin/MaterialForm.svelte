<script>
  import { api } from './api.js';
  import Dialog from './Dialog.svelte';
  import CategoryIcon from '../shared/CategoryIcon.svelte';

  // material: bestehendes Material oder null zum Anlegen
  let { material, props, kategorien, onsaved, onclose, onduplicate, ondelete } = $props();

  const neu = material === null;

  function wertEntwurf(p, w) {
    return {
      text: p.typ === 'zahl' ? (w ? String(w.wert) : '') : p.typ === 'text' ? (w?.wert ?? '') : '',
      option_id: w?.optionId ?? '',
      ja_nein: w ? (w.wert ? 'ja' : 'nein') : '',
      einheit: w?.einheit ?? '',
      ungeprueft: !!w?.vermerk,
      vermerk_de: w?.vermerk?.de ?? '',
      vermerk_en: w?.vermerk?.en ?? '',
      quelle: w?.quelle ?? ''
    };
  }

  function startEntwurf() {
    const m = material;
    return {
      name_de: m?.name.de ?? '',
      name_en: m?.name.en ?? '',
      hersteller: m?.hersteller ?? '',
      kategorie_id: m?.kategorie.id ?? kategorien[0]?.id ?? null,
      status: m?.status ?? 'entwurf',
      notiz_de: m?.notiz.de ?? '',
      notiz_en: m?.notiz.en ?? '',
      werte: Object.fromEntries(props.map(p => [p.kurzwort, wertEntwurf(p, m?.werte[p.kurzwort])])),
      links: (m?.links ?? []).map(l => ({ beschriftung: l.beschriftung, url: l.url }))
    };
  }

  let entwurf = $state(startEntwurf());
  const start = JSON.parse(JSON.stringify(startEntwurf()));
  let fehler = $state('');
  let laeuft = $state(false);

  function wertBody(p, w) {
    const body = {
      vermerk_de: w.ungeprueft ? (w.vermerk_de || 'ungeprüft') : null,
      vermerk_en: w.ungeprueft ? (w.vermerk_en || 'unverified') : null,
      quelle: w.quelle || null
    };
    if (p.typ === 'zahl') return { ...body, zahl: w.text.trim(), einheit: w.einheit.trim() || null };
    if (p.typ === 'text') return { ...body, text: w.text.trim() || null };
    if (p.typ === 'auswahl') return { ...body, option_id: w.option_id === '' ? null : Number(w.option_id) };
    return { ...body, ja_nein: w.ja_nein === '' ? null : w.ja_nein === 'ja' };
  }

  function geaendert(a, b) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  async function speichern(e) {
    e.preventDefault();
    fehler = '';
    laeuft = true;
    try {
      const felder = {
        name_de: entwurf.name_de,
        name_en: entwurf.name_en,
        hersteller: entwurf.hersteller,
        kategorie_id: Number(entwurf.kategorie_id),
        status: entwurf.status,
        notiz_de: entwurf.notiz_de,
        notiz_en: entwurf.notiz_en
      };
      let id = material?.id;
      if (neu) {
        id = (await api('POST', '/materialien', felder)).id;
      } else if (['name_de', 'name_en', 'hersteller', 'kategorie_id', 'status', 'notiz_de', 'notiz_en']
        .some(f => geaendert(entwurf[f], start[f]))) {
        await api('PATCH', `/materialien/${id}`, felder);
      }

      for (const p of props) {
        const w = entwurf.werte[p.kurzwort];
        if (neu ? w.text !== '' || w.option_id !== '' || w.ja_nein !== '' || w.ungeprueft : geaendert(w, start.werte[p.kurzwort])) {
          await api('PUT', `/materialien/${id}/werte/${p.kurzwort}`, wertBody(p, w));
        }
      }

      const links = entwurf.links.filter(l => l.beschriftung.trim() || l.url.trim());
      if (geaendert(links, start.links) && (links.length || !neu)) {
        await api('PUT', `/materialien/${id}/links`, { links });
      }
      onsaved(id);
    } catch (err) {
      fehler = err.message;
    } finally {
      laeuft = false;
    }
  }
</script>

<Dialog titel={neu ? 'Neues Material' : 'Material bearbeiten'} {onclose}>
  <form class="formular" onsubmit={speichern}>
    <section class="abschnitt">
      <h3>Grunddaten</h3>
      <div class="felder">
        <label class="feld">
          <span>Name</span>
          <input class="input" bind:value={entwurf.name_de} required />
        </label>
        <label class="feld">
          <span>Name (englisch, optional)</span>
          <input class="input" bind:value={entwurf.name_en} />
        </label>
        <label class="feld">
          <span>Hersteller</span>
          <input class="input" bind:value={entwurf.hersteller} />
        </label>
        <fieldset class="feld">
          <legend>Status</legend>
          <div class="pillen">
            <button type="button" class="pille" class:aktiv={entwurf.status === 'entwurf'} onclick={() => (entwurf.status = 'entwurf')}>Entwurf</button>
            <button type="button" class="pille" class:aktiv={entwurf.status === 'veroeffentlicht'} onclick={() => (entwurf.status = 'veroeffentlicht')}>Veröffentlicht</button>
          </div>
        </fieldset>
        <fieldset class="feld feld-voll">
          <legend>Kategorie</legend>
          <div class="pillen" role="radiogroup" aria-label="Kategorie">
            {#each kategorien as k (k.id)}
              <button type="button" class="pille" class:aktiv={entwurf.kategorie_id === k.id} role="radio" aria-checked={entwurf.kategorie_id === k.id}
                onclick={() => (entwurf.kategorie_id = k.id)}>
                <CategoryIcon name={k.icon} size={22} /> {k.name_de}
              </button>
            {/each}
          </div>
        </fieldset>
        <label class="feld">
          <span>Notiz</span>
          <input class="input" bind:value={entwurf.notiz_de} />
        </label>
        <label class="feld">
          <span>Notiz (englisch, optional)</span>
          <input class="input" bind:value={entwurf.notiz_en} />
        </label>
      </div>
    </section>

    <section class="abschnitt">
      <h3>Werte</h3>
      <div class="werte">
        {#each props as p (p.kurzwort)}
          {@const w = entwurf.werte[p.kurzwort]}
          <div class="wert-zeile">
            <div class="name">{p.name.de}{#if p.typ === 'zahl' && p.einheit} <small>({p.einheit})</small>{/if}</div>

            {#if p.typ === 'zahl'}
              <input class="input" inputmode="decimal" bind:value={w.text} aria-label={p.name.de} />
              <input class="input" bind:value={w.einheit} placeholder={p.einheit ?? 'Einheit'} aria-label="Einheit von {p.name.de}" />
            {:else if p.typ === 'text'}
              <input class="input" bind:value={w.text} aria-label={p.name.de} />
              <span></span>
            {:else if p.typ === 'auswahl'}
              <select class="input" bind:value={w.option_id} aria-label={p.name.de}>
                <option value="">–</option>
                {#each p.optionen as o (o.id)}
                  <option value={o.id}>{o.de}</option>
                {/each}
              </select>
              <span></span>
            {:else}
              <select class="input" bind:value={w.ja_nein} aria-label={p.name.de}>
                <option value="">–</option>
                <option value="ja">ja</option>
                <option value="nein">nein</option>
              </select>
              <span></span>
            {/if}

            <label class="haken" title="Wert als ungeprüft markieren">
              <input type="checkbox" bind:checked={w.ungeprueft} /> ungeprüft
            </label>
          </div>
        {/each}
      </div>
      <p class="hinweis">Leere Felder bleiben ohne Wert. Die Einheit gilt nur für diesen Eintrag.</p>
    </section>

    <section class="abschnitt">
      <h3>Links und Quellen</h3>
      {#each entwurf.links as l, i (i)}
        <div class="link-zeile">
          <input class="input" placeholder="Beschriftung" bind:value={l.beschriftung} aria-label="Beschriftung" />
          <input class="input" placeholder="https://…" bind:value={l.url} aria-label="Adresse" />
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => (entwurf.links = entwurf.links.filter((_, j) => j !== i))}>Entfernen</button>
        </div>
      {/each}
      <div>
        <button type="button" class="btn btn-outline btn-sm" disabled={entwurf.links.length >= 20}
          onclick={() => (entwurf.links = [...entwurf.links, { beschriftung: '', url: 'https://' }])}>
          Link hinzufügen
        </button>
      </div>
    </section>

    {#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}

    <div class="fusszeile">
      <button type="submit" class="btn btn-primary" disabled={laeuft || !entwurf.name_de.trim()}>{laeuft ? 'Speichere …' : 'Speichern'}</button>
      <button type="button" class="btn btn-ghost" onclick={onclose}>Abbrechen</button>
      <span class="abstand"></span>
      {#if !neu}
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => onduplicate(material)}>Kopieren</button>
        <button type="button" class="btn btn-ghost btn-sm gefahr" onclick={() => ondelete(material)}>Löschen</button>
      {/if}
    </div>
  </form>
</Dialog>
