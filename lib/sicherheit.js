// Sicherheits-Header und Fehlerbehandlung für alle Antworten der Anwendung.
// Caddy setzt davor schon einige Header (nosniff, X-Frame-Options, HSTS); die Anwendung setzt sie selbst ebenfalls, damit sie auch
// ohne Caddy (Entwicklung, Tests, andere Betriebsarten) gelten, und ergänzt die Content-Security-Policy.

// Die Oberfläche lädt nur eigene Dateien. Inline-Skripte sind nicht erlaubt; Inline-Styles werden nur für Größenangaben genutzt
// (Svelte setzt sie über die DOM-Schnittstelle, das ist von der Policy nicht betroffen).
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export function sicherheitsHeader(req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Antworten des Admin-Bereichs (auch Fehlermeldungen) dürfen nirgends zwischengespeichert werden
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/v2/formular-token') || req.path.startsWith('/api/v2/meldungen')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

/** Fehler als JSON (z. B. kaputtes JSON im Body, zu große Anfrage) statt der Standardseite von Express; keine Interna nach außen */
// eslint-disable-next-line no-unused-vars
export function fehlerAntwort(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  const text = status === 413 ? 'Die Anfrage ist zu groß.' : status === 500 ? 'Interner Fehler' : 'Ungültige Anfrage';
  res.status(status).json({ error: text });
}
