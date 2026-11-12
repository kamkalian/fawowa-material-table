import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { neuerSpeicher } from './hilfen.js';
import { anlegenMaterial, setzeWert, FehlerEingabe } from '../lib/admin.js';
import {
  legeMeldungAn, listeMeldungen, zaehleOffene, uebernehmeFehler, schliesseAb, lehneAb
} from '../lib/meldungen.js';
import { erzeugeToken, pruefeToken, Begrenzung, MIN_MS, MAX_MS } from '../lib/spam.js';
import { registerMeldungRoutes } from '../lib/meldungen-routes.js';

function neueDb() {
  const { s: db, kat } = neuerSpeicher();
  const material = anlegenMaterial(db, { name_de: 'Pappel', kategorie_id: kat, status: 'veroeffentlicht' });
  setzeWert(db, material, 'gewicht', { zahl: 2.5 });
  const entwurf = anlegenMaterial(db, { name_de: 'Geheim', kategorie_id: kat, status: 'entwurf' });
  return { db, kat, material, entwurf };
}

// --- Spam-Schutz ---

test('Token: zu schnell, passend, abgelaufen, manipuliert', () => {
  const jetzt = 1_800_000_000_000;
  const token = erzeugeToken(jetzt);
  assert.deepEqual(pruefeToken(token, { jetzt: jetzt + 1000 }), { ok: false, grund: 'zu_schnell' });
  assert.deepEqual(pruefeToken(token, { jetzt: jetzt + MIN_MS + 1 }), { ok: true });
  assert.deepEqual(pruefeToken(token, { jetzt: jetzt + MAX_MS + 1 }), { ok: false, grund: 'abgelaufen' });

  const [zeit, sig] = token.split('.');
  assert.equal(pruefeToken(`${Number(zeit) - 100000}.${sig}`, { jetzt: jetzt + 10_000 }).grund, 'ungueltig');
  assert.equal(pruefeToken('quatsch').grund, 'ungueltig');
  assert.equal(pruefeToken(undefined).grund, 'ungueltig');
  assert.equal(pruefeToken(token, { jetzt: jetzt + MIN_MS + 1, geheimnis: Buffer.from('anderes') }).grund, 'ungueltig');
});

test('Begrenzung: höchstens fünf pro Stunde je Adresse, danach wieder frei', () => {
  const b = new Begrenzung({ max: 5, fensterMs: 3_600_000 });
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) { assert.equal(b.erlaubt('1.2.3.4', t0 + i), true); b.zaehle('1.2.3.4', t0 + i); }
  assert.equal(b.erlaubt('1.2.3.4', t0 + 10), false);
  assert.equal(b.erlaubt('5.6.7.8', t0 + 10), true);          // andere Adresse ist nicht betroffen
  assert.equal(b.erlaubt('1.2.3.4', t0 + 3_600_001), true);   // nach einer Stunde wieder frei
});

// --- Meldungen anlegen ---

test('Fehlermeldung: Pflichtangaben, Material muss veröffentlicht sein, Eigenschaft muss existieren', () => {
  const { db, material, entwurf } = neueDb();
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material }), /Kommentar oder den richtigen Wert/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, neuer_wert: '3' }), /Eigenschaft wählen/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, eigenschaft: 'gibtsnicht', neuer_wert: '3' }), /Unbekannte Eigenschaft/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: entwurf, kommentar: 'x' }), /Material nicht gefunden/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: 999, kommentar: 'x' }), /Material nicht gefunden/);

  const id = legeMeldungAn(db, { art: 'fehler', material_id: material, eigenschaft: 'gewicht', neuer_wert: '2,8', einheit: 'kg/m²', kommentar: 'Laut Datenblatt', kontakt: 'a@b.de' });
  assert.ok(id > 0);
  assert.equal(zaehleOffene(db), 1);
  assert.equal(db.material(material).werte.gewicht.zahl, 2.5); // nichts verändert
});

test('Fehlermeldung nur mit Kommentar reicht', () => {
  const { db, material } = neueDb();
  assert.ok(legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'Name falsch geschrieben' }) > 0);
});

test('Vorschlag: Name und mindestens ein Wert, Eigenschaften aus der Liste, keine Doppelten', () => {
  const { db, kat } = neueDb();
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', werte: [{ eigenschaft: 'staerke', wert: '4' }] }), /Namen/);
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', name: 'X', werte: [] }), /mindestens einen Wert/);
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', name: 'X', werte: [{ eigenschaft: 'staerke', wert: '' }, { eigenschaft: '', wert: '' }] }), /mindestens einen Wert/);
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', name: 'X', werte: [{ eigenschaft: 'staerke' , wert: ''}, { eigenschaft: 'gewicht', wert: '1' }, { eigenschaft: '', wert: '2' }] }), /Eigenschaft und Wert/);
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', name: 'X', werte: [{ eigenschaft: 'nope', wert: '1' }] }), /Unbekannte Eigenschaft/);
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', name: 'X', werte: [{ eigenschaft: 'staerke', wert: '1' }, { eigenschaft: 'staerke', wert: '2' }] }), /doppelt/);
  assert.throws(() => legeMeldungAn(db, { art: 'vorschlag', name: 'X', kategorie_id: 999, werte: [{ eigenschaft: 'staerke', wert: '1' }] }), /Kategorie unbekannt/);

  const id = legeMeldungAn(db, { art: 'vorschlag', name: ' Birke ', hersteller: 'ACME', kategorie_id: kat, werte: [{ eigenschaft: 'staerke', wert: '4', einheit: 'mm' }, { eigenschaft: '', wert: '' }], quelle: 'https://example.org/birke' });
  const m = listeMeldungen(db)[0];
  assert.equal(m.id, id);
  assert.equal(m.inhalt.name, 'Birke');
  assert.equal(m.inhalt.werte.length, 1);
  assert.equal(m.inhalt.werte[0].name.de, 'Stärke');
  assert.equal(m.quelle, 'https://example.org/birke');
});

test('Längen, Links und Steuerzeichen werden geprüft', () => {
  const { db, material } = neueDb();
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'x'.repeat(2001) }), /höchstens 2000/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'x', kontakt: 'y'.repeat(201) }), /Kontakt/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'x', quelle: 'javascript:alert(1)' }), /http/);
  assert.throws(() => legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: { a: 1 } }), /ungültige Eingabe/);
  assert.throws(() => legeMeldungAn(db, { art: 'unbekannt' }), /Art der Meldung/);
  legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'Hallo\u0000 Welt\u0007' });
  assert.equal(listeMeldungen(db)[0].kommentar, 'Hallo Welt');
});

// --- Bearbeiten ---

test('Übernehmen setzt den Wert, schließt die Meldung ab; doppelt geht nicht', () => {
  const { db, material } = neueDb();
  const id = legeMeldungAn(db, { art: 'fehler', material_id: material, eigenschaft: 'gewicht', neuer_wert: '2,8', kommentar: 'Datenblatt' });
  const liste = listeMeldungen(db);
  assert.equal(liste[0].aktuell.zahl, 2.5);
  assert.equal(liste[0].eigenschaft.kurzwort, 'gewicht');

  uebernehmeFehler(db, id, { zahl: '2,8', einheit: 'kg/m²' });
  assert.equal(db.material(material).werte.gewicht.zahl, 2.8);
  assert.equal(zaehleOffene(db), 0);
  assert.equal(listeMeldungen(db).length, 0);
  assert.equal(listeMeldungen(db, { archiv: true })[0].status, 'uebernommen');
  assert.throws(() => uebernehmeFehler(db, id, { zahl: '3' }), /schon erledigt/);
});

test('Ungültiger Wert beim Übernehmen lässt die Meldung offen; Meldung ohne Wert nur als erledigt', () => {
  const { db, material } = neueDb();
  const mitWert = legeMeldungAn(db, { art: 'fehler', material_id: material, eigenschaft: 'gewicht', neuer_wert: 'viel' });
  assert.throws(() => uebernehmeFehler(db, mitWert, { zahl: 'viel' }), FehlerEingabe);
  assert.equal(zaehleOffene(db), 1);

  const nurKommentar = legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'Tippfehler im Namen' });
  assert.throws(() => uebernehmeFehler(db, nurKommentar, {}), /als erledigt markieren/);
  schliesseAb(db, nurKommentar);
  assert.equal(zaehleOffene(db), 1);
});

test('Vorschlag abschließen verknüpft das neue Material; Ablehnen merkt die Notiz; Archiv hält beides', () => {
  const { db, kat, material } = neueDb();
  const v = legeMeldungAn(db, { art: 'vorschlag', name: 'Birke', werte: [{ eigenschaft: 'staerke', wert: '4' }] });
  const neu = anlegenMaterial(db, { name_de: 'Birke', kategorie_id: kat });
  schliesseAb(db, v, neu);
  assert.equal(listeMeldungen(db, { archiv: true }).find(m => m.id === v).material_id, neu);
  assert.throws(() => schliesseAb(db, v), /schon erledigt/);

  const spam = legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'Kauft bei mir' });
  lehneAb(db, spam, 'Werbung');
  const archiv = listeMeldungen(db, { archiv: true });
  assert.deepEqual(archiv.map(a => a.status).sort(), ['abgelehnt', 'uebernommen']);
  assert.equal(archiv.find(a => a.status === 'abgelehnt').admin_notiz, 'Werbung');
  assert.throws(() => schliesseAb(db, 99999), /nicht gefunden/);
  assert.throws(() => schliesseAb(db, legeMeldungAn(db, { art: 'fehler', material_id: material, kommentar: 'x' }), 99999), /Material nicht gefunden/);
});

// --- HTTP: Token, Honigtopf, Begrenzung ---

async function starteServer(optionen) {
  const { db, material } = neueDb();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '50kb' }));
  registerMeldungRoutes(app, db, optionen);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const basis = `http://127.0.0.1:${server.address().port}`;
  after(() => server.close());
  const token = async () => (await (await fetch(`${basis}/api/v2/formular-token`)).json()).token;
  const senden = (body, ip = '9.9.9.9') => fetch(`${basis}/api/v2/meldungen`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(body)
  });
  return { db, material, token, senden };
}

test('HTTP: gültige Meldung wird gespeichert, Token zu schnell und ungültig werden abgelehnt', async () => {
  const { db, material, token, senden } = await starteServer({ minMs: 0 });
  const ok = await senden({ token: await token(), art: 'fehler', material_id: material, kommentar: 'Test' });
  assert.equal(ok.status, 201);
  assert.equal(zaehleOffene(db), 1);

  assert.equal((await senden({ art: 'fehler', material_id: material, kommentar: 'ohne Token' })).status, 400);
  assert.equal((await senden({ token: 'abc.def', art: 'fehler', material_id: material, kommentar: 'falscher Token' })).status, 400);
  const fehler = await senden({ token: await token(), art: 'fehler', material_id: material });
  assert.equal(fehler.status, 400);
  assert.match((await fehler.json()).error, /Kommentar/);
  assert.equal(zaehleOffene(db), 1);
});

test('HTTP: Mindestzeit wird erzwungen', async () => {
  const { db, material, token, senden } = await starteServer({ minMs: 60_000 });
  const antwort = await senden({ token: await token(), art: 'fehler', material_id: material, kommentar: 'sofort' });
  assert.equal(antwort.status, 400);
  assert.equal((await antwort.json()).grund, 'zu_schnell');
  assert.equal(zaehleOffene(db), 0);
});

test('HTTP: Honigtopf wird scheinbar akzeptiert, aber nichts gespeichert', async () => {
  const { db, material, token, senden } = await starteServer({ minMs: 0 });
  const antwort = await senden({ token: await token(), art: 'fehler', material_id: material, kommentar: 'Bot', website: 'http://spam.example' });
  assert.equal(antwort.status, 201);
  assert.equal(zaehleOffene(db), 0);
});

test('HTTP: sechste Meldung derselben Adresse in einer Stunde wird abgelehnt, andere Adresse nicht', async () => {
  const { db, material, token, senden } = await starteServer({ minMs: 0 });
  for (let i = 0; i < 5; i++) {
    assert.equal((await senden({ token: await token(), art: 'fehler', material_id: material, kommentar: `Meldung ${i}` }, '7.7.7.7')).status, 201);
  }
  assert.equal((await senden({ token: await token(), art: 'fehler', material_id: material, kommentar: 'zu viel' }, '7.7.7.7')).status, 429);
  assert.equal((await senden({ token: await token(), art: 'fehler', material_id: material, kommentar: 'andere Adresse' }, '8.8.8.8')).status, 201);
  assert.equal(zaehleOffene(db), 6);
});
