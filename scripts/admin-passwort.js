// Erzeugt den Passwort-Hash für den Admin-Bereich und trägt ihn in die Datei .env ein.
//
// Aufruf:  node scripts/admin-passwort.js
// Die Zeile ADMIN_PASSWORD_HASH=... wird in .env ersetzt oder angelegt. Das Passwort selbst wird nirgends gespeichert.
// Danach den Server neu starten, damit die Änderung wirkt.

import { createInterface } from 'readline/promises';
import { stdin, stdout } from 'process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { hashPasswort } from '../lib/auth.js';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const SCHLUESSEL = 'ADMIN_PASSWORD_HASH';

const rl = createInterface({ input: stdin, output: stdout });
const passwort = (await rl.question('Neues Admin-Passwort (mind. 12 Zeichen): ')).trim();
rl.close();

if (passwort.length < 12) {
  console.error('Abbruch: Das Passwort muss mindestens 12 Zeichen haben.');
  process.exit(1);
}

const zeile = `${SCHLUESSEL}=${hashPasswort(passwort)}`;
const alt = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
const zeilen = alt.split(/\r?\n/).filter(z => z !== '');
const index = zeilen.findIndex(z => z.startsWith(`${SCHLUESSEL}=`));
if (index >= 0) zeilen[index] = zeile;
else zeilen.push(zeile);
writeFileSync(ENV_PATH, zeilen.join('\n') + '\n', 'utf8');

console.log(`Gespeichert in ${ENV_PATH}`);
console.log('Server neu starten, damit der neue Zugang gilt.');
