<script>
  import { api } from './api.js';
  import Dialog from './Dialog.svelte';
  import IconPicker from './IconPicker.svelte';
  import CategoryIcon from '../shared/CategoryIcon.svelte';

  // kategorie: bestehende Kategorie (Rohdaten der Admin-API) oder null zum Anlegen
  let { kategorie, onsaved, onclose, ondelete } = $props();

  const neu = kategorie === null;

  let entwurf = $state({
    name_de: kategorie?.name_de ?? '',
    name_en: kategorie?.name_en ?? '',
    icon: kategorie?.icon ?? 'circle'
  });
  let fehler = $state('');
  let laeuft = $state(false);

  async function speichern(e) {
    e.preventDefault();
    fehler = '';
    laeuft = true;
    try {
      if (neu) await api('POST', '/kategorien', entwurf);
      else await api('PATCH', `/kategorien/${kategorie.id}`, entwurf);
      onsaved();
    } catch (err) {
      fehler = err.message;
    } finally {
      laeuft = false;
    }
  }
</script>

<Dialog titel={neu ? 'Neue Kategorie' : 'Kategorie bearbeiten'} {onclose}>
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
      </div>
    </section>

    <section class="abschnitt">
      <h3>Icon <span class="vorschau"><CategoryIcon name={entwurf.icon} size={32} /></span></h3>
      <IconPicker value={entwurf.icon} onchange={(name) => (entwurf.icon = name)} />
      <p class="hinweis">Das Icon erscheint in der öffentlichen Tabelle, in der Detailansicht und hier im Admin-Bereich.</p>
    </section>

    {#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}

    <div class="fusszeile">
      <button type="submit" class="btn btn-primary" disabled={laeuft || !entwurf.name_de.trim()}>{laeuft ? 'Speichere …' : 'Speichern'}</button>
      <button type="button" class="btn btn-ghost" onclick={onclose}>Abbrechen</button>
      <span class="abstand"></span>
      {#if !neu}
        <button type="button" class="btn btn-ghost btn-sm gefahr" disabled={kategorie.anzahlMaterialien > 0}
          title={kategorie.anzahlMaterialien > 0 ? 'Die Kategorie wird noch verwendet' : ''}
          onclick={() => ondelete(kategorie)}>
          Löschen
        </button>
      {/if}
    </div>
  </form>
</Dialog>

<style>
  .vorschau { margin-left: .5rem; vertical-align: middle; }
</style>
