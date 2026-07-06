# ---- Build Stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install all dependencies (including devDependencies for vite build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files and build
COPY vite.config.js ./
COPY index.html admin.html ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy built frontend from build stage
COPY --from=build /app/dist ./dist

# Copy server and data directory
COPY server.js ./
COPY data/ ./data/

# Ensure data directory exists and has placeholder files if empty
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3456

EXPOSE 3456

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

CMD ["node", "server.js"]
