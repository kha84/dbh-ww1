// Vite: dev server (npm run dev) and production build into dist/ (npm run build, served by server.py).
// The dev server also answers the room mailbox of the network game (/api/...), like server.py does.
import { defineConfig } from 'vite';

const ROOMS = new Map();              // "CODE/slot" -> { t, text }
const TTL = 3600e3, MAX_BODY = 64 * 1024;
const ROUTE = /^\/api\/room\/([A-Za-z0-9]{3,12})\/(offer|answer)$/;

function mailbox() {
  return {
    name: 'dbh-mailbox',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!path.startsWith('/api/')) return next();
        const reply = (code, text = '') => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(text);
        };
        if (path === '/api/ping') return reply(200, 'dbh');
        const m = ROUTE.exec(path);
        if (!m) return reply(404);
        const key = `${m[1].toUpperCase()}/${m[2]}`;
        if (req.method === 'GET') {
          const it = ROOMS.get(key);
          return it && it.text ? reply(200, it.text) : reply(404);
        }
        if (req.method !== 'POST') return reply(405);
        let body = '';
        req.on('data', c => { body += c; if (body.length > MAX_BODY) req.destroy(); });
        req.on('end', () => {
          const now = Date.now();
          for (const [k, it] of ROOMS) if (now - it.t > TTL) ROOMS.delete(k);
          ROOMS.set(key, { t: now, text: body });
          reply(200, 'ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [mailbox()],
  // one copy of three.js for everything: the WebGPU build (WebGPURenderer, node materials, TSL)
  resolve: { alias: [{ find: /^three$/, replacement: 'three/webgpu' }] },
  server: { host: true, port: 8000 },
  preview: { host: true, port: 8000 },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
