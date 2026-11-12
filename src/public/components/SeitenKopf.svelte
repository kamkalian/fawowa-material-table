<script>
  import Icon from '../../shared/Icon.svelte';
  import { t } from '../lib/i18n.js';

  // Kopfzeile der Textseiten (Datenschutz, Impressum): Titel, Wege zurück, Sprach- und Designschalter
  let { lang, titel, links, onlang, ontheme } = $props();
</script>

<header class="header">
  <div class="header-inner">
    <div>
      <h1 class="glow-text">{titel}</h1>
      <p class="header-sub">
        {#each links as l (l.href)}<a href={l.href}>{l.text}</a>{/each}
      </p>
    </div>
    <div class="header-tools">
      <div class="lang-switch" role="group" aria-label={t(lang, 'langSwitch')}>
        <button class="btn btn-sm {lang === 'de' ? 'btn-primary' : 'btn-ghost'}" aria-pressed={lang === 'de'} onclick={() => onlang('de')}>DE</button>
        <button class="btn btn-sm {lang === 'en' ? 'btn-primary' : 'btn-ghost'}" aria-pressed={lang === 'en'} onclick={() => onlang('en')}>EN</button>
      </div>
      <button class="btn btn-ghost btn-icon" title={t(lang, 'themeToggle')} aria-label={t(lang, 'themeToggle')} onclick={ontheme}>
        <Icon name="ui-moon" size={16} />
      </button>
    </div>
  </div>
</header>

<style>
  .header-sub a { color: var(--primary); }
  .header-sub a + a { margin-left: .875rem; }
</style>
