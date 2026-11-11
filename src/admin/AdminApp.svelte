<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import Login from './Login.svelte';
  import Materialien from './Materialien.svelte';
  import Eigenschaften from './Eigenschaften.svelte';
  import Kategorien from './Kategorien.svelte';
  import Protokoll from './Protokoll.svelte';

  let angemeldet = $state(null); // null = prüfe noch
  let tab = $state('materialien');

  const TABS = [
    ['materialien', 'Materialien'],
    ['eigenschaften', 'Eigenschaften'],
    ['kategorien', 'Kategorien'],
    ['protokoll', 'Protokoll']
  ];

  onMount(() => {
    const abgemeldet = () => (angemeldet = false);
    window.addEventListener('admin-abgemeldet', abgemeldet);
    api('GET', '/sitzung')
      .then(d => (angemeldet = d.angemeldet))
      .catch(() => (angemeldet = false));
    return () => window.removeEventListener('admin-abgemeldet', abgemeldet);
  });

  async function abmelden() {
    try { await api('POST', '/logout', {}); } catch { /* Sitzung ist ohnehin weg */ }
    angemeldet = false;
  }
</script>

<header class="header">
  <div class="header-inner">
    <div>
      <h1 class="glow-text">Admin · Materialdatenbank</h1>
      <p class="header-sub"><a href="/">Zur öffentlichen Tabelle</a></p>
    </div>
    {#if angemeldet}
      <button class="btn btn-outline btn-sm" onclick={abmelden}>Abmelden</button>
    {/if}
  </div>
</header>

<main class="container page">
  {#if angemeldet === null}
    <p class="muted">Lade ...</p>
  {:else if !angemeldet}
    <Login onerfolg={() => (angemeldet = true)} />
  {:else}
    <nav class="tabs" role="tablist">
      {#each TABS as [key, label] (key)}
        <button class="tab" class:active={tab === key} role="tab" aria-selected={tab === key} onclick={() => (tab = key)}>
          {label}
        </button>
      {/each}
    </nav>

    {#if tab === 'materialien'}
      <Materialien />
    {:else if tab === 'eigenschaften'}
      <Eigenschaften />
    {:else if tab === 'kategorien'}
      <Kategorien />
    {:else}
      <Protokoll />
    {/if}
  {/if}
</main>

<style>
  .page { padding-top: 1.5rem; padding-bottom: 2rem; }
  .muted { color: var(--fg-muted); }
  .tabs { display: flex; gap: .25rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); }
  .tab {
    background: none; border: none; border-bottom: 2px solid transparent; color: var(--fg-muted);
    padding: .5rem .875rem; font: inherit; font-size: .875rem; cursor: pointer;
  }
  .tab.active { color: var(--primary); border-bottom-color: var(--primary); }
</style>
