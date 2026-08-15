// Next.js instrumentation - runs once at server startup
// This adds global error handlers to prevent process crashes on Render.com

export async function register() {
  // Prevent unhandled rejections from crashing the process
  process.on('unhandledRejection', (reason: unknown, promise: unknown) => {
    console.error('[INSTRUMENTATION] Unhandled rejection caught (process will NOT crash):', reason);
    // Don't re-throw - let the application continue running
  });

  // Prevent uncaught exceptions from crashing the process
  process.on('uncaughtException', (err: Error) => {
    console.error('[INSTRUMENTATION] Uncaught exception caught (process will NOT crash):', err);
    // Don't re-throw - let the application continue running
  });
}
