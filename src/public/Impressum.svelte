<script>
  import { onMount } from 'svelte';
  import { t } from './lib/i18n.js';
  import { startSprache, speichereSprache, wechsleDesign } from './lib/seite.js';
  import SeitenKopf from './components/SeitenKopf.svelte';

  // Impressum nach § 5 DDG. Die Angaben zum Betreiber kommen vom Server (OPERATOR in der .env).
  let lang = $state(startSprache());
  let betreiber = $state(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/v2/einstellungen');
      if (res.ok) betreiber = (await res.json()).betreiber ?? null;
    } catch { /* ohne Angaben erscheint ein Hinweis */ }
  });

  const TEXTE = {
    de: {
      titel: 'Impressum',
      angaben: 'Angaben gemäß § 5 DDG',
      verantwortlich: 'Verantwortlich für den Inhalt',
      fehlt: 'Die Angaben zum Betreiber sind noch nicht eingetragen.',
      haftungTitel: 'Hinweis zu den Angaben',
      haftung: [
        'Die Materialangaben in dieser Datenbank stammen aus Herstellerangaben, Quellen im Internet und Hinweisen von Besuchern. Sie wurden mit Sorgfalt zusammengetragen, aber nicht alle sind geprüft (solche Werte sind als „ungeprüft“ gekennzeichnet). Alle Angaben sind ohne Gewähr.',
        'Prüfe vor dem Bauen die Werte, auf die es ankommt, besonders bei tragenden und sicherheitsrelevanten Teilen, selbst nach, zum Beispiel beim Hersteller.'
      ],
      datenschutz: 'Datenschutz',
      tabelle: 'Zur Tabelle'
    },
    en: {
      titel: 'Legal notice',
      angaben: 'Information according to § 5 DDG (German Digital Services Act)',
      verantwortlich: 'Responsible for the content',
      fehlt: 'The operator details have not been entered yet.',
      haftungTitel: 'Note on the information',
      haftung: [
        'The material data in this database comes from manufacturer information, sources on the internet and tips from visitors. It was compiled with care, but not all of it is verified (such values are marked “unverified”). All information is provided without guarantee.',
        'Before building, check the values that matter to you yourself, for example with the manufacturer, especially for load-bearing and safety-relevant parts.'
      ],
      datenschutz: 'Privacy',
      tabelle: 'Back to the table'
    }
  };
  let inhalt = $derived(TEXTE[lang]);
  const zusatz = (l) => (l === 'en' ? '?lang=en' : '');
  // "Name\nStraße\nOrt\nE-Mail" → "Name, Straße, Ort"
  let kurzname = $derived(betreiber ? betreiber.split('\n').filter(z => !/^e-?mail/i.test(z)).join(', ') : '');

  $effect(() => {
    document.documentElement.lang = lang;
    document.title = inhalt.titel + ' – ' + t(lang, 'title');
  });
</script>

<SeitenKopf
  {lang}
  titel={inhalt.titel}
  links={[{ href: '/' + zusatz(lang), text: inhalt.tabelle }, { href: '/datenschutz' + zusatz(lang), text: inhalt.datenschutz }]}
  onlang={(l) => { lang = l; speichereSprache(l); }}
  ontheme={wechsleDesign}
/>

<main class="container seite">
  <div class="text">
    <section>
      <h2>{inhalt.angaben}</h2>
      {#if betreiber}
        <p class="betreiber">{betreiber}</p>
      {:else}
        <p class="fehlt">{inhalt.fehlt}</p>
      {/if}
    </section>
    {#if betreiber}
      <section>
        <h2>{inhalt.verantwortlich}</h2>
        <p>{kurzname}</p>
      </section>
    {/if}
    <section>
      <h2>{inhalt.haftungTitel}</h2>
      {#each inhalt.haftung as absatz}
        <p>{absatz}</p>
      {/each}
    </section>
  </div>
</main>

<style>
  .seite { padding-top: 1.5rem; padding-bottom: 3rem; }
  .text { max-width: 46rem; }
  section { margin-bottom: 1.5rem; }
  h2 { font-size: 1rem; margin-bottom: .5rem; }
  p { font-size: .875rem; line-height: 1.6; margin-bottom: .625rem; }
  .betreiber { white-space: pre-line; }
  .fehlt { color: var(--amber); }
</style>
