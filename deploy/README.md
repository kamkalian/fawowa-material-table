# Betrieb auf dem Server

Die Anwendungen laufen als Docker-Container hinter einem gemeinsamen Caddy. Nur Caddy ist von außen
erreichbar (Port 80 und 443), alle Anwendungen hängen im internen Docker-Netzwerk `caddy-net`.

## Aufbau auf dem Server

```
/srv/caddy/                      zentraler Reverse Proxy
    docker-compose.yml
    Caddyfile                    importiert sites/*.caddy
    sites/
        materialtabelle.caddy    eine Datei je Anwendung (Vorlage: *.caddy.example)
/srv/apps/
    materialtabelle/             diese Anwendung (Quellcode, docker-compose.yml, .env, data/)
    hauptseite/                  später: die Onepage-Startseite
```

- Ein Benutzer mit sudo-Rechten, in der Gruppe `docker`, Anmeldung nur per SSH-Schlüssel.
  Passwort-Anmeldung und Root-Login sind abgeschaltet.
- Firewall (ufw): erlaubt sind nur SSH (22), HTTP (80) und HTTPS (443, auch UDP für HTTP/3).
- fail2ban sperrt Adressen mit wiederholten SSH-Fehlversuchen. Sicherheitsupdates laufen automatisch
  (unattended-upgrades).
- Wichtig: Anwendungen dürfen keine Ports mit `ports:` veröffentlichen. Docker umgeht die Firewall (ufw)
  an dieser Stelle. Erreichbar sind sie nur über Caddy.

## Einmalige Einrichtung eines neuen Servers

1. **SSH-Schlüssel**: lokal `ssh-keygen -t ed25519`, den öffentlichen Teil in `~/.ssh/authorized_keys` des Admin-Benutzers
   auf dem Server eintragen. Vor dem nächsten Schritt prüfen, dass die Anmeldung mit dem Schlüssel klappt.
2. **SSH härten** in `/etc/ssh/sshd_config.d/00-hardening.conf` (der Name muss vor `50-cloud-init.conf` einsortiert werden,
   sonst gewinnt dessen `PasswordAuthentication yes`):

   ```
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PubkeyAuthentication yes
   AuthenticationMethods publickey
   AllowUsers <BENUTZER>
   MaxAuthTries 3
   LoginGraceTime 30
   X11Forwarding no
   ```

   Danach `sudo sshd -t && sudo systemctl reload ssh` und **in einem zweiten Terminal** testen, bevor die erste Sitzung
   geschlossen wird. Als Sicherheitsnetz hilft ein Zeitschalter, der die Datei wieder entfernt:
   `echo "rm -f /etc/ssh/sshd_config.d/00-hardening.conf; systemctl reload ssh" | sudo at now + 5 minutes`
   (nach erfolgreichem Test mit `sudo atrm <Nummer>` abbrechen).
3. **Firewall und fail2ban**: `sudo apt install ufw fail2ban`, dann `ufw default deny incoming`, `ufw allow 22/tcp`,
   `ufw allow 80/tcp`, `ufw allow 443/tcp`, `ufw allow 443/udp`, `ufw enable`.
4. **Docker** nach der offiziellen Anleitung installieren (mit Compose-Plugin), den Benutzer in die Gruppe `docker` aufnehmen.
5. **Netzwerk anlegen**: `docker network create caddy-net`
6. **Ordner**: `sudo mkdir -p /srv/caddy/sites /srv/apps/materialtabelle/data && sudo chown -R <BENUTZER>: /srv/caddy /srv/apps`
7. **Caddy**: `deploy/caddy/*` nach `/srv/caddy` kopieren, `sites/materialtabelle.caddy.example` nach
   `sites/materialtabelle.caddy` kopieren und die Domain eintragen, dann `docker compose up -d`.
8. **Anwendung**: `.env` in `/srv/apps/materialtabelle` anlegen (Vorlage `.env.example`: `ADMIN_PASSWORD_HASH`,
   `APP_UID`, `APP_GID` = Ausgabe von `id -u` und `id -g` des Admin-Benutzers). Danach mit dem Skript unten ausliefern.
   Eine vorhandene Datenbank wird als `data/material.db` abgelegt (sonst `docker compose run --rm fawowa node scripts/import-startdaten.js`).

## Die Materialdatenbank aktualisieren

Auf dem Entwicklungsrechner (Windows PowerShell):

```powershell
$env:FAWOWA_SERVER = '<SERVER-IP>'; $env:FAWOWA_USER = '<BENUTZER>'
.\deploy\deploy.ps1
```

Das Skript überträgt den Quellcode, baut das Image auf dem Server und startet den Container neu.
Die Daten (`data/material.db`), die `.env` und die Zertifikate bleiben unverändert. Mit `-NurBauen` wird nur
gebaut, der laufende Container bleibt unberührt.

## Admin-Zugang

Das Passwort steht nur als Hash in `/srv/apps/materialtabelle/.env` (`ADMIN_PASSWORD_HASH`).
Ändern: lokal `node scripts/admin-passwort.js` ausführen, die erzeugte Zeile `ADMIN_PASSWORD_HASH=...`
in die `.env` auf dem Server übernehmen und dort neu starten (`docker compose up -d --force-recreate`).

## Neue Anwendung (z. B. Hauptseite) hinzufügen

1. Ordner `/srv/apps/<name>/` mit eigener `docker-compose.yml` anlegen. Der Dienst hängt im externen Netzwerk
   `caddy-net` und veröffentlicht keine Ports.
2. In `/srv/caddy/sites/<name>.caddy` eintragen, unter welcher Adresse sie erreichbar ist
   (`reverse_proxy <containername>:<port>`).
3. Prüfen und neu laden:
   `cd /srv/caddy && docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`

## Domain und HTTPS

Jede Anwendung bekommt eine eigene Subdomain (Beispiel: die Materialdatenbank unter `materials.<DOMAIN>`).
Die Hauptdomain ist für die spätere Hauptseite vorgesehen; bis dahin leitet ihre Site-Datei per `redir ... temporary`
auf die Materialdatenbank weiter.

- Mit Domain: DNS-A-Eintrag auf die Server-IP setzen, in der Site-Datei die Domain als Adresse eintragen
  (ohne `tls internal`). Caddy holt das Zertifikat bei Let's Encrypt selbst.
- Cloudflare: Eintrag vom Typ A, Name = Subdomain, Inhalt = Server-IP, Proxy-Status **Nur DNS** (graue Wolke).
  So spricht Let's Encrypt direkt mit Caddy. Soll der Proxy (orange Wolke) an sein, dann SSL/TLS-Modus
  „Full (strict)“ wählen.
- Nur mit IP-Adresse: `tls internal`. Caddy stellt dann ein eigenes Zertifikat aus, der Browser zeigt eine Warnung.
  Der Admin-Bereich braucht HTTPS, weil das Sitzungs-Cookie als `Secure` gesetzt wird.

## Sicherung

Alles Wichtige steht in `/srv/apps/materialtabelle/data/` (Datenbank `material.db`) und `/srv/apps/materialtabelle/.env`.
Zusätzlich die Zertifikate im Docker-Volume `caddy_caddy_data`. Konsistente Kopie der Datenbank, auch während der
Betrieb läuft:

```bash
docker compose exec fawowa node -e "const D=require('better-sqlite3');new D('data/material.db').exec(\"VACUUM INTO '/app/data/sicherung.db'\")"
```

## Nützliche Befehle

```bash
cd /srv/apps/materialtabelle
docker compose ps                 # Zustand
docker compose logs -f --tail=100 # Protokoll
docker compose restart            # Neustart
sudo ufw status                   # Firewall
sudo fail2ban-client status sshd  # gesperrte Adressen
```
