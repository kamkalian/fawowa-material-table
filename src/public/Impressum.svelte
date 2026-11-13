<script>
  import { onMount } from 'svelte';
  import { t } from './lib/i18n.js';
  import { startSprache, speichereSprache, wechsleDesign } from './lib/seite.js';
  import SeitenKopf from './components/SeitenKopf.svelte';

  // Impressum nach § 5 DDG. Die Angaben zum Betreiber kommen vom Server (OPERATOR in der .env).
  let lang = $state(startSprache());
  let betreiber = $state(null);
  let betreiberPerson = $state(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/v2/einstellungen');
      if (res.ok) {
        const d = await res.json();
        betreiber = d.betreiber ?? null;
        betreiberPerson = d.betreiberPerson ?? null;
      }
    } catch { /* ohne Angaben erscheint ein Hinweis */ }
  });

  const TEXTE = {
    de: {
      titel: 'Impressum',
      angaben: 'Angaben gemäß § 5 DDG',
      verantwortlich: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
      anschriftWieOben: 'Anschrift wie oben',
      fehlt: 'Die Angaben zum Betreiber sind noch nicht eingetragen.',
      haftungTitel: 'Hinweis zu den Angaben',
      haftung: [
        'Die Materialangaben in dieser Datenbank stammen aus Herstellerangaben, Quellen im Internet und Hinweisen von Besuchern. Sie wurden mit Sorgfalt zusammengetragen, aber nicht alle sind geprüft (solche Werte sind als „ungeprüft“ gekennzeichnet). Alle Angaben sind ohne Gewähr.',
        'Prüfe vor dem Bauen die Werte, auf die es ankommt, besonders bei tragenden und sicherheitsrelevanten Teilen, selbst nach, zum Beispiel beim Hersteller.'
      ],
      inhalteTitel: 'Haftung für Inhalte',
      inhalte: 'Wir sind für die eigenen Inhalte dieser Seite verantwortlich. Fremde Informationen, die uns Besucher melden, überwachen wir nicht ständig; wir prüfen sie, bevor sie veröffentlicht werden. Wenn wir von einer konkreten Rechtsverletzung erfahren, entfernen wir den Inhalt unverzüglich.',
      urheberTitel: 'Urheberrecht',
      urheber: 'Die Inhalte, die wir selbst erstellt haben, unterliegen dem deutschen Urheberrecht. Wenn du etwas daraus außerhalb der Grenzen des Urheberrechts verwenden möchtest, brauchen wir vorher deine Anfrage und unsere schriftliche Zustimmung. Der Quellcode und die Daten stehen unter den Bedingungen, die in den GitHub-Repositories genannt sind.',
      streitTitel: 'Streitschlichtung',
      streit: 'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
      linksTitel: 'Haftung für Links',
      links: 'Diese Seite enthält Links zu Seiten anderer Anbieter (Quellen, Shops, Zahlungsdienste, GitHub). Auf deren Inhalte haben wir keinen Einfluss und übernehmen dafür keine Gewähr. Verantwortlich ist immer der jeweilige Anbieter. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Wenn wir von einem Verstoß erfahren, entfernen wir den Link.',
      datenschutz: 'Datenschutz',
      tabelle: 'Zur Tabelle'
    },
    en: {
      titel: 'Legal notice',
      angaben: 'Information according to § 5 DDG (German Digital Services Act)',
      verantwortlich: 'Responsible for the content (§ 18 (2) MStV)',
      anschriftWieOben: 'address as above',
      fehlt: 'The operator details have not been entered yet.',
      haftungTitel: 'Note on the information',
      haftung: [
        'The material data in this database comes from manufacturer information, sources on the internet and tips from visitors. It was compiled with care, but not all of it is verified (such values are marked “unverified”). All information is provided without guarantee.',
        'Before building, check the values that matter to you yourself, for example with the manufacturer, especially for load-bearing and safety-relevant parts.'
      ],
      inhalteTitel: 'Liability for content',
      inhalte: 'We are responsible for the content of this site that we created ourselves. We do not constantly monitor information that visitors report to us; we check it before it is published. If we learn of a concrete violation of the law, we will remove the content without delay.',
      urheberTitel: 'Copyright',
      urheber: 'The content we created ourselves is subject to German copyright law. If you want to use any of it beyond the limits of copyright, we need your request and our written consent beforehand. The source code and data are available under the terms stated in the GitHub repositories.',
      streitTitel: 'Dispute resolution',
      streit: 'We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board.',
      linksTitel: 'Liability for links',
      links: 'This site contains links to sites of other providers (sources, shops, payment services, GitHub). We have no influence on their content and accept no liability for it. The respective provider is always responsible. No violations of the law were apparent when the links were set. If we learn of a violation, we will remove the link.',
      datenschutz: 'Privacy',
      tabelle: 'Back to the table'
    }
  };
  let inhalt = $derived(TEXTE[lang]);
  const zusatz = (l) => (l === 'en' ? '?lang=en' : '');
  // "Name\nStraße\nOrt\nE-Mail" → "Name, Straße, Ort"
  let kurzname = $derived(betreiber ? betreiber.split('\n').filter(z => !/^e-?mail|^tel/i.test(z)).join(', ') : '');

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
        <p>{betreiberPerson ? `${betreiberPerson} (${inhalt.anschriftWieOben})` : kurzname}</p>
      </section>
    {/if}
    <section>
      <h2>{inhalt.haftungTitel}</h2>
      {#each inhalt.haftung as absatz}
        <p>{absatz}</p>
      {/each}
    </section>
    <section>
      <h2>{inhalt.inhalteTitel}</h2>
      <p>{inhalt.inhalte}</p>
    </section>
    <section>
      <h2>{inhalt.linksTitel}</h2>
      <p>{inhalt.links}</p>
    </section>
    <section>
      <h2>{inhalt.urheberTitel}</h2>
      <p>{inhalt.urheber}</p>
    </section>
    <section>
      <h2>{inhalt.streitTitel}</h2>
      <p>{inhalt.streit}</p>
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
