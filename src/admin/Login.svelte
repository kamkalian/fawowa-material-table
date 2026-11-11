<script>
  import { api } from './api.js';

  let { onerfolg } = $props();
  let passwort = $state('');
  let fehler = $state('');
  let laedt = $state(false);

  async function anmelden(e) {
    e.preventDefault();
    fehler = '';
    laedt = true;
    try {
      await api('POST', '/login', { passwort });
      passwort = '';
      onerfolg();
    } catch (err) {
      fehler = err.message;
    } finally {
      laedt = false;
    }
  }
</script>

<form class="card login" onsubmit={anmelden}>
  <h2>Anmelden</h2>
  <label class="field">
    <span>Passwort</span>
    <input class="input" type="password" autocomplete="current-password" bind:value={passwort} required />
  </label>
  {#if fehler}<p class="error" role="alert">{fehler}</p>{/if}
  <button class="btn btn-primary" type="submit" disabled={laedt || !passwort}>Anmelden</button>
</form>

<style>
  .login { max-width: 360px; margin: 2rem auto; padding: 1.5rem; display: flex; flex-direction: column; gap: .875rem; }
  .login h2 { font-size: 1rem; }
  .field { display: flex; flex-direction: column; gap: .25rem; font-size: .8125rem; }
  .field span { color: var(--fg-muted); font-size: .75rem; }
  .error { color: var(--danger); font-size: .8125rem; }
</style>
