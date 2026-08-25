import { createServer } from 'http';
import next from 'next';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = false;

const app = next({ dev, hostname: '0.0.0.0', port });
const handle = app.getRequestHandler();

console.log(`[SERVER] Starting custom server on port ${port}...`);

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Built-in health check - no Next.js overhead, no DB dependency
      if (req.url === '/api/health' || req.url?.startsWith('/api/health?')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
        return;
      }

      // Everything else goes to Next.js
      await handle(req, res);
    } catch (err) {
      console.error('[SERVER] Error handling request:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      }
    }
  }).listen(port, '0.0.0.0', () => {
    console.log(`[SERVER] Ready on http://0.0.0.0:${port}`);
  });
});

// Prevent process from crashing on unhandled errors
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception:', err);
});
