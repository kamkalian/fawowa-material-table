<script>
  import Icon from '../shared/Icon.svelte';
  import { onMount } from 'svelte';
  import { t } from './lib/i18n.js';
  import { parseSearch, buildSearch, emptyState, LANGS } from './lib/url.js';
  import { filterMaterials, sortMaterials, unitsFor, filterLabel, gruppiere, alsEinzelne } from './lib/filter.js';
  import Toolbar from './components/Toolbar.svelte';
  import Chips from './components/Chips.svelte';
  import CategoryBar from './components/CategoryBar.svelte';
  import MaterialTable from './components/MaterialTable.svelte';
  import FilterDialog from './components/FilterDialog.svelte';
  import DetailView from './components/DetailView.svelte';
  import ReportDialog from './components/ReportDialog.svelte';
  import Support from './components/Support.svelte';

  let status = $state('loading'); // loading | ready | error
  let materials = $state([]);
  let props = $state([]);
  let kategorien = $state([]);
  let unterstuetzung = $state(null); // Angaben für den Bereich „Projekt unterstützen“ (aus der .env des Servers), sonst null
  let poweredBy = $state(null); // Betreiber der Firma für „Powered by“ am Seitenende
  let hauptseiteUrl = $state(null); // Adresse der Hauptseite für den Link im Kopf
  let adminPfad = $state(null); // Adresse des Admin-Bereichs für den dezenten Link am Seitenende
  let state = $state(emptyState());
  let ignored = $state(0);
  let dialog = $state(null); // null | { index } (index -1 = neuer Filter)
  let report = $state(null); // null | { mode: 'fehler', material } | { mode: 'vorschlag' }

  let lang = $derived(state.lang);
  let propMap = $derived(new Map(props.map(p => [p.kurzwort, p])));
  let filterable = $derived(props.filter(p => p.filterbar));
  let visibleProps = $derived(
    state.cols === null
      ? props.filter(p => p.standardSichtbar)
      : props.filter(p => state.cols.includes(p.kurzwort))
  );
  let visibleKeys = $derived(visibleProps.map(p => p.kurzwort));
  let rows = $derived(sortMaterials(filterMaterials(materials, state), state.sort, props, lang));
  // Zeilen der Tabelle: gleichnamige Materialien als Gruppe, sofern die Gruppierung an ist
  let items = $derived(state.flat ? alsEinzelne(rows) : gruppiere(rows));
  let offeneGruppen = $state([]); // Schlüssel der aufgeklappten Gruppen (nur in dieser Ansicht, nicht in der Adresse)
  let selected = $derived(state.m ? materials.find(m => m.id === state.m) ?? null : null);

  // Kategorien mit Anzahl der veröffentlichten Materialien; leere werden nicht angeboten
  let kategorieListe = $derived.by(() => {
    const anzahl = new Map();
    for (const m of materials) anzahl.set(m.kategorie.slug, (anzahl.get(m.kategorie.slug) ?? 0) + 1);
    return kategorien
      .map(k => ({ ...k, anzahl: anzahl.get(k.slug) ?? 0 }))
      .filter(k => k.anzahl > 0);
  });

  function getUnits(kw) {
    return unitsFor(materials, propMap.get(kw));
  }

  // Ändert den Zustand und schreibt ihn in die Adresse.
  // "replace" für Tippen in der Suche, damit die Browser-Historie nicht vollläuft.
  function update(patch, mode = 'push') {
    state = { ...state, ...patch };
    const url = location.pathname + buildSearch(state, props);
    if (url === location.pathname + location.search) return;
    if (mode === 'replace') history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  }

  function readUrl() {
    const parsed = parseSearch(location.search, props, kategorien.map(k => k.slug));
    ignored = parsed.fehler.length;
    return parsed.state;
  }

  function onPopState() {
    state = readUrl();
  }

  function setLang(l) {
    update({ lang: l });
    try { localStorage.setItem('lang', l); } catch { /* Speicher nicht verfügbar */ }
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignorieren */ }
  }

  function onSort(key) {
    const sort = state.sort?.key === key
      ? { key, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' };
    update({ sort });
  }

  function saveFilter(filter) {
    const filters = [...state.filters];
    if (dialog.index >= 0) filters[dialog.index] = filter;
    else filters.push(filter);
    dialog = null;
    update({ filters });
  }

  function removeFilter(i) {
    update({ filters: state.filters.filter((_, j) => j !== i) });
  }

  function resetFilters() {
    update({ q: '', cats: [], filters: [] });
  }

  function toggleGruppe(key) {
    offeneGruppen = offeneGruppen.includes(key) ? offeneGruppen.filter(k => k !== key) : [...offeneGruppen, key];
  }

  function toggleCategory(slug) {
    const cats = state.cats.includes(slug) ? [] : [slug]; // immer nur eine Kategorie aktiv
    update({ cats });
  }

  onMount(() => {
    window.addEventListener('popstate', onPopState);
    load();
    return () => window.removeEventListener('popstate', onPopState);
  });

  async function load() {
    try {
      const [mRes, eRes, kRes] = await Promise.all([
        fetch('/api/v2/materialien'),
        fetch('/api/v2/eigenschaften'),
        fetch('/api/v2/kategorien')
      ]);
      if (!mRes.ok || !eRes.ok || !kRes.ok) throw new Error('HTTP');
      materials = await mRes.json();
      props = await eRes.json();
      kategorien = await kRes.json();
    } catch {
      status = 'error';
      return;
    }

    // Ohne diese Angabe fehlt nur der Link zur Verwaltung, die Seite funktioniert trotzdem
    try {
      const res = await fetch('/api/v2/einstellungen');
      if (res.ok) {
        const einst = await res.json();
        hauptseiteUrl = einst.hauptseiteUrl ?? null;
        adminPfad = einst.adminPfad ?? null;
        unterstuetzung = einst.unterstuetzung ?? null;
        poweredBy = einst.poweredBy ?? null;
      }
    } catch { /* ignorieren */ }

    // Sprache: Adresse hat Vorrang, dann der Browser-Speicher, sonst Deutsch
    const urlHasLang = new URLSearchParams(location.search).has('lang');
    let saved = null;
    try { saved = localStorage.getItem('lang'); } catch { /* ignorieren */ }
    const parsed = readUrl();
    if (!urlHasLang && LANGS.includes(saved)) parsed.lang = saved;
    state = parsed;

    try {
      const theme = localStorage.getItem('theme');
      if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    } catch { /* ignorieren */ }

    history.replaceState(null, '', location.pathname + buildSearch(state, props));
    status = 'ready';
  }

  $effect(() => {
    document.documentElement.lang = lang;
    document.title = t(lang, 'title');
  });
</script>

<header class="header">
  <div class="header-inner">
    <div>
      <h1 class="glow-text">{t(lang, 'title')}</h1>
      {#if status === 'ready'}
        <p class="header-sub">{t(lang, 'results', rows.length, materials.length)}</p>
      {/if}
    </div>
    <div class="header-tools">
      {#if hauptseiteUrl}
        <a class="btn btn-ghost btn-sm" href={hauptseiteUrl}>{t(lang, 'backToMain')}</a>
      {/if}
      <div class="lang-switch" role="group" aria-label={t(lang, 'langSwitch')}>
        <button class="btn btn-sm {lang === 'de' ? 'btn-primary' : 'btn-ghost'}" aria-pressed={lang === 'de'} onclick={() => setLang('de')}>DE</button>
        <button class="btn btn-sm {lang === 'en' ? 'btn-primary' : 'btn-ghost'}" aria-pressed={lang === 'en'} onclick={() => setLang('en')}>EN</button>
      </div>
      <button class="btn btn-ghost btn-icon" title={t(lang, 'themeToggle')} aria-label={t(lang, 'themeToggle')} onclick={toggleTheme}>
        <Icon name="ui-moon" size={16} />
      </button>
    </div>
  </div>
</header>

<main class="container page">
  {#if status === 'loading'}
    <p class="muted">{t(lang, 'loading')}</p>
  {:else if status === 'error'}
    <p class="error">{t(lang, 'loadError')}</p>
  {:else}
    {#if kategorieListe.length > 1}
      <CategoryBar
        {lang}
        kategorien={kategorieListe}
        aktiv={state.cats}
        ontoggle={toggleCategory}
        onclear={() => update({ cats: [] })}
      />
    {/if}

    <Toolbar
      {lang}
      q={state.q}
      {props}
      {visibleKeys}
      onsearch={(v) => update({ q: v }, 'replace')}
      onaddfilter={() => (dialog = { index: -1 })}
      oncolumns={(keys) => update({ cols: keys })}
      gruppiert={!state.flat}
      ongruppen={() => update({ flat: !state.flat })}
      onsuggest={() => (report = { mode: 'vorschlag' })}
    />

    {#if ignored}
      <p class="hint" role="status">
        {t(lang, 'ignored', ignored)}
        <button class="btn btn-ghost btn-sm" onclick={() => (ignored = 0)}>{t(lang, 'dismiss')}</button>
      </p>
    {/if}

    <Chips
      {lang}
      filters={state.filters}
      {propMap}
      hasSearch={!!state.q || state.cats.length > 0}
      onedit={(i) => (dialog = { index: i })}
      onremove={removeFilter}
      onreset={resetFilters}
    />

    <MaterialTable
      {lang}
      {items}
      offen={offeneGruppen}
      columns={visibleProps}
      sort={state.sort}
      onsort={onSort}
      ontoggle={toggleGruppe}
      onopen={(id) => update({ m: id })}
      onreport={(m) => (report = { mode: 'fehler', material: m })}
    />

    {#if unterstuetzung}
      <Support {lang} angaben={unterstuetzung} onsuggest={() => (report = { mode: 'vorschlag' })} />
    {/if}

    <footer class="fuss">
      <p class="fuss-links">
        {#if poweredBy}
          <span class="powered">{t(lang, 'poweredBy')}
            {#if poweredBy.url}<a href={poweredBy.url} target="_blank" rel="noopener noreferrer">{poweredBy.name}</a>{:else}{poweredBy.name}{/if}</span>
        {/if}
        <a href="https://github.com/kamkalian/fawowa-material-table" target="_blank" rel="noopener noreferrer">{t(lang, 'sourceLink')}</a>
        <a href="https://github.com/kamkalian/fawowa-material-daten" target="_blank" rel="noopener noreferrer">{t(lang, 'dataLink')}</a>
        <a href={'/impressum' + (lang === 'en' ? '?lang=en' : '')}>{t(lang, 'imprintLink')}</a>
        <a href={'/datenschutz' + (lang === 'en' ? '?lang=en' : '')}>{t(lang, 'privacyLink')}</a>
        {#if adminPfad}
          <a class="verwaltung" href={adminPfad} rel="nofollow">{t(lang, 'adminLink')}</a>
        {/if}
      </p>
    </footer>
  {/if}
</main>

{#if dialog}
  <FilterDialog
    {lang}
    {filterable}
    {getUnits}
    initial={dialog.index >= 0 ? state.filters[dialog.index] : null}
    onsave={saveFilter}
    oncancel={() => (dialog = null)}
  />
{/if}

{#if selected}
  <DetailView
    {lang}
    material={selected}
    {props}
    blockiert={!!report}
    onclose={() => update({ m: null })}
    onreport={(m) => (report = { mode: 'fehler', material: m })}
  />
{/if}

{#if report}
  {#key report}
    <ReportDialog {lang} mode={report.mode} material={report.material ?? null} {props} {kategorien} onclose={() => (report = null)} />
  {/key}
{/if}

<style>
  .page { padding-top: 1.5rem; padding-bottom: 2rem; }
  .muted { color: var(--fg-muted); }
  .fuss { margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; align-items: flex-end; justify-content: space-between; }
  .powered { color: var(--fg-muted); }
  .fuss-links { display: flex; flex-wrap: wrap; gap: .25rem 1rem; margin-left: auto; font-size: .75rem; }
  .fuss-links a { color: var(--fg-muted); text-decoration: none; }
  .fuss-links a:hover, .fuss-links a:focus-visible { color: var(--fg); text-decoration: underline; }
  .verwaltung { opacity: .55; }
  .error { color: var(--danger); }
  .hint {
    display: flex; gap: .5rem; align-items: center; flex-wrap: wrap;
    font-size: .8125rem; color: var(--amber); margin-bottom: .75rem;
  }
</style>
