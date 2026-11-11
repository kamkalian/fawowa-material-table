<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import { formatValue } from '../public/lib/filter.js';
  import CategoryIcon from '../shared/CategoryIcon.svelte';
  import MaterialForm from './MaterialForm.svelte';

  let materials = $state([]);
  let props = $state([]);
  let kategorien = $state([]);
  let geladen = $state(false);
  let fehler = $state('');
  let hinweis = $state('');
  let suche = $state('');
  let kategorieFilter = $state(null);
  let statusFilter = $state('alle'); // alle | entwurf | veroeffentlicht
  let nurUngeprueft = $state(false); // nur Materialien mit Werten, die als ungeprüft markiert sind
  let dialog = $state(null); // { material } (null = neues Material)

  let gefiltert = $derived(
    materials.filter(m => {
      const q = suche.trim().toLowerCase();
      if (q && ![m.name.de, m.name.en, m.hersteller].some(s => s && s.toLowerCase().includes(q))) return false;
      if (kategorieFilter !== null && m.kategorie.id !== kategorieFilter) return false;
      if (statusFilter !== 'alle' && m.status !== statusFilter) return false;
      if (nurUngeprueft && !ungeprueftNamen(m).length) return false;
      return true;
    })
  );

  // Namen der Eigenschaften, deren Wert bei diesem Material als ungeprüft markiert ist (Vermerk)
  function ungeprueftNamen(m) {
    return props.filter(p => m.werte[p.kurzwort]?.vermerk).map(p => p.name.de);
  }
  let anzahlUngeprueft = $derived(materials.filter(m => ungeprueftNamen(m).length > 0).length);

  // Die wichtigsten Werte als Kurzfassung unter dem Namen
  let kurzProps = $derived(props.filter(p => p.standardSichtbar));

  onMount(laden);

  async function laden() {
    try {
      const [m, e, k] = await Promise.all([
        api('GET', '/materialien'),
        api('GET', '/eigenschaften'),
        api('GET', '/kategorien')
      ]);
      materials = m;
      props = e;
      kategorien = k;
      geladen = true;
    } catch (err) {
      fehler = err.message;
    }
  }

  function kurzfassung(m) {
    return kurzProps
      .map(p => formatValue(p, m.werte[p.kurzwort], 'de'))
      .filter(Boolean)
      .join(' · ');
  }

  async function gespeichert(id) {
    dialog = null;
    hinweis = 'Gespeichert.';
    await laden();
    void id;
  }

  async function duplizieren(m) {
    fehler = '';
    try {
      const res = await api('POST', `/materialien/${m.id}/duplizieren`);
      await laden();
      // Die Kopie gleich zum Anpassen öffnen (z. B. andere Stärke)
      dialog = { material: materials.find(x => x.id === res.id) ?? null };
      hinweis = '';
    } catch (e) {
      fehler = e.message;
    }
  }

  async function loeschen(m) {
    if (!confirm(`„${m.name.de}“ wirklich löschen? Die Werte und Links gehen dabei verloren.`)) return;
    fehler = '';
    try {
      await api('DELETE', `/materialien/${m.id}`);
      dialog = null;
      hinweis = `„${m.name.de}“ wurde gelöscht.`;
      await laden();
    } catch (e) {
      fehler = e.message;
    }
  }
</script>

<div class="page-kopf">
  <input class="input suche" type="search" placeholder="Suchen nach Name oder Hersteller" bind:value={suche} aria-label="Materialien suchen" />
  <button class="btn btn-primary" onclick={() => (dialog = { material: null })}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Material hinzufügen
  </button>
  <span class="zaehler">{gefiltert.length} von {materials.length}</span>
</div>

<div class="filter-zeile">
  <div class="pillen" role="group" aria-label="Nach Kategorie filtern">
    <button class="pille" class:aktiv={kategorieFilter === null} onclick={() => (kategorieFilter = null)}>Alle</button>
    {#each kategorien as k (k.id)}
      <button class="pille" class:aktiv={kategorieFilter === k.id} onclick={() => (kategorieFilter = kategorieFilter === k.id ? null : k.id)}>
        <CategoryIcon name={k.icon} size={20} /> {k.name_de}
      </button>
    {/each}
  </div>
  <div class="pillen" role="group" aria-label="Nach Status filtern">
    {#each [['alle', 'Alle Status'], ['veroeffentlicht', 'Veröffentlicht'], ['entwurf', 'Entwürfe']] as [wert, label] (wert)}
      <button class="pille" class:aktiv={statusFilter === wert} onclick={() => (statusFilter = wert)}>{label}</button>
    {/each}
    <button class="pille pille-warnung" class:aktiv={nurUngeprueft} aria-pressed={nurUngeprueft} onclick={() => (nurUngeprueft = !nurUngeprueft)}>
      Mit ungeprüften Werten ({anzahlUngeprueft})
    </button>
  </div>
</div>

{#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}
{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if !geladen && !fehler}
  <p class="leer">Lade ...</p>
{:else if !gefiltert.length}
  <p class="leer">Keine Materialien gefunden.</p>
{:else}
  <ul class="liste">
    {#each gefiltert as m (m.id)}
      <li>
        <button class="eintrag" class:entwurf={m.status !== 'veroeffentlicht'} onclick={() => (dialog = { material: m })}>
          <CategoryIcon name={m.kategorie.icon} size={32} title={m.kategorie.name.de} />
          <span class="haupt">
            <span class="titel">{m.name.de}</span>
            <span class="unter">
              {m.kategorie.name.de}{m.hersteller ? ` · ${m.hersteller}` : ''}{kurzfassung(m) ? ` · ${kurzfassung(m)}` : ''}
            </span>
            {#if ungeprueftNamen(m).length}
              <span class="unter warnung">Ungeprüft: {ungeprueftNamen(m).join(', ')}</span>
            {/if}
          </span>
          <span class="rechts">
            {#if ungeprueftNamen(m).length}
              <span class="badge badge-check" title="Ungeprüft: {ungeprueftNamen(m).join(', ')}">{ungeprueftNamen(m).length} ungeprüft</span>
            {/if}
            {#if m.status !== 'veroeffentlicht'}<span class="badge badge-check">Entwurf</span>{/if}
            <span aria-hidden="true">›</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if dialog}
  <!-- Neu aufbauen, wenn ein anderes Material geöffnet wird (z. B. nach dem Kopieren) -->
  {#key dialog}
    <MaterialForm
      material={dialog.material}
      {props}
      {kategorien}
      onsaved={gespeichert}
      onclose={() => (dialog = null)}
      onduplicate={duplizieren}
      ondelete={loeschen}
    />
  {/key}
{/if}

<style>
  .filter-zeile { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
  /* Hinweis auf ungeprüfte Werte in der Liste und im Filter */
  .liste :global(.unter.warnung) { color: var(--amber); }
  .pille-warnung.aktiv { border-color: var(--amber); background: var(--amber-bg); color: var(--amber); }
</style>
