# ---- Build-Stufe: Abhängigkeiten installieren und Oberfläche bauen ----
# Keine nativen Module mehr: der Build braucht keine Compiler.
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js index.html admin.html ./
COPY src/ ./src/
COPY lib/ ./lib/
RUN npm run build

# Nur Laufzeit-Abhängigkeiten behalten
RUN npm prune --omit=dev

# ---- Laufzeit-Stufe ----
FROM node:22-bookworm-slim

# git und ssh: die Daten liegen in einem Git-Repository (Abgleich über SSH mit einem Deploy-Key)
RUN apt-get update \
 && apt-get install -y --no-install-recommends git openssh-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3456

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json server.js ./
COPY lib/ ./lib/
COPY scripts/ ./scripts/

# Die Daten (Git-Arbeitsverzeichnis, lokale Dateien, SSH-Schlüssel) liegen im Volume ./data; es gehört dem unprivilegierten Benutzer "node" (uid 1000)
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3456/api/v2/kategorien').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
