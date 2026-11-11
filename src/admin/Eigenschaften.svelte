<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import EigenschaftForm from './EigenschaftForm.svelte';

  const TYP_NAMEN = { zahl: 'Zahl', text: 'Text', auswahl: 'Auswahl', ja_nein: 'Ja/Nein' };

  let eigenschaften = $state([]);
  let geladen = $state(false);
  let fehler = $state('');
  let hinweis = $state('');
  let dialog = $state(null); // { eigenschaft } (null = neue Eigenschaft)

  onMount(laden);

  async function laden() {
    try {
      eigenschaften = await api('GET', '/eigenschaften');
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
    if (j < 0 || j >= eigenschaften.length) return;
    const reihenfolge = eigenschaften.map(e => e.kurzwort);
    [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]];
    fehler = '';
    try {
      eigenschaften = await api('PUT', '/eigenschaften/reihenfolge', { kurzworte: reihenfolge });
    } catch (e) {
      fehler = e.message;
    }
  }

  async function loeschen(e) {
    const n = e.anzahlWerte;
    const text = n
      ? `„${e.name.de}“ löschen? Dabei gehen ${n} Werte verloren. Das lässt sich nicht rückgängig machen.`
      : `„${e.name.de}“ löschen?`;
    if (!confirm(text)) return;
    fehler = '';
    try {
      await api('DELETE', `/eigenschaften/${e.id}?bestaetigt=${n}`);
      dialog = null;
      hinweis = `„${e.name.de}“ wurde gelöscht.`;
      await laden();
    } catch (err) {
      fehler = err.message;
    }
  }
</script>

<div class="page-kopf">
  <button class="btn btn-primary" onclick={() => (dialog = { eigenschaft: null })}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Eigenschaft hinzufügen
  </button>
  <span class="zaehler">{eigenschaften.length} Eigenschaften</span>
</div>

{#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}
{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if !geladen && !fehler}
  <p class="leer">Lade ...</p>
{:else if !eigenschaften.length}
  <p class="leer">Noch keine Eigenschaften.</p>
{:else}
  <ul class="liste">
    {#each eigenschaften as e, i (e.id)}
      <li class="eintrag-zeile">
        <div class="reihenfolge">
          <button class="btn btn-ghost btn-sm" aria-label="Nach oben" disabled={i === 0} onclick={() => verschiebe(i, -1)}>↑</button>
          <button class="btn btn-ghost btn-sm" aria-label="Nach unten" disabled={i === eigenschaften.length - 1} onclick={() => verschiebe(i, 1)}>↓</button>
        </div>
        <button class="eintrag" onclick={() => (dialog = { eigenschaft: e })}>
          <span class="haupt">
            <span class="titel">{e.name.de}</span>
            <span class="unter">
              {e.name.en ? `${e.name.en} · ` : ''}{e.kurzwort}{e.einheit ? ` · ${e.einheit}` : ''} · {e.anzahlWerte} Werte
              {e.standardSichtbar ? ' · Spalte sichtbar' : ''}{e.filterbar ? '' : ' · nicht filterbar'}
            </span>
          </span>
          <span class="rechts">
            <span class="badge badge-new">{TYP_NAMEN[e.typ]}</span>
            <span aria-hidden="true">›</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if dialog}
  {#key dialog}
    <EigenschaftForm
      eigenschaft={dialog.eigenschaft}
      alle={eigenschaften}
      onsaved={gespeichert}
      onclose={() => (dialog = null)}
      ondelete={loeschen}
    />
  {/key}
{/if}
