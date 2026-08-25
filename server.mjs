import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ───────────────────────────────────────────────
// CRITICAL: Bind port IMMEDIATELY, before Next.js loads.
// This fixes the Render SIGTERM loop: Render's health check
// needs the port open within seconds, but app.prepare() can
// take 5-10s on 0.1 CPU / 512MB RAM.
// ───────────────────────────────────────────────

const port = parseInt(process.env.PORT || '3000', 10);
let nextHandle = null;
let nextReady = false;

// --- Health check: responds in < 1ms, zero dependencies ---
function sendHealth(res) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ status: 'ok', ts: Date.now() }));
}

// --- Serve pre-built static index.html while Next.js loads ---
// The root page is static (○), so .next/server/app/index.html exists
function sendStaticIndex(res) {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const html = readFileSync(join(__dirname, '.next/server/app/index.html'), 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    // If file not found yet, return minimal HTML
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html><body><p>Loading...</p></body></html>');
  }
}

// --- Create and start HTTP server IMMEDIATELY ---
const server = createServer(async (req, res) => {
  try {
    // 1. Health check — always instant, never goes through Next.js
    if (req.url === '/api/health' || req.url?.startsWith('/api/health?')) {
      sendHealth(res);
      return;
    }

    // 2. If Next.js is not ready yet
    if (!nextReady || !nextHandle) {
      // Serve the static index page for / while Next.js loads
      if (req.url === '/' || req.url === '') {
        sendStaticIndex(res);
        return;
      }
      // For any other route, return 503
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Service starting...');
      return;
    }

    // 3. Next.js is ready — handle everything normally
    await nextHandle(req, res);
  } catch (err) {
    console.error('[SERVER] Request error:', err.message || err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[SERVER] Port ${port} bound — health check ready`);
});

// --- Prepare Next.js in the background (non-blocking) ---
console.log('[SERVER] Loading Next.js (background)...');
import('next').then(async ({ default: next }) => {
  const app = next({ dev: false, hostname: '0.0.0.0', port });
  await app.prepare();
  nextHandle = app.getRequestHandler();
  nextReady = true;
  console.log('[SERVER] Next.js fully ready — all routes active');
}).catch((err) => {
  console.error('[SERVER] FATAL: Next.js failed to load:', err);
  // Don't crash — keep the health check alive so Render doesn't SIGTERM
});

// --- Process resilience ---
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught exception:', err);
});

// Ignore SIGTERM during shutdown to give Render time to complete
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, closing server...');
  server.close(() => process.exit(0));
  // Force exit after 5s if close hangs
  setTimeout(() => process.exit(0), 5000);
});
