<script>
  import { onMount } from 'svelte';
  import Icon from '../shared/Icon.svelte';
  import { t } from './lib/i18n.js';

  // Datenschutzerklärung in einfacher Sprache. Die Angaben zum Betreiber und zum Bereich "Projekt unterstützen"
  // kommen vom Server (.env), damit der Text zur tatsächlichen Einrichtung passt.

  function startSprache() {
    const aus = new URLSearchParams(location.search).get('lang');
    if (aus === 'de' || aus === 'en') return aus;
    try {
      const gespeichert = localStorage.getItem('lang');
      if (gespeichert === 'de' || gespeichert === 'en') return gespeichert;
    } catch { /* Speicher nicht verfügbar */ }
    return 'de';
  }

  let lang = $state(startSprache());
  let betreiber = $state(null);
  let unterstuetzung = $state(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/v2/einstellungen');
      if (res.ok) {
        const e = await res.json();
        betreiber = e.betreiber ?? null;
        unterstuetzung = e.unterstuetzung ?? null;
      }
    } catch { /* ohne diese Angaben bleibt der Rest des Textes gültig */ }
  });

  $effect(() => {
    document.documentElement.lang = lang;
    document.title = (lang === 'de' ? 'Datenschutzerklärung' : 'Privacy policy') + ' – ' + t(lang, 'title');
  });

  function setLang(l) {
    lang = l;
    history.replaceState(null, '', location.pathname + (l === 'en' ? '?lang=en' : ''));
    try { localStorage.setItem('lang', l); } catch { /* ignorieren */ }
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignorieren */ }
  }

  const TEXTE = {
    de: {
      titel: 'Datenschutzerklärung',
      stand: 'Stand: November 2026',
      abschnitte: [
        {
          h: 'Kurz gesagt',
          p: [
            'Diese Seite setzt keine Cookies, nutzt kein Tracking, keine Statistik und keine Werbung. Beim Besuch werden keine Dienste von Dritten geladen.',
            'Es gibt kein Konto und keine Anmeldung für Besucher. Wenn du nichts abschickst, speichern wir nichts über dich.'
          ]
        },
        { h: 'Wer ist verantwortlich?', betreiber: true },
        {
          h: 'Was passiert beim Aufruf der Seite?',
          p: [
            'Dein Browser schickt an unseren Server zwangsläufig technische Angaben, damit die Seite geliefert werden kann: deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Adresse und Angaben zu deinem Browser. Der Server nutzt sie nur, um dir die Seite zu schicken.',
            'Wir führen keine Zugriffsprotokolle und speichern diese Angaben nicht. Die Verbindung ist per HTTPS verschlüsselt.',
            'Rechtsgrundlage: berechtigtes Interesse am sicheren Betrieb der Seite (Art. 6 Abs. 1 lit. f DSGVO).'
          ]
        },
        {
          h: 'Cookies und Speicher im Browser',
          p: [
            'Für Besucher setzt diese Seite keine Cookies.',
            'Wenn du die Sprache oder das helle/dunkle Design umschaltest, merkt sich dein Browser die Wahl im lokalen Speicher (localStorage), damit sie beim nächsten Besuch noch gilt. Das bleibt auf deinem Gerät und wird nie an uns geschickt. Du kannst es jederzeit in den Browser-Einstellungen löschen. Es ist technisch erforderlich, um die von dir gewünschte Einstellung zu behalten.',
            'Nur der Betreiber bekommt beim Anmelden im Verwaltungsbereich ein Anmelde-Cookie. Besucher sehen und nutzen den Verwaltungsbereich nicht.'
          ]
        },
        {
          h: 'Fehler melden und Materialien vorschlagen',
          p: [
            'Über die Formulare kannst du Fehler melden oder neue Materialien vorschlagen. Gespeichert wird, was du eingibst: deine Angaben zum Material, ein Kommentar, eine Quelle und, wenn du es möchtest, eine Kontaktmöglichkeit. Die Kontaktangabe ist freiwillig. Bitte schreibe keine persönlichen Daten in die anderen Felder.',
            'Wir nutzen die Angaben, um die Datenbank zu pflegen und bei Rückfragen antworten zu können. Erledigte Meldungen bleiben zunächst gespeichert. Auf Wunsch löschen wir deine Meldung oder deine Kontaktangabe jederzeit.',
            'Als Schutz vor automatisch erzeugtem Spam zählt der Server, wie oft von einer IP-Adresse aus Meldungen kommen (höchstens fünf pro Stunde). Diese Zählung liegt nur im Arbeitsspeicher, wird nicht gespeichert und ist nach spätestens einer Stunde oder einem Neustart des Servers weg.',
            'Rechtsgrundlage: berechtigtes Interesse an einer gepflegten Datenbank und am Schutz vor Missbrauch (Art. 6 Abs. 1 lit. f DSGVO), bei der Kontaktangabe deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).'
          ]
        },
        {
          h: 'Links zu anderen Seiten',
          p: [
            'Bei manchen Materialien stehen Links zu Quellen im Internet. Wenn du einen Link anklickst, verlässt du diese Seite. Für die Datenverarbeitung auf der anderen Seite ist deren Betreiber verantwortlich.',
            'Der Server prüft von Zeit zu Zeit, ob diese Links noch erreichbar sind. Dabei werden nur die gespeicherten Adressen abgerufen. Daten von Besuchern sind daran nicht beteiligt.'
          ]
        },
        {
          h: 'Projekt unterstützen (Ko-fi)',
          nurMitUnterstuetzung: true,
          p: [
            'Der Knopf „Projekt unterstützen“ ist ein gewöhnlicher Link. Beim Laden dieser Seite wird keine Verbindung zu Ko-fi aufgebaut, es werden also keine Daten dorthin übertragen.',
            'Erst wenn du den Link anklickst, öffnet sich die Seite von Ko-fi, ein Dienst eines Drittanbieters. Dabei erfährt Ko-fi technisch zwingend deine IP-Adresse und Angaben zu deinem Browser; auf der Ko-fi-Seite können eigene Cookies gesetzt werden, und Daten können außerhalb der EU verarbeitet werden. Darauf haben wir keinen Einfluss. Was Ko-fi damit macht, steht in dessen Datenschutzerklärung. Wenn du das nicht möchtest, klicke den Link nicht an.'
          ],
          link: { href: 'https://ko-fi.com/privacy', text: 'Datenschutzerklärung von Ko-fi' },
          webhook: 'Der Fortschrittsbalken wird aktuell gehalten, indem Ko-fi unserem Server meldet, dass ein Beitrag eingegangen ist. Wir speichern davon nur den Betrag und eine Transaktionsnummer, damit nichts doppelt gezählt wird. Namen, E-Mail-Adressen und Nachrichten speichern wir nicht.'
        },
        {
          h: 'Wo läuft die Seite?',
          p: [
            'Die Seite läuft auf einem Server eines Hosting-Anbieters. Dort können die oben beschriebenen technischen Verbindungsdaten kurz anfallen, wenn die Seite ausgeliefert wird.'
          ]
        },
        {
          h: 'Deine Rechte',
          p: [
            'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine erteilte Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Schreibe dazu einfach an die oben genannte Adresse.',
            'Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der für deinen Wohnort zuständigen.'
          ]
        }
      ]
    },
    en: {
      titel: 'Privacy policy',
      stand: 'Last updated: November 2026',
      abschnitte: [
        {
          h: 'In short',
          p: [
            'This site sets no cookies and uses no tracking, no statistics and no advertising. No third-party services are loaded when you visit.',
            'There are no accounts or sign-ins for visitors. If you do not submit anything, we store nothing about you.'
          ]
        },
        { h: 'Who is responsible?', betreiber: true },
        {
          h: 'What happens when you open the site?',
          p: [
            'Your browser necessarily sends technical information to our server so that the page can be delivered: your IP address, date and time, the requested address and details about your browser. The server uses them only to send you the page.',
            'We do not keep access logs and do not store this information. The connection is encrypted with HTTPS.',
            'Legal basis: legitimate interest in running the site securely (Art. 6(1)(f) GDPR).'
          ]
        },
        {
          h: 'Cookies and browser storage',
          p: [
            'This site sets no cookies for visitors.',
            'When you switch the language or the light/dark theme, your browser remembers your choice in local storage (localStorage) so it still applies on your next visit. It stays on your device and is never sent to us. You can delete it at any time in your browser settings. It is technically necessary to keep the setting you asked for.',
            'Only the operator receives a login cookie when signing in to the admin area. Visitors neither see nor use the admin area.'
          ]
        },
        {
          h: 'Reporting errors and suggesting materials',
          p: [
            'The forms let you report errors or suggest new materials. What you enter is stored: your details about the material, a comment, a source and, if you wish, a way to contact you. The contact detail is optional. Please do not put personal data into the other fields.',
            'We use it to maintain the database and to be able to reply to questions. Completed reports are kept for now. On request we delete your report or your contact detail at any time.',
            'To protect against automatically generated spam, the server counts how often reports come from one IP address (at most five per hour). This count exists only in memory, is not stored, and is gone after one hour at the latest or when the server restarts.',
            'Legal basis: legitimate interest in a well-kept database and in protection against abuse (Art. 6(1)(f) GDPR); for the contact detail, your consent (Art. 6(1)(a) GDPR).'
          ]
        },
        {
          h: 'Links to other sites',
          p: [
            'Some materials have links to sources on the internet. When you click a link you leave this site. The operator of the other site is responsible for data processing there.',
            'From time to time the server checks whether these links can still be reached. Only the stored addresses are requested; no visitor data is involved.'
          ]
        },
        {
          h: 'Supporting the project (Ko-fi)',
          nurMitUnterstuetzung: true,
          p: [
            'The “Support the project” button is an ordinary link. Loading this page makes no connection to Ko-fi, so no data is sent there.',
            'Only when you click the link does the Ko-fi site open, a third-party service. Ko-fi then necessarily learns your IP address and details about your browser; the Ko-fi site may set its own cookies, and data may be processed outside the EU. We have no influence on this. What Ko-fi does with it is described in its privacy policy. If you do not want this, do not click the link.'
          ],
          link: { href: 'https://ko-fi.com/privacy', text: 'Ko-fi privacy policy' },
          webhook: 'The progress bar is kept up to date by Ko-fi telling our server that a contribution has arrived. We store only the amount and a transaction number so that nothing is counted twice. We do not store names, email addresses or messages.'
        },
        {
          h: 'Where does the site run?',
          p: [
            'The site runs on a server of a hosting provider. The technical connection data described above may arise there briefly when the page is delivered.'
          ]
        },
        {
          h: 'Your rights',
          p: [
            'You have the right of access, rectification, erasure, restriction of processing, data portability and objection. You can withdraw any consent at any time with effect for the future. Simply write to the address given above.',
            'You can also complain to a data protection supervisory authority, for example the one responsible for your place of residence.'
          ]
        }
      ]
    }
  };

  let inhalt = $derived(TEXTE[lang]);
  let abschnitte = $derived(inhalt.abschnitte.filter(a => !a.nurMitUnterstuetzung || unterstuetzung));
</script>

<header class="header">
  <div class="header-inner">
    <div>
      <h1 class="glow-text">{inhalt.titel}</h1>
      <p class="header-sub"><a href={'/' + (lang === 'en' ? '?lang=en' : '')}>{t(lang, 'backToTable')}</a></p>
    </div>
    <div class="header-tools">
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

<main class="container seite">
<div class="text">
  <p class="stand">{inhalt.stand}</p>

  {#each abschnitte as a (a.h)}
    <section>
      <h2>{a.h}</h2>
      {#if a.betreiber}
        {#if betreiber}
          <p class="betreiber">{betreiber}</p>
        {:else}
          <p class="fehlt">{lang === 'de' ? 'Die Angaben zum Betreiber sind noch nicht eingetragen.' : 'The operator details have not been entered yet.'}</p>
        {/if}
      {/if}
      {#each a.p ?? [] as absatz}
        <p>{absatz}</p>
      {/each}
      {#if a.link}
        <p><a href={a.link.href} target="_blank" rel="noopener noreferrer">{a.link.text}</a></p>
      {/if}
      {#if a.webhook && unterstuetzung?.webhook}
        <p>{a.webhook}</p>
      {/if}
    </section>
  {/each}
</div>
</main>

<style>
  .seite { padding-top: 1.5rem; padding-bottom: 3rem; }
  .text { max-width: 46rem; }
  .stand { color: var(--fg-muted); font-size: .8125rem; margin-bottom: 1.25rem; }
  section { margin-bottom: 1.5rem; }
  h2 { font-size: 1rem; margin-bottom: .5rem; }
  p { font-size: .875rem; line-height: 1.6; margin-bottom: .625rem; }
  a { color: var(--primary); }
  .betreiber { white-space: pre-line; }
  .fehlt { color: var(--amber); }
</style>
