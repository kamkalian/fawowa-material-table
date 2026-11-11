import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { adminPfad } from './lib/pfade.js';

export default defineConfig(({ mode }) => {
  // ADMIN_PATH steht in .env; Vite lädt sie nicht von selbst in process.env
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };

  return {
    root: '.',
    plugins: [
      svelte(),
      {
        // In der Entwicklung den Fantasiepfad des Admin-Bereichs auf admin.html abbilden
        name: 'admin-pfad',
        configureServer(server) {
          const pfad = adminPfad(env);
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.split('?')[0].replace(/\/$/, '') === pfad) req.url = '/admin.html';
            next();
          });
        }
      }
    ],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          admin: resolve(__dirname, 'admin.html'),
        }
      }
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3456'
      }
    }
  };
});
