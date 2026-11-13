<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import Login from './Login.svelte';
  import Materialien from './Materialien.svelte';
  import Eigenschaften from './Eigenschaften.svelte';
  import Kategorien from './Kategorien.svelte';
  import Protokoll from './Protokoll.svelte';
  import Meldungen from './Meldungen.svelte';
  import Links from './Links.svelte';
  import Unterstuetzer from './Unterstuetzer.svelte';

  let angemeldet = $state(null); // null = prüfe noch
  let tab = $state('materialien');
  let offen = $state(0); // Zahl der offenen Meldungen für die Navigation
  let kaputt = $state(0); // Zahl der nicht erreichbaren Links für die Navigation
  let oeffneId = $state(null); // Material, das in der Materialliste gleich geöffnet werden soll

  const TABS = [
    ['meldungen', 'Meldungen'],
    ['materialien', 'Materialien'],
    ['eigenschaften', 'Eigenschaften'],
    ['kategorien', 'Kategorien'],
    ['links', 'Links'],
    ['unterstuetzer', 'Unterstützer'],
    ['protokoll', 'Protokoll und Repo']
  ];

  onMount(() => {
    const abgemeldet = () => (angemeldet = false);
    window.addEventListener('admin-abgemeldet', abgemeldet);
    api('GET', '/sitzung')
      .then(d => (angemeldet = d.angemeldet))
      .catch(() => (angemeldet = false));
    return () => window.removeEventListener('admin-abgemeldet', abgemeldet);
  });

  // Zähler nach der Anmeldung laden und beim Wechsel der Reiter auffrischen
  $effect(() => {
    if (angemeldet && tab) {
      api('GET', '/meldungen/zaehler').then(d => (offen = d.offen)).catch(() => {});
      api('GET', '/links/zaehler').then(d => (kaputt = d.kaputt)).catch(() => {});
    }
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
        <button class="tab" class:active={tab === key} role="tab" aria-selected={tab === key} onclick={() => { oeffneId = null; tab = key; }}>
          {label}
          {#if key === 'meldungen' && offen > 0}<span class="zaehler" aria-label="{offen} offen">{offen}</span>{/if}
          {#if key === 'links' && kaputt > 0}<span class="zaehler" aria-label="{kaputt} nicht erreichbar">{kaputt}</span>{/if}
        </button>
      {/each}
    </nav>

    {#if tab === 'meldungen'}
      <Meldungen onzaehler={(n) => (offen = n)} />
    {:else if tab === 'materialien'}
      {#key oeffneId}<Materialien {oeffneId} />{/key}
    {:else if tab === 'links'}
      <Links onzaehler={(n) => (kaputt = n)} onmaterial={(id) => { oeffneId = id; tab = 'materialien'; }} />
    {:else if tab === 'unterstuetzer'}
      <Unterstuetzer />
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
  .zaehler {
    display: inline-block; min-width: 1.25rem; padding: 0 .4rem; margin-left: .35rem; border-radius: 999px;
    background: var(--danger); color: #fff; font-size: .6875rem; font-weight: 600; line-height: 1.25rem; text-align: center;
  }
</style>
