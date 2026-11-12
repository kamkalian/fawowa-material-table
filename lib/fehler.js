// Fehler, die dem Benutzer als Meldung angezeigt werden (Status 400, 404, 409 ...)
export class FehlerEingabe extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
