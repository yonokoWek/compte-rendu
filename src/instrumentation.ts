// Next.js instrumentation - runs once at server startup (Node.js runtime only)
// This adds global error handlers to prevent process crashes on Render.com

export async function register() {
  // Prevent unhandled rejections from crashing the process
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('unhandledRejection', (reason: unknown) => {
      console.error('[INSTRUMENTATION] Unhandled rejection caught:', reason);
    });

    process.on('uncaughtException', (err: Error) => {
      console.error('[INSTRUMENTATION] Uncaught exception caught:', err);
    });
  }
}
