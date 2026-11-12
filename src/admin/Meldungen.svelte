<script>
  import { onMount } from 'svelte';
  import { api } from './api.js';
  import CategoryIcon from '../shared/CategoryIcon.svelte';
  import MaterialForm from './MaterialForm.svelte';
  import {
    entwurfAusText, wertDatenAusEntwurf, vorlageAusVorschlag, aktuellText
  } from './meldungen-hilfen.js';

  // onzaehler(n): meldet die Zahl offener Meldungen an die Navigation
  let { onzaehler } = $props();

  let ansicht = $state('offen'); // offen | archiv
  let meldungen = $state([]);
  let props = $state([]);
  let kategorien = $state([]);
  let geladen = $state(false);
  let fehler = $state('');
  let hinweis = $state('');
  let entwuerfe = $state({});      // je Meldung: Entwurf des korrigierten Wertes
  let ablehnenId = $state(null);   // Meldung, bei der gerade die Notiz zum Ablehnen eingegeben wird
  let ablehnenNotiz = $state('');
  let materialDialog = $state(null); // { meldung, vorlage }

  onMount(laden);

  async function laden() {
    try {
      const [m, e, k] = await Promise.all([
        api('GET', `/meldungen${ansicht === 'archiv' ? '?archiv=1' : ''}`),
        api('GET', '/eigenschaften'),
        api('GET', '/kategorien')
      ]);
      props = e;
      kategorien = k;
      meldungen = m;
      for (const x of m) {
        if (x.art === 'fehler' && x.eigenschaft && !entwuerfe[x.id]) {
          const p = props.find(q => q.kurzwort === x.eigenschaft.kurzwort);
          entwuerfe[x.id] = entwurfAusText(p, x.inhalt.neuer_wert, x.inhalt.einheit ?? '');
        }
      }
      if (ansicht === 'offen') onzaehler(m.length);
      geladen = true;
    } catch (err) {
      fehler = err.message;
    }
  }

  async function wechsle(neu) {
    ansicht = neu;
    ablehnenId = null;
    await laden();
  }

  async function aktion(fn, text) {
    fehler = '';
    hinweis = '';
    try {
      await fn();
      hinweis = text;
      await laden();
    } catch (err) {
      fehler = err.message;
    }
  }

  function uebernehmen(m) {
    const p = props.find(q => q.kurzwort === m.eigenschaft.kurzwort);
    return aktion(
      () => api('POST', `/meldungen/${m.id}/uebernehmen`, wertDatenAusEntwurf(p, entwuerfe[m.id])),
      'Wert übernommen.'
    );
  }

  function erledigt(m) {
    return aktion(() => api('POST', `/meldungen/${m.id}/erledigt`, {}), 'Als erledigt markiert.');
  }

  function ablehnen(m) {
    return aktion(async () => {
      await api('POST', `/meldungen/${m.id}/ablehnen`, { notiz: ablehnenNotiz });
      ablehnenId = null;
      ablehnenNotiz = '';
    }, 'Abgelehnt.');
  }

  function materialAnlegen(m) {
    materialDialog = { meldung: m, vorlage: vorlageAusVorschlag(m, props) };
  }

  async function materialGespeichert(id) {
    const m = materialDialog.meldung;
    materialDialog = null;
    await aktion(() => api('POST', `/meldungen/${m.id}/erledigt`, { material_id: id }), 'Material angelegt, Vorschlag erledigt.');
  }

  function zeit(s) {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  }

  const STATUS = { offen: 'Offen', uebernommen: 'Übernommen', abgelehnt: 'Abgelehnt' };
</script>

<div class="page-kopf">
  <div class="pillen" role="group" aria-label="Ansicht">
    <button class="pille" class:aktiv={ansicht === 'offen'} onclick={() => wechsle('offen')}>Offen</button>
    <button class="pille" class:aktiv={ansicht === 'archiv'} onclick={() => wechsle('archiv')}>Archiv</button>
  </div>
  <button class="btn btn-outline btn-sm" onclick={laden}>Aktualisieren</button>
  <span class="zaehler">{meldungen.length} {ansicht === 'offen' ? 'offen' : 'im Archiv'}</span>
</div>

{#if fehler}<p class="meldung-fehler" role="alert">{fehler}</p>{/if}
{#if hinweis}<p class="meldung-ok" role="status">{hinweis}</p>{/if}

{#if !geladen && !fehler}
  <p class="leer">Lade ...</p>
{:else if !meldungen.length}
  <p class="leer">{ansicht === 'offen' ? 'Keine offenen Meldungen.' : 'Das Archiv ist leer.'}</p>
{:else}
  <ul class="karten">
    {#each meldungen as m (m.id)}
      {@const p = m.eigenschaft ? props.find(q => q.kurzwort === m.eigenschaft.kurzwort) : null}
      <li class="karte card">
        <div class="karte-kopf">
          <span class="badge {m.art === 'fehler' ? 'badge-change' : 'badge-new'}">{m.art === 'fehler' ? 'Fehler' : 'Vorschlag'}</span>
          {#if m.art === 'fehler'}
            <strong class="titel">
              {#if m.material}<CategoryIcon name={m.material.icon} size={22} />{/if}
              {m.material?.name.de ?? 'Material gelöscht'}
            </strong>
          {:else}
            <strong class="titel">{m.inhalt.name}{m.inhalt.hersteller ? ` (${m.inhalt.hersteller})` : ''}</strong>
          {/if}
          <span class="datum">{zeit(m.erstellt_am)}</span>
          {#if ansicht === 'archiv'}<span class="badge {m.status === 'uebernommen' ? 'badge-active' : 'badge-rejected'}">{STATUS[m.status]}</span>{/if}
        </div>

        {#if m.art === 'fehler'}
          {#if m.eigenschaft}
            <div class="vergleich">
              <div class="spalte">
                <span class="spaltenkopf">{m.eigenschaft.name.de} · aktuell</span>
                <span class="wert">{aktuellText(m.aktuell)}</span>
              </div>
              <span class="pfeil" aria-hidden="true">→</span>
              <div class="spalte">
                <span class="spaltenkopf">Vorschlag des Besuchers{#if m.inhalt.neuer_wert}: „{m.inhalt.neuer_wert}{m.inhalt.einheit ? ` ${m.inhalt.einheit}` : ''}“{/if}</span>
                {#if ansicht === 'offen' && p && entwuerfe[m.id]}
                  <div class="eingabe">
                    {#if p.typ === 'zahl'}
                      <input class="input" inputmode="decimal" bind:value={entwuerfe[m.id].text} aria-label="Neuer Wert" />
                      <input class="input einheit" bind:value={entwuerfe[m.id].einheit} placeholder={p.einheit ?? 'Einheit'} aria-label="Einheit" />
                    {:else if p.typ === 'ja_nein'}
                      <select class="input" bind:value={entwuerfe[m.id].ja_nein} aria-label="Neuer Wert">
                        <option value="">–</option><option value="ja">ja</option><option value="nein">nein</option>
                      </select>
                    {:else if p.typ === 'auswahl'}
                      <select class="input" bind:value={entwuerfe[m.id].option_id} aria-label="Neuer Wert">
                        <option value="">–</option>
                        {#each p.optionen as o (o.id)}<option value={o.id}>{o.de}</option>{/each}
                      </select>
                    {:else}
                      <input class="input" bind:value={entwuerfe[m.id].text} aria-label="Neuer Wert" />
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {:else}
          <ul class="werte">
            {#each m.inhalt.werte as w (w.eigenschaft)}
              <li><span class="wname">{w.name.de}</span> {w.wert}{w.einheit ? ` ${w.einheit}` : ''}</li>
            {/each}
            {#if m.inhalt.kategorie_id}
              <li><span class="wname">Kategorie</span> {kategorien.find(k => k.id === m.inhalt.kategorie_id)?.name_de ?? '–'}</li>
            {/if}
          </ul>
        {/if}

        {#if m.kommentar}<p class="kommentar">{m.kommentar}</p>{/if}
        <p class="meta">
          {#if m.quelle}Quelle: <a href={m.quelle} target="_blank" rel="noopener noreferrer nofollow">{m.quelle}</a>{/if}
          {#if m.kontakt}<span>Kontakt: {m.kontakt}</span>{/if}
        </p>
        {#if m.admin_notiz}<p class="notiz">Notiz: {m.admin_notiz}</p>{/if}

        {#if ansicht === 'offen'}
          {#if ablehnenId === m.id}
            <div class="ablehnen">
              <input class="input" placeholder="Notiz (optional)" maxlength="500" bind:value={ablehnenNotiz} aria-label="Notiz zum Ablehnen" />
              <button class="btn btn-danger btn-sm" onclick={() => ablehnen(m)}>Ablehnen</button>
              <button class="btn btn-ghost btn-sm" onclick={() => (ablehnenId = null)}>Abbrechen</button>
            </div>
          {:else}
            <div class="aktionen">
              {#if m.art === 'fehler'}
                {#if m.eigenschaft && m.material}
                  <button class="btn btn-primary btn-sm" onclick={() => uebernehmen(m)}>Übernehmen</button>
                {/if}
                <button class="btn btn-outline btn-sm" onclick={() => erledigt(m)}>Als erledigt markieren</button>
              {:else}
                <button class="btn btn-primary btn-sm" onclick={() => materialAnlegen(m)}>Als Material anlegen …</button>
              {/if}
              <button class="btn btn-ghost btn-sm gefahr" onclick={() => { ablehnenId = m.id; ablehnenNotiz = ''; }}>Ablehnen</button>
            </div>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if materialDialog}
  {#key materialDialog}
    <MaterialForm
      material={null}
      vorlage={materialDialog.vorlage}
      {props}
      {kategorien}
      onsaved={materialGespeichert}
      onclose={() => (materialDialog = null)}
    />
  {/key}
{/if}

<style>
  .karten { list-style: none; display: flex; flex-direction: column; gap: .75rem; }
  .karte { padding: .875rem 1rem; display: flex; flex-direction: column; gap: .6rem; }
  .karte-kopf { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; }
  .titel { display: inline-flex; align-items: center; gap: .4rem; font-size: .9375rem; }
  .datum { color: var(--fg-muted); font-size: .75rem; margin-left: auto; }
  .vergleich { display: grid; grid-template-columns: 1fr auto 1fr; gap: .75rem; align-items: center; background: var(--bg-input); border-radius: var(--radius-sm); padding: .6rem .75rem; }
  .spalte { display: flex; flex-direction: column; gap: .25rem; min-width: 0; }
  .spaltenkopf { color: var(--fg-muted); font-size: .75rem; }
  .wert { font-size: .9375rem; }
  .pfeil { color: var(--fg-muted); }
  .eingabe { display: flex; gap: .4rem; }
  .einheit { max-width: 7rem; }
  .werte { list-style: none; display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; font-size: .8125rem; }
  .wname { color: var(--fg-muted); margin-right: .25rem; }
  .kommentar { font-size: .8125rem; white-space: pre-wrap; word-break: break-word; border-left: 2px solid var(--border); padding-left: .6rem; }
  .meta { display: flex; flex-wrap: wrap; gap: .25rem 1rem; color: var(--fg-muted); font-size: .75rem; word-break: break-all; }
  .meta a { color: var(--primary); }
  .notiz { font-size: .75rem; color: var(--amber); }
  .aktionen, .ablehnen { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  .ablehnen .input { flex: 1 1 220px; }
  .gefahr { color: var(--danger); }
  @media (max-width: 640px) { .vergleich { grid-template-columns: 1fr; } .pfeil { display: none; } }
</style>
