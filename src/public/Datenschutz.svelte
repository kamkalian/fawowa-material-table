<script>
  import { onMount } from 'svelte';
  import { startSprache, speichereSprache, wechsleDesign } from './lib/seite.js';
  import SeitenKopf from './components/SeitenKopf.svelte';
  import { t } from './lib/i18n.js';

  // Datenschutzerklärung in einfacher Sprache. Die Angaben zum Betreiber und zum Bereich "Projekt unterstützen"
  // kommen vom Server (.env), damit der Text zur tatsächlichen Einrichtung passt.

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
          h: 'Projekt unterstützen und Unterstützer-Liste',
          nurMitUnterstuetzung: true,
          p: [
            'Die Zahlungswege Ko-fi und PayPal sind gewöhnliche Links. Beim Laden dieser Seite wird keine Verbindung zu diesen Diensten aufgebaut, es werden also keine Daten dorthin übertragen. Erst wenn du einen Link anklickst, öffnet sich die Seite des jeweiligen Anbieters, ein Dienst eines Drittanbieters. Dabei erfährt der Anbieter technisch zwingend deine IP-Adresse und Angaben zu deinem Browser; es können eigene Cookies gesetzt und Daten außerhalb der EU verarbeitet werden. Darauf haben wir keinen Einfluss. Was die Anbieter damit machen, steht in deren Datenschutzerklärungen. Wenn du das nicht möchtest, klicke die Links nicht an.',
            'Überweist du uns Geld, erhalten wir von unserer Bank deine Kontodaten (Name, IBAN, Betrag, Verwendungszweck). Wir brauchen sie für die Buchhaltung unseres Gewerbes und speichern sie für die gesetzlichen Aufbewahrungsfristen.',
            'Wenn du möchtest, nennen wir dich auf dieser Seite als Unterstützer. Das geschieht nur mit deiner ausdrücklichen Einwilligung (Art. 6 Abs. 1 lit. a DSGVO): bei Ko-fi, wenn du deinen Beitrag dort als „öffentlich“ markierst, sonst, wenn du uns dein Einverständnis mitteilst. Angezeigt werden ausschließlich der Name oder das Pseudonym, das du angibst, und ein Abzeichen, das grob die Höhe deiner Unterstützung zeigt. Beträge einzelner Personen zeigen wir nicht. Dafür speichern wir deinen Namen, den Zeitpunkt der Einwilligung und deine Beträge auf unserem Server, nicht im öffentlichen Datenrepository. Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen: Schreib uns an die oben genannte Adresse, dann nehmen wir dich aus der Liste und löschen deinen Namen. Deine Beträge bleiben ohne Namen im Fortschrittsbalken erhalten.'
          ],
          links: [{ href: 'https://ko-fi.com/privacy', text: 'Datenschutzerklärung von Ko-fi' }, { href: 'https://www.paypal.com/de/legalhub/privacy-full', text: 'Datenschutzerklärung von PayPal' }],
          webhook: 'Der Fortschrittsbalken wird aktuell gehalten, indem Ko-fi unserem Server meldet, dass ein Beitrag eingegangen ist. Wir speichern davon den Betrag, eine Transaktionsnummer, damit nichts doppelt gezählt wird, und nur wenn der Beitrag bei Ko-fi als öffentlich markiert ist den angegebenen Namen. E-Mail-Adressen und Nachrichten speichern wir nicht.'
        },
        {
          h: 'Wo läuft die Seite?',
          p: [
            'Die Seite läuft auf einem Server der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland. Dort können die oben beschriebenen technischen Verbindungsdaten kurz anfallen, wenn die Seite ausgeliefert wird. Hetzner ist unser Hosting-Anbieter.'
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
          h: 'Supporting the project and the supporters list',
          nurMitUnterstuetzung: true,
          p: [
            'The payment options Ko-fi and PayPal are ordinary links. Loading this page makes no connection to these services, so no data is sent there. Only when you click a link does the provider’s site open, a third-party service. The provider then necessarily learns your IP address and details about your browser; it may set its own cookies, and data may be processed outside the EU. We have no influence on this. What the providers do with it is described in their privacy policies. If you do not want this, do not click the links.',
            'If you transfer money to us, our bank gives us your account details (name, IBAN, amount, reference). We need them for the bookkeeping of our business and keep them for the statutory retention periods.',
            'If you wish, we name you on this page as a supporter. This only happens with your explicit consent (Art. 6(1)(a) GDPR): on Ko-fi, when you mark your contribution as “public” there, otherwise when you tell us you agree. Only the name or pseudonym you give and a badge that roughly shows the level of your support are displayed. We do not show amounts of individual people. For this we store your name, the time of your consent and your amounts on our server, not in the public data repository. You can withdraw your consent at any time with effect for the future: write to us at the address above and we will remove you from the list and delete your name. Your amounts remain in the progress bar without a name.'
          ],
          links: [{ href: 'https://ko-fi.com/privacy', text: 'Ko-fi privacy policy' }, { href: 'https://www.paypal.com/uk/legalhub/privacy-full', text: 'PayPal privacy policy' }],
          webhook: 'The progress bar is kept up to date by Ko-fi telling our server that a contribution has arrived. We store the amount, a transaction number so that nothing is counted twice, and, only if the contribution is marked as public on Ko-fi, the name given. We do not store email addresses or messages.'
        },
        {
          h: 'Where does the site run?',
          p: [
            'The site runs on a server of Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany. The technical connection data described above may arise there briefly when the page is delivered. Hetzner is our hosting provider.'
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

<SeitenKopf
  {lang}
  titel={inhalt.titel}
  links={[{ href: '/' + (lang === 'en' ? '?lang=en' : ''), text: t(lang, 'backToTable') }, { href: '/impressum' + (lang === 'en' ? '?lang=en' : ''), text: t(lang, 'imprintLink') }]}
  onlang={(l) => { lang = l; speichereSprache(l); }}
  ontheme={wechsleDesign}
/>

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
      {#if a.links}
        <p>{#each a.links as l, i}{#if i > 0} · {/if}<a href={l.href} target="_blank" rel="noopener noreferrer">{l.text}</a>{/each}</p>
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
