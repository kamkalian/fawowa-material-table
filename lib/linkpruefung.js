// Prüft die Links der Materialien und merkt sich das Ergebnis in der Datenbank (Tabelle link: status, geprueft_am).
// Status: 'ok' (erreichbar), 'unklar' (Seite antwortet, lässt aber automatische Abfragen nicht zu, z. B. 403/429),
//         'kaputt' (nicht erreichbar oder Fehlerseite).
// Geprüft werden nur Adressen, die in der Datenbank stehen. Adressen im lokalen Netz werden nie abgefragt.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 8000;
const MAX_UMLEITUNGEN = 4;
const PARALLEL = 4;

/** Liegt die IP-Adresse im lokalen, privaten oder reservierten Bereich? */
export function istPrivateAdresse(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const kurz = ip.toLowerCase();
  if (kurz.startsWith('::ffff:')) return istPrivateAdresse(kurz.slice(7));
  return kurz === '::' || kurz === '::1' || kurz.startsWith('fe80') || kurz.startsWith('fc') || kurz.startsWith('fd');
}

async function erlaubt(url, aufloesen) {
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  const adressen = isIP(host) ? [host] : await aufloesen(host);
  return adressen.length > 0 && adressen.every(a => !istPrivateAdresse(a));
}

const aufloesenStandard = async (host) => (await lookup(host, { all: true })).map(a => a.address);

/**
 * Prüft eine Adresse und liefert 'ok', 'unklar' oder 'kaputt'.
 * fetchFn und aufloesen lassen sich in Tests ersetzen.
 */
export async function pruefeUrl(adresse, { fetchFn = fetch, aufloesen = aufloesenStandard } = {}) {
  let url;
  try { url = new URL(adresse); } catch { return 'kaputt'; }

  try {
    for (let i = 0; i <= MAX_UMLEITUNGEN; i++) {
      if (!(await erlaubt(url, aufloesen))) return 'kaputt';
      const anfrage = (method) => fetchFn(url, {
        method, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Materialdatenbank-Linkpruefung', Accept: '*/*' }
      });
      let antwort = await anfrage('HEAD');
      // Manche Server kennen HEAD nicht oder blocken es: dann mit GET versuchen
      if ([400, 403, 405, 501].includes(antwort.status)) antwort = await anfrage('GET');
      const s = antwort.status;
      if (s >= 300 && s < 400 && antwort.headers.get('location')) {
        url = new URL(antwort.headers.get('location'), url);
        continue;
      }
      if (s < 300) return 'ok';
      if ([401, 403, 429].includes(s)) return 'unklar';
      return 'kaputt';
    }
    return 'kaputt'; // zu viele Umleitungen
  } catch {
    return 'kaputt'; // Zeitüberschreitung, Name nicht auflösbar, Verbindung abgelehnt ...
  }
}

let laeuft = false;

export const pruefungLaeuft = () => laeuft;

/** Alle Links mit Material und Prüfergebnis für die Übersicht im Admin-Bereich: Kaputte zuerst, dann unklare, ungeprüfte, funktionierende */
export function listeLinks(db) {
  return db.prepare(`
    SELECT l.id, l.beschriftung, l.url, l.status, l.geprueft_am,
           m.id AS material_id, m.name_de AS material_name, m.status AS material_status
    FROM link l JOIN material m ON m.id = l.material_id
    ORDER BY CASE WHEN l.status = 'kaputt' THEN 0 WHEN l.status = 'unklar' THEN 1 WHEN l.status IS NULL THEN 2 ELSE 3 END,
             m.name_de COLLATE NOCASE, l.reihenfolge, l.id
  `).all();
}

/** Anzahl der Links, die nicht erreichbar sind (für den Zähler in der Navigation) */
export function zaehleKaputte(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM link WHERE status = 'kaputt'").get().n;
}

/** Prüft alle Links und speichert die Ergebnisse. Liefert die Anzahl je Status oder null, wenn schon eine Prüfung läuft. */
export async function pruefeAlleLinks(db, optionen = {}) {
  if (laeuft) return null;
  laeuft = true;
  try {
    const links = db.prepare('SELECT id, url FROM link').all();
    const speichere = db.prepare("UPDATE link SET status = ?, geprueft_am = datetime('now') WHERE id = ?");
    const summe = { ok: 0, unklar: 0, kaputt: 0 };
    const warteschlange = [...links];
    const arbeiter = Array.from({ length: Math.min(PARALLEL, warteschlange.length) }, async () => {
      while (warteschlange.length) {
        const l = warteschlange.shift();
        const status = await pruefeUrl(l.url, optionen);
        summe[status]++;
        speichere.run(status, l.id);
      }
    });
    await Promise.all(arbeiter);
    return summe;
  } finally {
    laeuft = false;
  }
}
