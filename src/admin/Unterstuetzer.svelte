<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import Icon from '../shared/Icon.svelte';
  import { ABZEICHEN } from '../../lib/abzeichen.js';

  // Geldeingänge und Unterstützer. Alles liegt lokal auf dem Server (nicht im Daten-Repo). Beträge sieht nur der Admin-Bereich.
  let d = $state(null);
  let fehler = $state('');
  let hinweis = $state('');
  let laeuft = $state(false);

  const WEGE = { ueberweisung: 'Überweisung', paypal: 'PayPal', kofi: 'Ko-fi', sonstige: 'Sonstiges' };
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

  // Abzeichen an- oder abwählen; gespeichert wird sofort die ganze Liste dieser Person
  function schalteAbzeichen(u, id, an) {
    const neu = an ? [...u.abzeichen, id] : u.abzeichen.filter(x => x !== id);
    ausfuehren(() => api('PATCH', `/unterstuetzung/unterstuetzer/${u.id}`, { abzeichen: neu }), 'Abzeichen gespeichert.');
  }

  // Person ohne Geldeingang anlegen, z. B. jemand, der mit Ideen hilft
  let person = $state({ name: '', zustimmung: false });
  async function personAnlegen(e) {
    e.preventDefault();
    const ok = await ausfuehren(() => api('POST', '/unterstuetzung/unterstuetzer', { name: person.name.trim(), zustimmung: person.zustimmung }), 'Person angelegt. Unten kannst du Abzeichen zuordnen.');
    if (ok) person = { name: '', zustimmung: false };
  }

  // Name zu einem anonymen Eingang nachtragen (z. B. bei Ko-fi): nur mit Zustimmung der Person
  function nameNachtragen(e) {
    const name = prompt('Anzeigename der Person (Name oder Pseudonym):');
    if (!name || !name.trim()) return;
    if (!confirm(`Hat „${name.trim()}“ der Anzeige des Namens auf der Seite ausdrücklich zugestimmt?`)) return;
    ausfuehren(() => api('PATCH', `/unterstuetzung/eingaenge/${e.id}`, { name: name.trim(), zustimmung: true }), 'Name eingetragen.');
  }

  function anonymMachen(e) {
    ausfuehren(() => api('PATCH', `/unterstuetzung/eingaenge/${e.id}`, { unterstuetzer_id: null }), 'Zuordnung gelöst.');
  }

  function entferne(u) {
    if (!confirm(`„${u.name}“ aus der Anzeige entfernen? Die Beträge bleiben anonym im Balken, Name und Zustimmung werden gelöscht.`)) return;
    ausfuehren(() => api('DELETE', `/unterstuetzung/unterstuetzer/${u.id}`), 'Unterstützer entfernt.');
  }

  const geld = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: d?.waehrung ?? 'EUR' }).format(n);
  const datum = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
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
    <p class="hinweis">Auf der Seite stehen nur Name und die Abzeichen, die du hier auswählst (mehrere möglich). Namen und Abzeichen werden ins öffentliche Daten-Repo geschrieben (Reiter „Protokoll und Repo“) und lassen sich dort auch ändern. Beträge bleiben auf dem Server und sind nur für dich sichtbar.</p>
    <form class="person-neu" onsubmit={personAnlegen}>
      <input class="input" bind:value={person.name} maxlength="60" placeholder="Person ohne Geldeingang, z. B. Ideengeber" aria-label="Name der neuen Person" />
      <label class="haken"><input type="checkbox" bind:checked={person.zustimmung} /> hat der Anzeige des Namens zugestimmt</label>
      <button class="btn btn-outline btn-sm" disabled={laeuft || !person.name.trim() || !person.zustimmung}>Person hinzufügen</button>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Abzeichen</th><th>Summe (alle Zeiten)</th><th>Eingänge</th><th>Zustimmung</th><th></th></tr></thead>
        <tbody>
          {#each d.unterstuetzer as u (u.id)}
            <tr>
              <td>{u.name}</td>
              <td>
                <details class="abzeichen-wahl">
                  <summary>
                    {#each u.abzeichen as id (id)}<span class="vorschau" title={ABZEICHEN.find(a => a.id === id)?.de}><Icon name={'badge-' + id} size={18} /></span>{:else}<span class="hinweis">keine</span>{/each}
                  </summary>
                  <div class="wahl">
                    {#each ABZEICHEN as a (a.id)}
                      <label class="haken" title={a.text_de}>
                        <input type="checkbox" checked={u.abzeichen.includes(a.id)} disabled={laeuft}
                          onchange={(ev) => schalteAbzeichen(u, a.id, ev.currentTarget.checked)} />
                        <span class="vorschau"><Icon name={'badge-' + a.id} size={16} /></span> {a.de}
                      </label>
                    {/each}
                  </div>
                </details>
              </td>
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
              <td class="nowrap">
                {#if e.unterstuetzer_id}
                  <button class="btn btn-ghost btn-sm" onclick={() => anonymMachen(e)}>Anonym machen</button>
                {:else}
                  <button class="btn btn-ghost btn-sm" onclick={() => nameNachtragen(e)}>Name eintragen</button>
                {/if}
                <button class="btn btn-ghost btn-sm gefahr" onclick={() => loescheEingang(e)}>Löschen</button>
              </td>
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
  .vorschau { display: inline-flex; vertical-align: middle; margin-right: .35rem; color: var(--primary); }
  .person-neu { display: flex; flex-wrap: wrap; gap: .5rem .75rem; align-items: center; margin-bottom: .5rem; }
  .person-neu .input { max-width: 22rem; }
  .abzeichen-wahl summary { cursor: pointer; display: flex; gap: .35rem; align-items: center; min-height: 1.5rem; }
  .wahl { display: flex; flex-direction: column; gap: .35rem; padding: .5rem 0; }
</style>
