<script>
  import { api } from './api.js';
  import Dialog from './Dialog.svelte';

  // eigenschaft: bestehende Eigenschaft oder null zum Anlegen; alle: Liste aller Eigenschaften (für Zusammenführen)
  let { eigenschaft, alle, onsaved, onclose, ondelete } = $props();

  const neu = eigenschaft === null;
  const TYPEN = [
    ['zahl', 'Zahl mit Einheit'],
    ['text', 'Text'],
    ['auswahl', 'Auswahl'],
    ['ja_nein', 'Ja/Nein']
  ];

  function startEntwurf() {
    const e = eigenschaft;
    return {
      kurzwort: e?.kurzwort ?? '',
      name_de: e?.name.de ?? '',
      name_en: e?.name.en ?? '',
      typ: e?.typ ?? 'zahl',
      standard_einheit: e?.einheit ?? '',
      standard_sichtbar: e?.standardSichtbar ?? false,
      filterbar: e?.filterbar ?? true,
      mehrfach: e?.mehrfach ?? false,
      optionen: (e?.optionen ?? []).map(o => ({ id: o.id, de: o.de, en: o.en ?? '' }))
    };
  }

  let entwurf = $state(startEntwurf());
  const start = JSON.parse(JSON.stringify(startEntwurf()));
  let fehler = $state('');
  let laeuft = $state(false);
  let zielId = $state('');

  let ziele = $derived(
    neu ? [] : alle.filter(x => x.id !== eigenschaft.id && x.typ === eigenschaft.typ)
  );

  const geaendert = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

  async function speichern(e) {
    e.preventDefault();
    fehler = '';
    laeuft = true;
    try {
      const felder = {
        name_de: entwurf.name_de,
        name_en: entwurf.name_en,
        standard_einheit: entwurf.typ === 'zahl' ? entwurf.standard_einheit : '',
        standard_sichtbar: entwurf.standard_sichtbar,
        filterbar: entwurf.filterbar,
        mehrfach: entwurf.typ === 'auswahl' && entwurf.mehrfach
      };
      let id = eigenschaft?.id;
      if (neu) {
        id = (await api('POST', '/eigenschaften', { ...felder, kurzwort: entwurf.kurzwort.trim(), typ: entwurf.typ })).id;
      } else if (['name_de', 'name_en', 'standard_einheit', 'standard_sichtbar', 'filterbar', 'mehrfach'].some(f => geaendert(entwurf[f], start[f]))) {
        await api('PATCH', `/eigenschaften/${id}`, felder);
      }
      if (entwurf.typ === 'auswahl' && (neu ? entwurf.optionen.length : geaendert(entwurf.optionen, start.optionen))) {
        await api('PUT', `/eigenschaften/${id}/optionen`, { optionen: entwurf.optionen });
      }
      onsaved();
    } catch (err) {
      fehler = err.message;
    } finally {
      laeuft = false;
    }
  }

  async function zusammenfuehren() {
    const ziel = ziele.find(z => z.id === Number(zielId));
    if (!ziel) return;
    if (!confirm(`„${eigenschaft.name.de}“ wird in „${ziel.name.de}“ überführt und danach gelöscht. Werte, die bei beiden vorkommen, bleiben nur bei „${ziel.name.de}“. Fortfahren?`)) return;
    fehler = '';
    try {
      await api('POST', `/eigenschaften/${eigenschaft.id}/zusammenfuehren`, { ziel: ziel.id });
      onsaved();
    } catch (err) {
      fehler = err.message;
    }
  }
</script>

<Dialog titel={neu ? 'Neue Eigenschaft' : 'Eigenschaft bearbeiten'} {onclose}>
  <form class="formular" onsubmit={speichern}>
    <section class="abschnitt">
      <h3>Grunddaten</h3>
      <div class="felder">
        <label class="feld">
          <span>Name</span>
          <input class="input" bind:value={entwurf.name_de} required />
        </label>
        <label class="feld">
          <span>Name (englisch)</span>
          <input class="input" bind:value={entwurf.name_en} />
        </label>

        {#if neu}
          <label class="feld">
            <span>Kurzwort (für Links, später nicht änderbar)</span>
            <input class="input" bind:value={entwurf.kurzwort} placeholder="z. B. brandklasse" required />
          </label>
          <label class="feld">
            <span>Typ (später nicht änderbar)</span>
            <select class="input" bind:value={entwurf.typ}>
              {#each TYPEN as [wert, label] (wert)}<option value={wert}>{label}</option>{/each}
            </select>
          </label>
        {:else}
          <div class="feld">
            <span>Kurzwort</span>
            <code>{eigenschaft.kurzwort}</code>
          </div>
          <div class="feld">
            <span>Typ</span>
            <span>{TYPEN.find(t => t[0] === eigenschaft.typ)?.[1]}</span>
          </div>
        {/if}

        {#if entwurf.typ === 'zahl'}
          <label class="feld">
            <span>Standard-Einheit</span>
            <input class="input" bind:value={entwurf.standard_einheit} placeholder="z. B. mm" />
          </label>
        {/if}
      </div>
      <label class="haken"><input type="checkbox" bind:checked={entwurf.standard_sichtbar} /> Standardmäßig als Spalte sichtbar</label>
      <label class="haken"><input type="checkbox" bind:checked={entwurf.filterbar} /> Filterbar</label>
    </section>

    {#if entwurf.typ === 'auswahl'}
      <section class="abschnitt">
        <h3>Auswahlmöglichkeiten</h3>
        <label class="haken"><input type="checkbox" bind:checked={entwurf.mehrfach} /> Mehrfachauswahl (ein Material kann mehrere davon haben, z. B. bei Verbundplatten)</label>
        {#each entwurf.optionen as o, i (i)}
          <div class="option-zeile">
            <input class="input" placeholder="Deutsch" bind:value={o.de} aria-label="Deutsch" />
            <input class="input" placeholder="Englisch" bind:value={o.en} aria-label="Englisch" />
            <button type="button" class="btn btn-ghost btn-sm" onclick={() => (entwurf.optionen = entwurf.optionen.filter((_, j) => j !== i))}>Entfernen</button>
          </div>
        {/each}
        <div>
          <button type="button" class="btn btn-outline btn-sm" onclick={() => (entwurf.optionen = [...entwurf.optionen, { de: '', en: '' }])}>
            Option hinzufügen
          </button>
        </div>
      </section>
    {/if}

    {#if !neu && eigenschaft.typ !== 'auswahl'}
      <section class="abschnitt">
        <h3>Zusammenführen</h3>
        {#if ziele.length}
          <div class="zusammen-zeile">
            <select class="input" bind:value={zielId} aria-label="In diese Eigenschaft überführen">
              <option value="">In welche Eigenschaft überführen? …</option>
              {#each ziele as z (z.id)}<option value={z.id}>{z.name.de} ({z.kurzwort})</option>{/each}
            </select>
            <button type="button" class="btn btn-outline btn-sm" disabled={!zielId} onclick={zusammenfuehren}>Zusammenführen</button>
          </div>
          <p class="hinweis">Nützlich bei doppelten Eigenschaften. Alle Werte wandern in die Ziel-Eigenschaft, diese hier wird danach gelöscht.</p>
        {:else}
          <p class="hinweis">Es gibt keine andere Eigenschaft desselben Typs.</p>
        {/if}
      </section>
    {/if}

    {#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}

    <div class="fusszeile">
      <button type="submit" class="btn btn-primary" disabled={laeuft || !entwurf.name_de.trim()}>{laeuft ? 'Speichere …' : 'Speichern'}</button>
      <button type="button" class="btn btn-ghost" onclick={onclose}>Abbrechen</button>
      <span class="abstand"></span>
      {#if !neu}
        <button type="button" class="btn btn-ghost btn-sm gefahr" onclick={() => ondelete(eigenschaft)}>Löschen</button>
      {/if}
    </div>
  </form>
</Dialog>

<style>
  .option-zeile { display: grid; grid-template-columns: 1fr 1fr auto; gap: .5rem; align-items: center; }
  .zusammen-zeile { display: flex; gap: .5rem; flex-wrap: wrap; }
  .zusammen-zeile select { flex: 1 1 240px; }
  code { font-size: .8125rem; }
</style>
