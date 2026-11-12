<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';

  // Übersicht aller Links mit Prüfergebnis. Nicht erreichbare stehen oben. onzaehler meldet die Zahl der kaputten Links
  // für die Navigation, onmaterial öffnet das Material zum Korrigieren.
  let { onzaehler, onmaterial } = $props();

  let links = $state([]);
  let laeuft = $state(false);
  let geladen = $state(false);
  let fehler = $state('');
  let hinweis = $state('');
  let filter = $state('probleme'); // probleme | alle

  const STATUS = {
    kaputt: { text: 'Nicht erreichbar', klasse: 'kaputt' },
    unklar: { text: 'Unklar (Seite blockt Abfragen)', klasse: 'unklar' },
    ok: { text: 'Erreichbar', klasse: 'ok' },
    offen: { text: 'Noch nicht geprüft', klasse: 'offen' }
  };
  const statusVon = (l) => STATUS[l.status ?? 'offen'];

  let zahl = $derived({
    kaputt: links.filter(l => l.status === 'kaputt').length,
    unklar: links.filter(l => l.status === 'unklar').length,
    offen: links.filter(l => !l.status).length,
    ok: links.filter(l => l.status === 'ok').length
  });
  let sichtbar = $derived(filter === 'alle' ? links : links.filter(l => l.status !== 'ok'));
  let letztePruefung = $derived(links.map(l => l.geprueft_am).filter(Boolean).sort().at(-1) ?? null);

  onMount(laden);

  async function laden() {
    try {
      const d = await api('GET', '/links');
      links = d.links;
      laeuft = d.laeuft;
      geladen = true;
      fehler = '';
      onzaehler?.(zahl.kaputt);
    } catch (e) {
      fehler = e.message;
    }
  }

  async function pruefen() {
    laeuft = true;
    hinweis = '';
    fehler = '';
    try {
      const s = await api('POST', '/links/pruefen');
      hinweis = `Geprüft: ${s.ok} erreichbar, ${s.unklar} unklar, ${s.kaputt} nicht erreichbar.`;
    } catch (e) {
      fehler = e.message;
    } finally {
      laeuft = false;
      await laden();
    }
  }

  function zeit(s) {
    return s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
  }
</script>

<div class="kopf">
  <button class="btn btn-primary" disabled={laeuft} onclick={pruefen}>{laeuft ? 'Prüfe Links ...' : 'Jetzt prüfen'}</button>
  <div class="pillen" role="group" aria-label="Anzeige">
    <button class="pille" class:aktiv={filter === 'probleme'} onclick={() => (filter = 'probleme')}>
      Nur Probleme ({zahl.kaputt + zahl.unklar + zahl.offen})
    </button>
    <button class="pille" class:aktiv={filter === 'alle'} onclick={() => (filter = 'alle')}>Alle ({links.length})</button>
  </div>
  <span class="hinweis">Letzte Prüfung: {zeit(letztePruefung)} · Der Server prüft täglich automatisch.</span>
</div>

{#if fehler}<p class="error" role="alert">{fehler}</p>{/if}
{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if geladen && zahl.kaputt === 0}
  <p class="alles-gut" role="status">Alle geprüften Links sind erreichbar.</p>
{/if}

<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Status</th><th>Material</th><th>Link</th><th>Geprüft</th></tr>
    </thead>
    <tbody>
      {#each sichtbar as l (l.id)}
        {@const s = statusVon(l)}
        <tr>
          <td class="nowrap"><span class="punkt {s.klasse}" aria-hidden="true"></span> {s.text}</td>
          <td>
            <button class="material-btn" onclick={() => onmaterial(l.material_id)} title="Material öffnen und Link korrigieren">
              {l.material_name}
            </button>
          </td>
          <td class="adresse">
            {l.beschriftung}<br />
            <a href={l.url} target="_blank" rel="noopener noreferrer nofollow">{l.url}</a>
          </td>
          <td class="nowrap">{zeit(l.geprueft_am)}</td>
        </tr>
      {:else}
        <tr class="empty-row"><td colspan="4">{geladen ? 'Keine Links in dieser Ansicht.' : 'Lade ...'}</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .kopf { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-bottom: .75rem; }
  .hinweis { color: var(--fg-muted); font-size: .75rem; }
  .alles-gut { color: var(--primary); font-size: .875rem; margin-bottom: .75rem; }
  .nowrap { white-space: nowrap; }
  .adresse { word-break: break-all; font-size: .8125rem; }
  .adresse a { color: var(--primary); }
  .material-btn { background: none; border: none; color: var(--fg); font: inherit; cursor: pointer; padding: 0; text-align: left; }
  .material-btn:hover { color: var(--primary); text-decoration: underline; }
  .punkt { display: inline-block; width: .5rem; height: .5rem; border-radius: 50%; margin-right: .25rem; background: var(--fg-muted); }
  .punkt.ok { background: var(--primary); }
  .punkt.unklar { background: var(--amber); }
  .punkt.kaputt { background: var(--danger); }
</style>
