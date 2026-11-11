<script>
  import Icon from '../shared/Icon.svelte';
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import CategoryIcon from '../shared/CategoryIcon.svelte';
  import KategorieForm from './KategorieForm.svelte';

  let kategorien = $state([]);
  let geladen = $state(false);
  let fehler = $state('');
  let hinweis = $state('');
  let dialog = $state(null); // { kategorie } (null = neue Kategorie)

  onMount(laden);

  async function laden() {
    try {
      kategorien = await api('GET', '/kategorien');
      geladen = true;
    } catch (e) {
      fehler = e.message;
    }
  }

  async function gespeichert() {
    dialog = null;
    hinweis = 'Gespeichert.';
    await laden();
  }

  async function verschiebe(i, richtung) {
    const j = i + richtung;
    if (j < 0 || j >= kategorien.length) return;
    const ids = kategorien.map(k => k.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    fehler = '';
    try {
      kategorien = await api('PUT', '/kategorien/reihenfolge', { ids });
    } catch (e) {
      fehler = e.message;
    }
  }

  async function loeschen(k) {
    if (!confirm(`Kategorie „${k.name_de}“ löschen?`)) return;
    fehler = '';
    try {
      await api('DELETE', `/kategorien/${k.id}`);
      dialog = null;
      hinweis = `„${k.name_de}“ wurde gelöscht.`;
      await laden();
    } catch (e) {
      fehler = e.message;
    }
  }
</script>

<div class="page-kopf">
  <button class="btn btn-primary" onclick={() => (dialog = { kategorie: null })}>
    <Icon name="ui-plus" size={14} />
    Kategorie hinzufügen
  </button>
  <span class="zaehler">{kategorien.length} Kategorien</span>
</div>

{#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}
{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if !geladen && !fehler}
  <p class="leer">Lade ...</p>
{:else if !kategorien.length}
  <p class="leer">Noch keine Kategorien.</p>
{:else}
  <ul class="liste">
    {#each kategorien as k, i (k.id)}
      <li class="eintrag-zeile">
        <div class="reihenfolge">
          <button class="btn btn-ghost btn-sm" aria-label="Nach oben" disabled={i === 0} onclick={() => verschiebe(i, -1)}>↑</button>
          <button class="btn btn-ghost btn-sm" aria-label="Nach unten" disabled={i === kategorien.length - 1} onclick={() => verschiebe(i, 1)}>↓</button>
        </div>
        <button class="eintrag" onclick={() => (dialog = { kategorie: k })}>
          <CategoryIcon name={k.icon} size={36} />
          <span class="haupt">
            <span class="titel">{k.name_de}</span>
            <span class="unter">{k.name_en ? `${k.name_en} · ` : ''}{k.anzahlMaterialien} Materialien</span>
          </span>
          <span class="rechts" aria-hidden="true">›</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if dialog}
  {#key dialog}
    <KategorieForm
      kategorie={dialog.kategorie}
      onsaved={gespeichert}
      onclose={() => (dialog = null)}
      ondelete={loeschen}
    />
  {/key}
{/if}
