import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Service worker para jugar sin internet: se genera al compilar con la lista exacta de archivos
      {
        name: 'cajal-service-worker',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
          if (!fs.existsSync(distDir)) return;
          const files: string[] = [];
          const walk = (dir: string) => {
            for (const f of fs.readdirSync(dir)) {
              const full = path.join(dir, f);
              if (fs.statSync(full).isDirectory()) walk(full);
              else files.push('/' + path.relative(distDir, full).split(path.sep).join('/'));
            }
          };
          walk(distDir);
          const precache = files.filter((f) => f !== '/sw.js' && f !== '/_headers' && !f.endsWith('.map'));
          const hash = crypto.createHash('sha256');
          for (const f of precache) hash.update(f + fs.statSync(path.join(distDir, f)).size);
          hash.update(fs.readFileSync(path.join(distDir, 'index.html')));
          const template = fs.readFileSync(path.resolve(__dirname, 'sw-template.js'), 'utf8');
          const sw = template
            .replace('__CACHE_NAME__', 'cajal-' + hash.digest('hex').slice(0, 12))
            .replace('__PRECACHE__', JSON.stringify(['/', ...precache], null, 0));
          fs.writeFileSync(path.join(distDir, 'sw.js'), sw);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
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
