// Dünne Hülle um das Programm "git" für das Daten-Repository (Arbeitsverzeichnis mit den Materialdateien).
// Lokale Schritte (commit, reset, merge) laufen synchron, damit sich Änderungen nicht überholen.
// Netzwerkschritte (fetch, push) laufen asynchron. Ohne Remote bleibt alles lokal.

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MAX_AUSGABE = 4 * 1024 * 1024;

export class Git {
  /**
   * verzeichnis: Arbeitsverzeichnis; remote: URL (oder Pfad) des Repos oder null; zweig: Name des Zweigs
   * schluessel / bekannteHosts: Pfade für SSH (Deploy-Key); autor: { name, email } für Commits
   */
  constructor({ verzeichnis, remote = null, zweig = 'main', schluessel = null, bekannteHosts = null, autor = {} }) {
    this.verzeichnis = verzeichnis;
    this.remote = remote || null;
    this.zweig = zweig;
    this.autor = { name: autor.name || 'Materialdatenbank', email: autor.email || 'materialdatenbank@localhost' };
    this.pushFehler = null;
    this._pushLaeuft = false;
    this._pushTimer = null;

    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1' };
    if (schluessel) {
      const hosts = bekannteHosts ? `-o UserKnownHostsFile="${bekannteHosts}" -o StrictHostKeyChecking=yes` : '-o StrictHostKeyChecking=accept-new';
      env.GIT_SSH_COMMAND = `ssh -i "${schluessel}" -o IdentitiesOnly=yes ${hosts}`;
    }
    this._env = env;
  }

  get _grundArgumente() {
    return [
      '-c', `safe.directory=${this.verzeichnis}`,
      '-c', 'core.autocrlf=false',
      '-c', `user.name=${this.autor.name}`,
      '-c', `user.email=${this.autor.email}`,
      '-c', 'commit.gpgsign=false'
    ];
  }

  _sync(args, { erlaubeFehler = false } = {}) {
    try {
      return execFileSync('git', [...this._grundArgumente, ...args], {
        cwd: this.verzeichnis, env: this._env, encoding: 'utf8', maxBuffer: MAX_AUSGABE, stdio: ['ignore', 'pipe', 'pipe']
      }).trim();
    } catch (e) {
      if (erlaubeFehler) return null;
      throw new Error(`git ${args[0]} fehlgeschlagen: ${String(e.stderr || e.message).trim()}`);
    }
  }

  _async(args) {
    return new Promise((resolve, reject) => {
      execFile('git', [...this._grundArgumente, ...args], {
        cwd: this.verzeichnis, env: this._env, encoding: 'utf8', maxBuffer: MAX_AUSGABE, timeout: 60_000
      }, (fehler, stdout, stderr) => {
        if (fehler) reject(new Error(String(stderr || fehler.message).trim()));
        else resolve(String(stdout).trim());
      });
    });
  }

  /** Legt das Arbeitsverzeichnis an: klonen, wenn ein Remote gesetzt und das Verzeichnis leer ist, sonst neu anlegen. */
  bereitstellen() {
    mkdirSync(this.verzeichnis, { recursive: true });
    if (!existsSync(join(this.verzeichnis, '.git'))) {
      if (this.remote && readdirSync(this.verzeichnis).length === 0) {
        this._sync(['clone', this.remote, '.']);
      } else {
        this._sync(['init']);
      }
    }
    // Zweig und Remote sicherstellen
    this._sync(['symbolic-ref', 'HEAD', `refs/heads/${this.zweig}`], { erlaubeFehler: true });
    if (this.remote) {
      const aktuell = this._sync(['remote', 'get-url', 'origin'], { erlaubeFehler: true });
      if (aktuell === null) this._sync(['remote', 'add', 'origin', this.remote]);
      else if (aktuell !== this.remote) this._sync(['remote', 'set-url', 'origin', this.remote]);
    }
  }

  /** Alles Geänderte committen. Gibt false zurück, wenn es nichts zu committen gab. */
  commit(nachricht) {
    this._sync(['add', '-A']);
    const aenderungen = this._sync(['status', '--porcelain']);
    if (!aenderungen) return false;
    this._sync(['commit', '-q', '-m', nachricht]);
    return true;
  }

  kopf() {
    return this._sync(['rev-parse', '--verify', '-q', 'HEAD'], { erlaubeFehler: true });
  }

  /** Setzt Arbeitsverzeichnis und Zweig hart auf einen Stand zurück (nach einem fehlgeschlagenen Pull). */
  zuruecksetzen(stand) {
    if (stand) {
      this._sync(['reset', '--hard', '-q', stand]);
    } else {
      this._sync(['update-ref', '-d', 'HEAD'], { erlaubeFehler: true });
      this._sync(['rm', '-r', '-f', '-q', '--cached', '--ignore-unmatch', '.'], { erlaubeFehler: true });
      this._sync(['clean', '-fdq']);
    }
  }

  _remoteZweig() {
    return this._sync(['rev-parse', '--verify', '-q', `refs/remotes/origin/${this.zweig}`], { erlaubeFehler: true });
  }

  /** Anzahl der Commits, die lokal fehlen (behind) bzw. noch nicht im Repo sind (ahead) */
  abstand() {
    if (!this.remote) return { ahead: 0, behind: 0 };
    const kopf = this.kopf();
    const gegenueber = this._remoteZweig();
    if (!gegenueber) return { ahead: kopf ? Number(this._sync(['rev-list', '--count', 'HEAD'])) : 0, behind: 0 };
    if (!kopf) return { ahead: 0, behind: Number(this._sync(['rev-list', '--count', gegenueber])) };
    const [ahead, behind] = this._sync(['rev-list', '--left-right', '--count', `HEAD...${gegenueber}`]).split(/\s+/).map(Number);
    return { ahead, behind };
  }

  async holen() {
    if (!this.remote) return;
    await this._async(['fetch', '--prune', 'origin']);
  }

  /** Übernimmt neue Commits des Repos, nur wenn sich der Verlauf geradlinig fortsetzt. */
  vorspulen() {
    const ziel = `refs/remotes/origin/${this.zweig}`;
    if (this.kopf()) this._sync(['merge', '--ff-only', '-q', ziel]);
    else this._sync(['checkout', '-f', '-q', '-B', this.zweig, ziel]); // lokal noch leer: Stand des Repos übernehmen
  }

  /** Sendet lokale Commits an das Repo. Fehler werden gemerkt und in status() gemeldet. */
  async senden() {
    if (!this.remote) return { ok: true };
    if (this._pushLaeuft) return { ok: false, grund: 'laeuft' };
    this._pushLaeuft = true;
    try {
      await this._async(['push', 'origin', `HEAD:refs/heads/${this.zweig}`]);
      this.pushFehler = null;
      return { ok: true };
    } catch (e) {
      const text = e.message;
      this.pushFehler = /rejected|non-fast-forward|fetch first/i.test(text)
        ? 'Im Repo liegen neuere Änderungen. Bitte zuerst „Aus dem Repo laden“.'
        : `Senden fehlgeschlagen: ${text.split('\n').slice(-2).join(' ').slice(0, 300)}`;
      return { ok: false, grund: this.pushFehler };
    } finally {
      this._pushLaeuft = false;
    }
  }

  /** Sendet gesammelt kurz nach der letzten Änderung (damit mehrere Änderungen in einem Zug rausgehen). */
  sendenPlanen(verzoegerungMs = 3000) {
    if (!this.remote) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => { this.senden().catch(() => {}); }, verzoegerungMs);
    this._pushTimer.unref?.();
  }

  status() {
    let abstand = { ahead: 0, behind: 0 };
    try { abstand = this.abstand(); } catch { /* ohne Vergleich bleibt es bei 0 */ }
    return { remote: !!this.remote, zweig: this.zweig, ...abstand, pushFehler: this.pushFehler, kopf: this.kopf()?.slice(0, 8) ?? null };
  }

  /** Letzte Commits: [{ id, zeitpunkt, betreff, text }] */
  verlauf(limit = 100) {
    if (!this.kopf()) return [];
    const roh = this._sync(['log', `-n${Math.max(1, Math.min(Math.floor(Number(limit)) || 100, 500))}`, '--pretty=format:%h%x1f%aI%x1f%s%x1f%b%x1e']);
    return roh.split('\x1e').map(z => z.replace(/^\n/, '')).filter(Boolean).map(z => {
      const [id, zeitpunkt, betreff, text] = z.split('\x1f');
      return { id, zeitpunkt, betreff, text: (text ?? '').trim() };
    });
  }
}
