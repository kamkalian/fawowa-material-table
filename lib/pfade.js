// Adresse des Admin-Bereichs. Sie ist absichtlich nicht /admin, sondern ein Fantasiename.
// Das ist kein Geheimnis (die öffentliche Seite verlinkt darauf), nur weniger Angriffsfläche für automatische Suchen.
// Der Schutz ist der Login. Änderbar mit der Umgebungsvariable ADMIN_PATH (z. B. "meine-werkstatt").

export const STANDARD_ADMIN_PFAD = '/wunderkammer';

// Diese Namen gehören der Anwendung selbst
const RESERVIERT = new Set(['api', 'assets', 'admin', 'admin.html', 'index.html']);

export function adminPfad(env = process.env, warnung = console.warn) {
  const roh = String(env.ADMIN_PATH ?? '').trim().toLowerCase();
  if (!roh) return STANDARD_ADMIN_PFAD;

  const pfad = roh.startsWith('/') ? roh : `/${roh}`;
  if (!/^\/[a-z0-9][a-z0-9-]{2,39}$/.test(pfad) || RESERVIERT.has(pfad.slice(1))) {
    warnung(`ADMIN_PATH "${roh}" ist ungültig (3 bis 40 Zeichen: a-z, 0-9, Bindestrich; nicht "admin" oder "api"). Es gilt ${STANDARD_ADMIN_PFAD}.`);
    return STANDARD_ADMIN_PFAD;
  }
  return pfad;
}
