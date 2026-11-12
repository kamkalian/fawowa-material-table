# Materialdatenbank

Öffentliche Material-Datenbank für den Fahrradwohnwagen-Bau: Besucher finden und vergleichen Baustoffe in einer
filterbaren Tabelle, Besucher können Fehler melden und neue Materialien vorschlagen, und ein Admin-Bereich dient
der Datenpflege. Oberfläche in Deutsch und Englisch.

Aufbau und Entscheidungen stehen in [docs/PLAN.md](docs/PLAN.md).

## Technik

- Node.js mit Express. Die Daten liegen als JSON-Dateien in einem Git-Repository (eine Datei je Material), jede Änderung
  im Admin-Bereich wird als Commit festgehalten und ins Repo gesendet. Keine Datenbank. Siehe [docs/DATEN.md](docs/DATEN.md).
- Oberfläche mit Svelte und Vite (öffentliche Tabelle unter `/`, Admin-Bereich unter dem Fantasienamen `/wunderkammer`)
- Betrieb als Docker-Container hinter Caddy, siehe [deploy/README.md](deploy/README.md)

## Entwickeln

```bash
npm install
# Daten: DATEN_REPO in der .env setzen (klont das Daten-Repo nach data/repo) oder ohne Angabe lokal mit leerem Start
node scripts/admin-passwort.js        # Admin-Passwort festlegen (schreibt den Hash in .env)
npm run dev                           # API auf :3456, Oberfläche auf :5173
npm test                              # automatische Tests
```

Admin-Bereich in der Entwicklung: <http://localhost:5173/wunderkammer>. Die Adresse ist kein Geheimnis (die öffentliche
Seite verlinkt dezent darauf), der Schutz ist der Login. Ändern mit `ADMIN_PATH` in der `.env`; `/admin` gibt es bewusst nicht.

## Aufbau

```
server.js                  Einstieg: öffentliche API, Meldungen, Admin-API
lib/                       Datenspeicher (Dateien + Git), Admin-Funktionen, Anmeldung, Meldungen und Spam-Schutz
src/public/                öffentliche Tabelle, Filter, Meldeformulare
src/admin/                 Admin-Bereich
src/shared/                gemeinsame Teile (Kategorie-Icons)
scripts/                   Admin-Passwort festlegen, einmalige Umstellung von SQLite auf Dateien
tests/                     automatische Tests
deploy/                    Docker, Caddy und Skript zum Ausliefern
docs/                      Plan und Beschreibung der Daten
```

## Sicherheit

- Das Admin-Passwort steht nur als Hash in `.env` (`ADMIN_PASSWORD_HASH`), nie im Repo.
- Meldungen von Besuchern erscheinen erst öffentlich, wenn sie im Admin-Bereich übernommen wurden.
