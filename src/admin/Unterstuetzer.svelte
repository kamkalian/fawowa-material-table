<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import Dialog from './Dialog.svelte';
  import Icon from '../shared/Icon.svelte';
  import { ABZEICHEN } from '../../lib/abzeichen.js';

  // Eine Liste aller Unterstützer. Ein Klick öffnet das Formular der Person: Name, Abzeichen, Geldeingänge, anonyme Eingänge
  // (z. B. von Ko-fi) zuordnen. Namen und Abzeichen liegen im öffentlichen Daten-Repo; Beträge bleiben auf dem Server.
  let d = $state(null);
  let fehler = $state('');
  let hinweis = $state('');
  let laeuft = $state(false);
  let dialog = $state(null); // null | { id: Zahl | null } (null = neue Person)

  const WEGE = { ueberweisung: 'Überweisung', paypal: 'PayPal', kofi: 'Ko-fi', sonstige: 'Sonstiges' };
  const heute = () => new Date().toISOString().slice(0, 10);
  const geld = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: d?.waehrung ?? 'EUR' }).format(n);
  const datum = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  const datumFeld = (s) => s.slice(0, 10);
  const abzeichenName = (id) => ABZEICHEN.find(a => a.id === id)?.de ?? id;

  onMount(laden);

  async function laden() {
    try {
      d = await api('GET', '/unterstuetzung');
    } catch (e) {
      fehler = e.message;
    }
  }

  // --- Liste ---
  let anonym = $derived(d ? d.eingaenge.filter(e => !e.unterstuetzer_id) : []);
  let person = $derived(dialog?.id && d ? d.unterstuetzer.find(u => u.id === dialog.id) ?? null : null);
  let seineEingaenge = $derived(person && d ? d.eingaenge.filter(e => e.unterstuetzer_id === person.id) : []);

  // --- Formular ---
  let form = $state({ name: '', zustimmung: false, abzeichen: [] });
  let startAbzeichen = []; // Stand beim Öffnen bzw. nach dem letzten Speichern, um eigene Änderungen von automatischen zu unterscheiden
  let ersterEingang = $state({ betrag: '', datum: heute(), quelle: 'ueberweisung' });
  let neuerEingang = $state({ betrag: '', datum: heute(), quelle: 'ueberweisung' });
  // Bearbeitete Werte der vorhandenen Eingänge (je Eingang), damit sie beim Neuzeichnen nicht verloren gehen
  let bearbeitet = $state({});

  function oeffne(u) {
    fehler = '';
    hinweis = '';
    dialog = { id: u?.id ?? null };
    form = { name: u?.name ?? '', zustimmung: false, abzeichen: [...(u?.abzeichen ?? [])] };
    startAbzeichen = [...form.abzeichen];
    ersterEingang = { betrag: '', datum: heute(), quelle: 'ueberweisung' };
    neuerEingang = { betrag: '', datum: heute(), quelle: 'ueberweisung' };
    bearbeitet = {};
  }

  // Feldwerte eines Eingangs: erst die Änderung, sonst der gespeicherte Wert (nur lesen; geschrieben wird im Eingabe-Ereignis)
  const vorgabe = (e) => ({ betrag: String(e.betrag).replace('.', ','), datum: datumFeld(e.datum), quelle: e.quelle });
  const eingangFeld = (e) => bearbeitet[e.id] ?? vorgabe(e);
  const aendereFeld = (e, feld, wert) => { bearbeitet[e.id] = { ...eingangFeld(e), [feld]: wert }; };

  // Hat der Server Abzeichen automatisch ergänzt (Wiederkehrend) und du hast sie nicht angefasst, wird die Anzeige nachgeführt
  function abzeichenNachfuehren() {
    if (!person) return;
    if (JSON.stringify(form.abzeichen) === JSON.stringify(startAbzeichen)) {
      form.abzeichen = [...person.abzeichen];
      startAbzeichen = [...person.abzeichen];
    }
  }

  async function ausfuehren(fn, text) {
    laeuft = true;
    fehler = '';
    hinweis = '';
    try {
      const r = await fn();
      d = r;
      hinweis = text;
      return r;
    } catch (e) {
      fehler = e.message;
      return null;
    } finally {
      laeuft = false;
    }
  }

  const schalte = (id, an) => {
    form.abzeichen = ABZEICHEN.map(a => a.id).filter(x => (x === id ? an : form.abzeichen.includes(x)));
  };

  async function speichern(e) {
    e.preventDefault();
    if (!person) {
      // Neue Person, optional gleich mit dem ersten Geldeingang
      const r = await ausfuehren(() => api('POST', '/unterstuetzung/unterstuetzer', { name: form.name.trim(), zustimmung: form.zustimmung, abzeichen: form.abzeichen }), 'Unterstützer angelegt.');
      if (!r) return;
      const id = r.id;
      if (ersterEingang.betrag.trim()) {
        await ausfuehren(() => api('POST', '/unterstuetzung/eingaenge', { ...ersterEingang, unterstuetzer_id: id }), 'Unterstützer und Geldeingang angelegt.');
      }
      dialog = { id };
      const neu = d.unterstuetzer.find(u => u.id === id);
      form.abzeichen = [...(neu?.abzeichen ?? form.abzeichen)];
      startAbzeichen = [...form.abzeichen];
      return;
    }
    const patch = {};
    if (form.name.trim() !== person.name) patch.name = form.name.trim();
    if (JSON.stringify(form.abzeichen) !== JSON.stringify(person.abzeichen)) patch.abzeichen = form.abzeichen;
    if (!Object.keys(patch).length) { hinweis = 'Nichts geändert.'; return; }
    const r = await ausfuehren(() => api('PATCH', `/unterstuetzung/unterstuetzer/${person.id}`, patch), 'Gespeichert.');
    if (r) startAbzeichen = [...form.abzeichen];
  }

  async function eingangHinzufuegen(e) {
    e.preventDefault();
    const r = await ausfuehren(() => api('POST', '/unterstuetzung/eingaenge', { ...neuerEingang, unterstuetzer_id: person.id }), 'Geldeingang eingetragen.');
    if (r) { neuerEingang = { betrag: '', datum: heute(), quelle: neuerEingang.quelle }; abzeichenNachfuehren(); }
  }

  async function eingangSpeichern(e) {
    const f = eingangFeld(e);
    const r = await ausfuehren(() => api('PATCH', `/unterstuetzung/eingaenge/${e.id}`, { betrag: f.betrag, datum: f.datum, quelle: f.quelle }), 'Geldeingang geändert.');
    if (r) { delete bearbeitet[e.id]; abzeichenNachfuehren(); }
  }

  async function eingangZuordnen(e) {
    const r = await ausfuehren(() => api('PATCH', `/unterstuetzung/eingaenge/${e.id}`, { unterstuetzer_id: person.id }), 'Eingang zugeordnet.');
    if (r) abzeichenNachfuehren();
  }

  function eingangLoesen(e) {
    ausfuehren(() => api('PATCH', `/unterstuetzung/eingaenge/${e.id}`, { unterstuetzer_id: null }), 'Zuordnung gelöst, der Eingang ist jetzt anonym.');
  }

  function eingangLoeschen(e) {
    if (!confirm(`Eingang vom ${datum(e.datum)} über ${geld(e.betrag)} wirklich löschen?`)) return;
    ausfuehren(() => api('DELETE', `/unterstuetzung/eingaenge/${e.id}`), 'Eingang gelöscht.');
  }

  async function entfernen() {
    if (!confirm(`„${person.name}“ aus der Liste entfernen? Name und Abzeichen werden gelöscht (im Verlauf des Repos bleiben sie sichtbar). Die Beträge bleiben anonym im Balken.`)) return;
    const r = await ausfuehren(() => api('DELETE', `/unterstuetzung/unterstuetzer/${person.id}`), 'Unterstützer entfernt.');
    if (r) dialog = null;
  }
</script>

{#if fehler && !dialog}<p class="error" role="alert">{fehler}</p>{/if}
{#if hinweis && !dialog}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if d}
  <div class="kopf">
    <p class="stand">
      <strong>{d.zeitraum === 'monat' ? 'Dieser Monat' : 'Gesamt'}:</strong> {geld(d.erreicht)}{#if d.ziel > 0} von {geld(d.ziel)}{/if}
      · Alle Eingänge seit Beginn: {geld(d.gesamt)}
      {#if anonym.length}· Ohne Person: {anonym.length} ({geld(anonym.reduce((n, e) => n + e.betrag, 0))}){/if}
    </p>
    <button class="btn btn-primary" onclick={() => oeffne(null)}>Unterstützer hinzufügen</button>
  </div>
  <p class="hinweis">
    Auf der Seite stehen nur Name und Abzeichen. Beides liegt im öffentlichen Daten-Repo (Reiter „Protokoll und Repo“), Beträge bleiben auf dem Server und sind nur hier sichtbar.
  </p>

  <div class="table-wrap">
    <table>
      <thead><tr><th>Name</th><th>Abzeichen</th><th>Summe (alle Zeiten)</th><th>Eingänge</th><th>Zustimmung</th><th></th></tr></thead>
      <tbody>
        {#each d.unterstuetzer as u (u.id)}
          <tr>
            <td><button class="name-btn" onclick={() => oeffne(u)} title="Bearbeiten">{u.name}</button></td>
            <td class="nowrap">
              {#each u.abzeichen as id (id)}<span class="vorschau" title={abzeichenName(id)}><Icon name={'badge-' + id} size={18} /></span>{:else}<span class="hinweis">keine</span>{/each}
            </td>
            <td class="nowrap">{geld(u.gesamt)}</td>
            <td>{u.anzahl}</td>
            <td class="nowrap">{datum(u.zustimmung_am)} ({u.zustimmung_art === 'kofi-oeffentlich' ? 'Ko-fi öffentlich' : 'von Hand'})</td>
            <td class="nowrap"><button class="btn btn-ghost btn-sm" onclick={() => oeffne(u)}>Bearbeiten</button></td>
          </tr>
        {:else}
          <tr class="empty-row"><td colspan="6">Noch keine Unterstützer.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else if !fehler}
  <p class="hinweis">Lade ...</p>
{/if}

{#if dialog && d}
  <Dialog titel={person ? `Unterstützer: ${person.name}` : 'Unterstützer hinzufügen'} onclose={() => { dialog = null; fehler = ''; hinweis = ''; }}>
    {#if fehler}<p class="error" role="alert">{fehler}</p>{/if}
    {#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

    <form class="formular" onsubmit={speichern}>
      <section class="abschnitt">
        <h3>Person</h3>
        <div class="felder">
          <label class="feld">
            <span>Anzeigename (Name oder Pseudonym)</span>
            <input class="input" bind:value={form.name} maxlength="60" required />
          </label>
        </div>
        {#if !person}
          <label class="haken">
            <input type="checkbox" bind:checked={form.zustimmung} /> Die Person hat der Anzeige ihres Namens auf der Seite ausdrücklich zugestimmt
          </label>
        {:else}
          <p class="hinweis">Zustimmung: {datum(person.zustimmung_am)} ({person.zustimmung_art === 'kofi-oeffentlich' ? 'bei Ko-fi als öffentlich markiert' : 'von Hand eingetragen'})</p>
        {/if}
      </section>

      <section class="abschnitt">
        <h3>Abzeichen</h3>
        <div class="abzeichen-liste">
          {#each ABZEICHEN as a (a.id)}
            <label class="haken">
              <input type="checkbox" checked={form.abzeichen.includes(a.id)} onchange={(ev) => schalte(a.id, ev.currentTarget.checked)} />
              <span class="vorschau"><Icon name={'badge-' + a.id} size={18} /></span>
              <span><strong>{a.de}</strong> <span class="hinweis">– {a.text_de}</span></span>
            </label>
          {/each}
        </div>
        <p class="hinweis">„Wiederkehrend“ wird automatisch vergeben, wenn jemand ein Ko-fi-Abo hat oder in aufeinanderfolgenden Monaten Geld schickt. Entfernst du es, kommt es nicht wieder.</p>
      </section>

      {#if !person}
        <section class="abschnitt">
          <h3>Erster Geldeingang (optional)</h3>
          <div class="felder">
            <label class="feld"><span>Betrag ({d.waehrung})</span><input class="input" inputmode="decimal" bind:value={ersterEingang.betrag} placeholder="10,00" /></label>
            <label class="feld"><span>Datum</span><input class="input" type="date" bind:value={ersterEingang.datum} /></label>
            <label class="feld">
              <span>Weg</span>
              <select class="input" bind:value={ersterEingang.quelle}>
                <option value="ueberweisung">Überweisung</option><option value="paypal">PayPal</option><option value="sonstige">Sonstiges</option>
              </select>
            </label>
          </div>
        </section>
      {/if}

      <div class="knoepfe">
        <button class="btn btn-primary" disabled={laeuft || (!person && !form.zustimmung)}>{person ? 'Speichern' : 'Anlegen'}</button>
        {#if person}<button type="button" class="btn btn-ghost gefahr" onclick={entfernen}>Aus der Liste entfernen</button>{/if}
      </div>
    </form>

    {#if person}
      <section class="abschnitt block">
        <h3>Geldeingänge ({seineEingaenge.length}, zusammen {geld(person.gesamt)})</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Betrag</th><th>Weg</th><th></th></tr></thead>
            <tbody>
              {#each seineEingaenge as e (e.id)}
                {@const f = eingangFeld(e)}
                <tr>
                  <td><input class="input klein" type="date" value={f.datum} oninput={(ev) => aendereFeld(e, 'datum', ev.currentTarget.value)} aria-label="Datum" /></td>
                  <td><input class="input klein" inputmode="decimal" value={f.betrag} oninput={(ev) => aendereFeld(e, 'betrag', ev.currentTarget.value)} aria-label="Betrag" /></td>
                  <td>
                    <select class="input klein" value={f.quelle} onchange={(ev) => aendereFeld(e, 'quelle', ev.currentTarget.value)} aria-label="Weg">
                      {#each Object.entries(WEGE) as [k, v]}<option value={k}>{v}</option>{/each}
                    </select>
                    {#if e.abo}<span class="hinweis">Abo</span>{/if}
                  </td>
                  <td class="nowrap">
                    <button class="btn btn-ghost btn-sm" disabled={laeuft} onclick={() => eingangSpeichern(e)}>Speichern</button>
                    <button class="btn btn-ghost btn-sm" disabled={laeuft} onclick={() => eingangLoesen(e)} title="Der Betrag bleibt, aber ohne diese Person">Lösen</button>
                    <button class="btn btn-ghost btn-sm gefahr" disabled={laeuft} onclick={() => eingangLoeschen(e)}>Löschen</button>
                  </td>
                </tr>
              {:else}
                <tr class="empty-row"><td colspan="4">Noch keine Geldeingänge.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>

        <form class="neu-eingang" onsubmit={eingangHinzufuegen}>
          <label class="feld"><span>Betrag ({d.waehrung})</span><input class="input" inputmode="decimal" bind:value={neuerEingang.betrag} required placeholder="10,00" /></label>
          <label class="feld"><span>Datum</span><input class="input" type="date" bind:value={neuerEingang.datum} required /></label>
          <label class="feld">
            <span>Weg</span>
            <select class="input" bind:value={neuerEingang.quelle}>
              <option value="ueberweisung">Überweisung</option><option value="paypal">PayPal</option><option value="sonstige">Sonstiges</option>
            </select>
          </label>
          <button class="btn btn-outline" disabled={laeuft}>Geldeingang hinzufügen</button>
        </form>
      </section>

      <section class="abschnitt block">
        <h3>Eingänge ohne Person zuordnen ({anonym.length})</h3>
        <p class="hinweis">Beiträge, die anonym ankamen (z. B. von Ko-fi, wenn sie dort nicht als öffentlich markiert waren). Ordne einen davon „{person.name}“ zu, wenn du weißt, von wem er kam.</p>
        {#if anonym.length}
          <div class="table-wrap">
            <table>
              <thead><tr><th>Datum</th><th>Betrag</th><th>Weg</th><th></th></tr></thead>
              <tbody>
                {#each anonym as e (e.id)}
                  <tr>
                    <td class="nowrap">{datum(e.datum)}</td>
                    <td class="nowrap">{geld(e.betrag)}</td>
                    <td>{WEGE[e.quelle] ?? e.quelle}{e.abo ? ' (Abo)' : ''}</td>
                    <td><button class="btn btn-outline btn-sm" disabled={laeuft} onclick={() => eingangZuordnen(e)}>Dieser Person zuordnen</button></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="hinweis">Keine anonymen Eingänge.</p>
        {/if}
      </section>
    {/if}
  </Dialog>
{/if}

<style>
  .kopf { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; align-items: center; justify-content: space-between; margin-bottom: .5rem; }
  .stand { font-size: .9375rem; margin: 0; }
  .hinweis { color: var(--fg-muted); font-size: .75rem; }
  .nowrap { white-space: nowrap; }
  .vorschau { display: inline-flex; vertical-align: middle; margin-right: .35rem; color: var(--primary); }
  .name-btn { background: none; border: none; color: var(--fg); font: inherit; cursor: pointer; padding: 0; text-align: left; }
  .name-btn:hover { color: var(--primary); text-decoration: underline; }
  .abzeichen-liste { display: flex; flex-direction: column; gap: .4rem; }
  .abzeichen-liste .haken { align-items: flex-start; }
  .knoepfe { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
  .block { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); }
  .neu-eingang { display: flex; flex-wrap: wrap; gap: .5rem .75rem; align-items: flex-end; margin-top: .5rem; }
  .klein { width: auto; min-width: 7rem; }
</style>
