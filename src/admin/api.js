// Aufrufe der Admin-API. Bei fehlender Sitzung wird das Ereignis "admin-abgemeldet" ausgelöst.

export async function api(method, pfad, body) {
  const res = await fetch(`/api/admin${pfad}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (res.status === 401 && pfad !== '/login') {
    window.dispatchEvent(new CustomEvent('admin-abgemeldet'));
    throw new Error('Sitzung abgelaufen. Bitte erneut anmelden.');
  }
  if (res.status === 204) return null;

  const daten = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404 && !daten.error) {
      throw new Error('Der Server kennt diese Funktion nicht (404). Vermutlich läuft noch eine ältere Version: bitte den Server beenden und neu starten.');
    }
    throw new Error(daten.error || `Fehler ${res.status}`);
  }
  return daten;
}
