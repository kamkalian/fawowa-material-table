// Abgleich mit dem Daten-Repository: Änderungen aus dem Repo laden (mit Prüfung) und lokale Änderungen senden.

import { FehlerEingabe } from './fehler.js';
import { liesVerzeichnis } from './speicher.js';

function braucheRepo(s) {
  if (!s.git) throw new FehlerEingabe('Die Versionsverwaltung (git) ist nicht verfügbar.', 503);
  if (!s.git.remote) throw new FehlerEingabe('Es ist kein Repository eingerichtet (DATEN_REPO in der .env).', 400);
  return s.git;
}

/** Stand des Abgleichs für den Admin-Bereich */
export function repoStatus(s) {
  if (!s.git) return { verfuegbar: false };
  return { verfuegbar: true, ...s.git.status(), ladeFehler: s.ladeFehler };
}

/**
 * Lädt neue Commits aus dem Repo und prüft alle Dateien. Nur wenn alles in Ordnung ist, gelten die neuen Daten;
 * sonst wird der alte Stand wiederhergestellt und die Liste der Fehler zurückgegeben.
 */
export async function ladeAusRepo(s) {
  const git = braucheRepo(s);
  try {
    await git.holen();
  } catch (e) {
    throw new FehlerEingabe(`Das Repository ist nicht erreichbar: ${e.message.split('\n').slice(-1)[0].slice(0, 200)}`, 502);
  }

  // Ab hier keine Pause mehr (kein await): Zusammenführen, Prüfen und Übernehmen laufen in einem Zug
  const { ahead, behind } = git.abstand();
  if (behind === 0) return { ergebnis: 'aktuell', ahead };
  if (ahead > 0) {
    throw new FehlerEingabe(
      `Hier liegen ${ahead} Änderungen, die noch nicht im Repo sind, und im Repo gibt es ${behind} neue. Das lässt sich nicht automatisch zusammenführen. ` +
      'Bitte die Änderungen im Repo und hier abstimmen (z. B. im Repo ein Pull Request, der die Änderungen von hier enthält).', 409
    );
  }

  const alterKopf = git.kopf();
  try {
    git.vorspulen();
  } catch (e) {
    throw new FehlerEingabe(`Die Änderungen konnten nicht übernommen werden: ${e.message.slice(0, 300)}`, 409);
  }
  const { daten, fehler, ergaenzt } = liesVerzeichnis(s.verzeichnis);
  if (fehler.length) {
    git.zuruecksetzen(alterKopf);
    throw new FehlerEingabe(
      `Die neuen Daten haben ${fehler.length} Fehler und wurden nicht übernommen. Es gilt weiter der bisherige Stand.`, 422, fehler
    );
  }

  s.ersetze(daten);
  s.ladeFehler = []; // gesperrte Änderungen sind damit wieder frei
  s._geschrieben = s._leseVorhandene();
  if (ergaenzt) s.speichereAlles('IDs ergänzt');
  return { ergebnis: 'geladen', neueCommits: behind, materialien: daten.materialien.length };
}

/** Sendet lokale Commits sofort an das Repo */
export async function sendeAnRepo(s) {
  const git = braucheRepo(s);
  const r = await git.senden();
  if (!r.ok) throw new FehlerEingabe(git.pushFehler ?? 'Senden ist gerade nicht möglich.', 409);
  return { ergebnis: 'gesendet', ...git.status() };
}
