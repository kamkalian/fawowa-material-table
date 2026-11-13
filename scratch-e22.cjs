const fs = require('fs');
function ed(f, pairs) {
  let s = fs.readFileSync(f, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + ' fehlt: ' + a.slice(0, 70));
    s = s.replace(a, b);
  }
  fs.writeFileSync(f, s);
}
ed('docs/DATEN.md', [
  ["materialien/<name>-<id>.json     eine Datei je Material\n", "materialien/<name>-<id>.json     eine Datei je Material\nunterstuetzer.json               Liste der Unterstützer (Name, Abzeichen), nur Personen, die der Anzeige zugestimmt haben; keine Beträge\n"],
  ["Nicht im Repo (liegt lokal in `data/lokal/`): `meldungen.json` (enthält Kontaktangaben von Besuchern), `linkstatus.json`\n(Ergebnis der Link-Prüfung), `unterstuetzung.json` (über Ko-fi gemeldete Beträge).",
   "Nicht im Repo (liegt lokal in `data/lokal/`): `meldungen.json` (enthält Kontaktangaben von Besuchern), `linkstatus.json`\n(Ergebnis der Link-Prüfung), `unterstuetzung.json` (alle Geldeingänge mit Beträgen, auch die über Ko-fi gemeldeten)."],
  ["## Prüfung\n", `## unterstuetzer.json

\`\`\`json
[
  { "id": 1, "name": "Ida", "abzeichen": ["ideengeber", "datenpfleger"], "zustimmung_am": "2026-11-12 08:00:00", "zustimmung_art": "manuell" }
]
\`\`\`

- Das Repo ist öffentlich: Hier stehen nur Name und Abzeichen von Personen, die der Anzeige ausdrücklich zugestimmt haben, nie Beträge.
  Die Geldeingänge liegen lokal auf dem Server und verweisen über die \`id\` auf die Person.
- \`abzeichen\`: Liste aus \`starthelfer\`, \`kaffee\`, \`wiederkehrend\`, \`grosszuegig\`, \`ideengeber\`, \`datenpfleger\`, \`botschafter\`
  (siehe \`lib/abzeichen.js\`). Mehrere sind möglich.
- \`zustimmung_art\`: \`manuell\` (vom Betreiber eingetragen) oder \`kofi-oeffentlich\` (Beitrag bei Ko-fi als öffentlich markiert).
- \`id\` und \`zustimmung_am\` dürfen bei von Hand ergänzten Einträgen fehlen. Die Datei entfällt, wenn es keine Unterstützer gibt.
- Wer aus der Liste entfernt wird, steht weiter im Verlauf (alte Commits). Soll ein Name auch dort verschwinden, muss der Verlauf
  des Repos umgeschrieben werden.

## Prüfung
`],
  ["Beim Laden aus dem Repo wird jede Datei geprüft: gültiges JSON, Pflichtfelder, bekannte Kategorie und Eigenschaften,\nWerte passend zum Typ, vorhandene Auswahlen, Links mit `http://` oder `https://`, keine doppelten IDs.", "Beim Laden aus dem Repo wird jede Datei geprüft: gültiges JSON, Pflichtfelder, bekannte Kategorie und Eigenschaften,\nWerte passend zum Typ, vorhandene Auswahlen, Links mit `http://` oder `https://`, keine doppelten IDs, bei Unterstützern\nName und bekannte Abzeichen."]
]);
ed('src/public/Datenschutz.svelte', [
  ["Dafür speichern wir deinen Namen, den Zeitpunkt der Einwilligung und deine Beträge auf unserem Server, nicht im öffentlichen Datenrepository. Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen: Schreib uns an die oben genannte Adresse, dann nehmen wir dich aus der Liste und löschen deinen Namen. Deine Beträge bleiben ohne Namen im Fortschrittsbalken erhalten.",
   "Dafür speichern wir deinen Namen, die Abzeichen und den Zeitpunkt der Einwilligung in der Liste der Unterstützer im öffentlichen Datenrepository auf GitHub (dort steht dein Name also für jeden lesbar, auch mit dem Verlauf der Änderungen). Deine Beträge speichern wir getrennt davon nur auf unserem Server und veröffentlichen sie nicht. Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen: Schreib uns an die oben genannte Adresse, dann nehmen wir dich aus der Liste, löschen deinen Namen auch aus dem Verlauf des Repositorys und trennen ihn von deinen Beträgen. Deine Beträge bleiben ohne Namen im Fortschrittsbalken erhalten. GitHub ist ein Dienst eines Drittanbieters; was dort über Besucher des Repositorys verarbeitet wird, steht in dessen Datenschutzerklärung."],
  ["We store your name, the time of your consent and your amounts on our server, not in the public data repository. You can withdraw your consent at any time with effect for the future: write to us at the address above and we will remove you from the list and delete your name. Your amounts remain in the progress bar without a name.", "We store your name, the badges and the time of your consent in the supporters list in the public data repository on GitHub (so your name is readable by anyone there, including in the change history). Your amounts are stored separately, only on our server, and are not published. You can withdraw your consent at any time with effect for the future: write to us at the address above and we will remove you from the list, delete your name from the repository history as well and separate it from your amounts. Your amounts remain in the progress bar without a name. GitHub is a third-party service; what it processes about visitors of the repository is described in its privacy policy."],
  ["{ href: 'https://www.paypal.com/de/legalhub/privacy-full', text: 'Datenschutzerklärung von PayPal' }]", "{ href: 'https://www.paypal.com/de/legalhub/privacy-full', text: 'Datenschutzerklärung von PayPal' }, { href: 'https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement', text: 'Datenschutzerklärung von GitHub' }]"],
  ["{ href: 'https://www.paypal.com/uk/legalhub/privacy-full', text: 'PayPal privacy policy' }]", "{ href: 'https://www.paypal.com/uk/legalhub/privacy-full', text: 'PayPal privacy policy' }, { href: 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', text: 'GitHub privacy statement' }]"]
]);
ed('docs/PLAN.md', [["Gespeichert wird lokal in `data/lokal/unterstuetzung.json`, nicht im Daten-Repo.", "Die Unterstützer (Name, Abzeichen) liegen im Daten-Repo (`unterstuetzer.json`, jede Änderung ein Commit, Änderungen im Repo gelten nach „Aus dem Repo laden“); die Geldeingänge mit Beträgen bleiben lokal in `data/lokal/unterstuetzung.json`."]]);
ed('deploy/README.md', [["`data/lokal/` (Meldungen, Link-Status, Geldeingänge und Unterstützer)", "`data/lokal/` (Meldungen, Link-Status, Geldeingänge mit Beträgen)"]]);
ed('src/admin/Unterstuetzer.svelte', [["Auf der Seite stehen nur Name und die Abzeichen, die du hier auswählst (mehrere möglich). Beträge sind nur für dich sichtbar.", "Auf der Seite stehen nur Name und die Abzeichen, die du hier auswählst (mehrere möglich). Namen und Abzeichen werden ins öffentliche Daten-Repo geschrieben (Reiter „Protokoll und Repo“) und lassen sich dort auch ändern. Beträge bleiben auf dem Server und sind nur für dich sichtbar."]]);
