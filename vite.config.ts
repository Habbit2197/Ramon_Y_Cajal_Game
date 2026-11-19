import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {defineConfig} from 'vite';

/**
 * Ruta en la que se publica el juego dentro del archivo: https://santiagoramonycajal.org/juegos/<slug>/
 * Se puede cambiar al compilar: BASE_PATH=/otra/ruta/ npm run build  (debe empezar y acabar en «/»)
 */
const BASE = process.env.BASE_PATH ?? '/juegos/cajal-sinapsis/';
/** Prefijo propio de las cachés: otros juegos del mismo dominio no se tocan entre sí */
const CACHE_PREFIX = 'cajal-sinapsis-';

export default defineConfig(() => {
  return {
    base: BASE,
    plugins: [
      react(),
      tailwindcss(),
      // Service worker para jugar sin internet: se genera al compilar con la lista exacta de archivos
      {
        name: 'cajal-service-worker',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(import.meta.dirname, 'dist');
          if (!fs.existsSync(distDir)) return;
          const files: string[] = [];
          const walk = (dir: string) => {
            for (const f of fs.readdirSync(dir)) {
              const full = path.join(dir, f);
              if (fs.statSync(full).isDirectory()) walk(full);
              else files.push(path.relative(distDir, full).split(path.sep).join('/'));
            }
          };
          walk(distDir);
          const precache = files.filter((f) => f !== 'sw.js' && f !== '_headers' && !f.endsWith('.map'));
          const hash = crypto.createHash('sha256');
          for (const f of precache) hash.update(f + fs.statSync(path.join(distDir, f)).size);
          hash.update(fs.readFileSync(path.join(distDir, 'index.html')));
          const template = fs.readFileSync(path.resolve(import.meta.dirname, 'sw-template.js'), 'utf8');
          const sw = template
            .replaceAll('__CACHE_PREFIX__', CACHE_PREFIX)
            .replaceAll('__CACHE_NAME__', CACHE_PREFIX + hash.digest('hex').slice(0, 12))
            .replaceAll('__BASE__', BASE)
            .replaceAll('__PRECACHE__', JSON.stringify([BASE, ...precache.map((f) => BASE + f)], null, 0));
          fs.writeFileSync(path.join(distDir, 'sw.js'), sw);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
