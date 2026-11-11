# Materialdatenbank

Öffentliche Material-Datenbank für den Fahrradwohnwagen-Bau: Besucher finden und vergleichen Baustoffe in einer
filterbaren Tabelle, Besucher können Fehler melden und neue Materialien vorschlagen, und ein Admin-Bereich dient
der Datenpflege. Oberfläche in Deutsch und Englisch.

Aufbau und Entscheidungen stehen in [docs/PLAN.md](docs/PLAN.md).

## Technik

- Node.js mit Express, Daten in SQLite (`data/material.db`, über `better-sqlite3`)
- Oberfläche mit Svelte und Vite (öffentliche Tabelle unter `/`, Admin-Bereich unter dem Fantasienamen `/wunderkammer`)
- Betrieb als Docker-Container hinter Caddy, siehe [deploy/README.md](deploy/README.md)

## Entwickeln

```bash
npm install
node scripts/import-startdaten.js     # einmalig: Startdaten aus docs/startdaten.csv einspielen
node scripts/admin-passwort.js        # Admin-Passwort festlegen (schreibt den Hash in .env)
npm run dev                           # API auf :3456, Oberfläche auf :5173
npm test                              # automatische Tests
```

Admin-Bereich in der Entwicklung: <http://localhost:5173/wunderkammer>. Die Adresse ist kein Geheimnis (die öffentliche
Seite verlinkt dezent darauf), der Schutz ist der Login. Ändern mit `ADMIN_PATH` in der `.env`; `/admin` gibt es bewusst nicht.

## Aufbau

```
server.js                  Einstieg: öffentliche API, Meldungen, Admin-API
lib/                       Datenbank, Admin-Funktionen, Anmeldung, Meldungen und Spam-Schutz
src/public/                öffentliche Tabelle, Filter, Meldeformulare
src/admin/                 Admin-Bereich
src/shared/                gemeinsame Teile (Kategorie-Icons)
scripts/                   Startdaten einspielen, Admin-Passwort festlegen
tests/                     automatische Tests
deploy/                    Docker, Caddy und Skript zum Ausliefern
docs/                      Plan und Startdaten
```

## Sicherheit

- Das Admin-Passwort steht nur als Hash in `.env` (`ADMIN_PASSWORD_HASH`), nie im Repo.
- Meldungen von Besuchern erscheinen erst öffentlich, wenn sie im Admin-Bereich übernommen wurden.
