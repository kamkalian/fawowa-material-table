<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';

  let eintraege = $state([]);
  let fehler = $state('');

  onMount(laden);

  async function laden() {
    try {
      eintraege = await api('GET', '/protokoll?limit=300');
      fehler = '';
    } catch (e) {
      fehler = e.message;
    }
  }

  function zeit(s) {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  }

  function wert(v) {
    if (v === null || v === undefined) return '–';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  }
</script>

<div class="toolbar">
  <button class="btn btn-outline btn-sm" onclick={laden}>Aktualisieren</button>
  <span class="muted">Die letzten {eintraege.length} Änderungen</span>
</div>

{#if fehler}<p class="error" role="alert">{fehler}</p>{/if}

<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Zeit</th><th>Material</th><th>Feld</th><th>Vorher</th><th>Nachher</th></tr>
    </thead>
    <tbody>
      {#each eintraege as e (e.id)}
        <tr>
          <td class="nowrap">{zeit(e.zeitpunkt)}</td>
          <td>{e.material_name ?? '–'}</td>
          <td><code>{e.feld}</code></td>
          <td class="wertzelle">{wert(e.alt)}</td>
          <td class="wertzelle">{wert(e.neu)}</td>
        </tr>
      {:else}
        <tr class="empty-row"><td colspan="5">Noch keine Änderungen.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .toolbar { display: flex; gap: .75rem; align-items: center; margin-bottom: .75rem; }
  .muted { color: var(--fg-muted); font-size: .8125rem; }
  .error { color: var(--danger); font-size: .8125rem; margin-bottom: .5rem; }
  .nowrap { white-space: nowrap; }
  .wertzelle { max-width: 280px; word-break: break-word; font-size: .75rem; }
  code { font-size: .75rem; }
</style>
