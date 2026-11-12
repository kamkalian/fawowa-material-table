<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';

  // Verlauf der Änderungen (Git-Commits) und Abgleich mit dem Daten-Repository
  let eintraege = $state([]);
  let repo = $state(null);
  let fehler = $state('');
  let hinweis = $state('');
  let details = $state([]); // Fehler einzelner Dateien beim Laden aus dem Repo
  let beschaeftigt = $state(false);

  onMount(laden);

  async function laden() {
    try {
      [eintraege, repo] = await Promise.all([api('GET', '/protokoll?limit=200'), api('GET', '/repo')]);
    } catch (e) {
      fehler = e.message;
    }
  }

  async function aktion(pfad, erfolgstext) {
    beschaeftigt = true;
    fehler = '';
    hinweis = '';
    details = [];
    try {
      const r = await api('POST', pfad);
      hinweis = erfolgstext(r);
    } catch (e) {
      fehler = e.message;
      details = e.details ?? [];
    } finally {
      beschaeftigt = false;
      await laden();
    }
  }

  const ladenAusRepo = () => aktion('/repo/laden', r =>
    r.ergebnis === 'aktuell' ? 'Schon auf dem neuesten Stand.' : `${r.neueCommits} neue Änderungen geladen und geprüft (${r.materialien} Materialien).`);
  const senden = () => aktion('/repo/senden', () => 'Alle Änderungen sind im Repo.');

  function zeit(s) {
    return new Date(s).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  }
</script>

{#if repo?.verfuegbar === false}
  <p class="hinweis">Git ist auf dem Server nicht verfügbar. Die Daten werden ohne Verlauf gespeichert.</p>
{:else if repo}
  <div class="repo" class:problem={repo.pushFehler || repo.ladeFehler?.length}>
    {#if repo.remote}
      <p>
        <strong>Daten-Repository</strong> (Zweig {repo.zweig}, Stand {repo.kopf ?? '–'}):
        {#if repo.ahead > 0}<span class="warn">{repo.ahead} Änderungen noch nicht im Repo</span>{:else}alles im Repo{/if}
        {#if repo.behind > 0}· <span class="warn">{repo.behind} neue Änderungen im Repo</span>{/if}
      </p>
      <div class="knoepfe">
        <button class="btn btn-primary btn-sm" disabled={beschaeftigt} onclick={ladenAusRepo}>Aus dem Repo laden</button>
        <button class="btn btn-outline btn-sm" disabled={beschaeftigt || repo.ahead === 0} onclick={senden}>Jetzt ins Repo senden</button>
        <button class="btn btn-ghost btn-sm" disabled={beschaeftigt} onclick={laden}>Aktualisieren</button>
      </div>
      {#if repo.pushFehler}<p class="error" role="alert">{repo.pushFehler}</p>{/if}
    {:else}
      <p><strong>Kein Repository eingerichtet.</strong> Die Änderungen werden nur lokal als Commits gespeichert (DATEN_REPO in der .env setzen).</p>
    {/if}
    {#if repo.ladeFehler?.length}
      <p class="error" role="alert">
        Beim Laden der Dateien gab es {repo.ladeFehler.length} Fehler. Änderungen sind gesperrt, bis sie behoben sind.
      </p>
      <ul class="fehlerliste">
        {#each repo.ladeFehler as f}<li><code>{f.datei}</code>: {f.text}</li>{/each}
      </ul>
    {/if}
  </div>
{/if}

{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}
{#if fehler}<p class="error" role="alert">{fehler}</p>{/if}
{#if details.length}
  <ul class="fehlerliste">
    {#each details as f}<li><code>{f.datei}</code>: {f.text}</li>{/each}
  </ul>
{/if}

<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Zeit</th><th>Änderung</th><th>Commit</th></tr>
    </thead>
    <tbody>
      {#each eintraege as e (e.id)}
        <tr>
          <td class="nowrap">{zeit(e.zeitpunkt)}</td>
          <td>
            {e.betreff}
            {#if e.text}<pre class="text">{e.text}</pre>{/if}
          </td>
          <td class="nowrap"><code>{e.id}</code></td>
        </tr>
      {:else}
        <tr class="empty-row"><td colspan="3">Noch keine Änderungen.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .repo { border: 1px solid var(--border); border-radius: var(--radius); padding: .75rem 1rem; margin-bottom: 1rem; font-size: .875rem; }
  .repo.problem { border-color: var(--danger); }
  .repo p { margin-bottom: .5rem; }
  .knoepfe { display: flex; gap: .5rem; flex-wrap: wrap; }
  .warn { color: var(--amber); }
  .nowrap { white-space: nowrap; }
  .text { margin: .25rem 0 0; white-space: pre-wrap; color: var(--fg-muted); font: inherit; font-size: .75rem; }
  .fehlerliste { font-size: .8125rem; margin: .25rem 0 1rem 1.25rem; }
</style>
