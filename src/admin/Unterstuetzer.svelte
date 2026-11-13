<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';

  // Geldeingänge und Unterstützer. Alles liegt lokal auf dem Server (nicht im Daten-Repo). Beträge sieht nur der Admin-Bereich.
  let d = $state(null);
  let fehler = $state('');
  let hinweis = $state('');
  let laeuft = $state(false);

  const WEGE = { ueberweisung: 'Überweisung', paypal: 'PayPal', kofi: 'Ko-fi', sonstige: 'Sonstiges' };
  const STUFEN = { bronze: 'Bronze', silber: 'Silber', gold: 'Gold', platin: 'Platin' };
  const heute = () => new Date().toISOString().slice(0, 10);

  let neu = $state({ betrag: '', datum: heute(), quelle: 'ueberweisung', unterstuetzer_id: '', name: '', zustimmung: false });

  onMount(laden);

  async function laden() {
    try {
      d = await api('GET', '/unterstuetzung');
    } catch (e) {
      fehler = e.message;
    }
  }

  async function ausfuehren(fn, text) {
    laeuft = true;
    fehler = '';
    hinweis = '';
    try {
      d = await fn();
      hinweis = text;
      return true;
    } catch (e) {
      fehler = e.message;
      return false;
    } finally {
      laeuft = false;
    }
  }

  async function eintragen(e) {
    e.preventDefault();
    const body = {
      betrag: neu.betrag, datum: neu.datum, quelle: neu.quelle,
      ...(neu.unterstuetzer_id ? { unterstuetzer_id: Number(neu.unterstuetzer_id) } : { name: neu.name.trim(), zustimmung: neu.zustimmung })
    };
    const ok = await ausfuehren(() => api('POST', '/unterstuetzung/eingaenge', body), 'Eingang eingetragen.');
    if (ok) neu = { betrag: '', datum: heute(), quelle: neu.quelle, unterstuetzer_id: '', name: '', zustimmung: false };
  }

  function loescheEingang(e) {
    if (!confirm(`Eingang vom ${datum(e.datum)} über ${geld(e.betrag)} wirklich löschen?`)) return;
    ausfuehren(() => api('DELETE', `/unterstuetzung/eingaenge/${e.id}`), 'Eingang gelöscht.');
  }

  function benenne(u) {
    const name = prompt('Anzeigename', u.name);
    if (name === null || name.trim() === u.name) return;
    ausfuehren(() => api('PATCH', `/unterstuetzung/unterstuetzer/${u.id}`, { name }), 'Name geändert.');
  }

  function entferne(u) {
    if (!confirm(`„${u.name}“ aus der Anzeige entfernen? Die Beträge bleiben anonym im Balken, Name und Zustimmung werden gelöscht.`)) return;
    ausfuehren(() => api('DELETE', `/unterstuetzung/unterstuetzer/${u.id}`), 'Unterstützer entfernt.');
  }

  const geld = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: d?.waehrung ?? 'EUR' }).format(n);
  const datum = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  const stufenText = (s) => (d ? `Bronze ab ${d.schwellen.bronze} €, Silber ab ${d.schwellen.silber} €, Gold ab ${d.schwellen.gold} €, Platin ab ${d.schwellen.platin} €` : '');
</script>

{#if fehler}<p class="error" role="alert">{fehler}</p>{/if}
{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if d}
  <div class="stand">
    <p>
      <strong>{d.zeitraum === 'monat' ? 'Dieser Monat' : 'Gesamt'}:</strong> {geld(d.erreicht)}{#if d.ziel > 0} von {geld(d.ziel)}{/if}
      · Alle Eingänge seit Beginn: {geld(d.gesamt)}
    </p>
  </div>

  <section class="abschnitt">
    <h3>Eingang eintragen</h3>
    <form class="formular" onsubmit={eintragen}>
      <div class="felder">
        <label class="feld">
          <span>Betrag ({d.waehrung})</span>
          <input class="input" inputmode="decimal" bind:value={neu.betrag} required placeholder="10,00" />
        </label>
        <label class="feld">
          <span>Datum</span>
          <input class="input" type="date" bind:value={neu.datum} required />
        </label>
        <label class="feld">
          <span>Weg</span>
          <select class="input" bind:value={neu.quelle}>
            <option value="ueberweisung">Überweisung</option>
            <option value="paypal">PayPal</option>
            <option value="sonstige">Sonstiges</option>
          </select>
        </label>
        <label class="feld">
          <span>Unterstützer</span>
          <select class="input" bind:value={neu.unterstuetzer_id}>
            <option value="">Anonym oder neue Person</option>
            {#each d.unterstuetzer as u (u.id)}<option value={u.id}>{u.name}</option>{/each}
          </select>
        </label>
        {#if !neu.unterstuetzer_id}
          <label class="feld">
            <span>Anzeigename (leer = anonym)</span>
            <input class="input" bind:value={neu.name} maxlength="60" placeholder="Name oder Pseudonym" />
          </label>
        {/if}
      </div>
      {#if !neu.unterstuetzer_id && neu.name.trim()}
        <label class="haken">
          <input type="checkbox" bind:checked={neu.zustimmung} />
          Die Person hat der Anzeige ihres Namens ausdrücklich zugestimmt
        </label>
      {/if}
      <div><button class="btn btn-primary" disabled={laeuft}>Eintragen</button></div>
    </form>
  </section>

  <section class="abschnitt">
    <h3>Unterstützer ({d.unterstuetzer.length})</h3>
    <p class="hinweis">Auf der Seite stehen nur Name und Abzeichen. Stufen: {stufenText()}. Gezählt wird die Summe aller Zeiten.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Abzeichen</th><th>Summe</th><th>Eingänge</th><th>Zustimmung</th><th></th></tr></thead>
        <tbody>
          {#each d.unterstuetzer as u (u.id)}
            <tr>
              <td>{u.name}</td>
              <td>{u.stufe ? STUFEN[u.stufe] : '–'}</td>
              <td class="nowrap">{geld(u.gesamt)}</td>
              <td>{u.anzahl}</td>
              <td class="nowrap">{datum(u.zustimmung_am)} ({u.zustimmung_art === 'kofi-oeffentlich' ? 'Ko-fi öffentlich' : 'von Hand'})</td>
              <td class="nowrap">
                <button class="btn btn-ghost btn-sm" onclick={() => benenne(u)}>Umbenennen</button>
                <button class="btn btn-ghost btn-sm gefahr" onclick={() => entferne(u)}>Entfernen</button>
              </td>
            </tr>
          {:else}
            <tr class="empty-row"><td colspan="6">Noch keine Unterstützer mit Namen.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="abschnitt">
    <h3>Eingänge ({d.eingaenge.length})</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Datum</th><th>Betrag</th><th>Weg</th><th>Unterstützer</th><th></th></tr></thead>
        <tbody>
          {#each d.eingaenge as e (e.id)}
            <tr>
              <td class="nowrap">{datum(e.datum)}</td>
              <td class="nowrap">{geld(e.betrag)}</td>
              <td>{WEGE[e.quelle] ?? e.quelle}</td>
              <td>{e.unterstuetzer_name ?? 'anonym'}</td>
              <td><button class="btn btn-ghost btn-sm gefahr" onclick={() => loescheEingang(e)}>Löschen</button></td>
            </tr>
          {:else}
            <tr class="empty-row"><td colspan="5">Noch keine Eingänge.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{:else if !fehler}
  <p class="hinweis">Lade ...</p>
{/if}

<style>
  .stand { font-size: .9375rem; margin-bottom: 1rem; }
  .abschnitt { margin-bottom: 1.5rem; }
  .hinweis { color: var(--fg-muted); font-size: .75rem; }
  .nowrap { white-space: nowrap; }
</style>
