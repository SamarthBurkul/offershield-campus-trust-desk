'use strict';

let config;
try {
  ({ config } = require('./config/env'));
} catch (err) {
  // Refuse to start on invalid configuration. The message names keys and rules, never values.
  if (err && err.name === 'ConfigError') {
    console.error(`[server] refusing to start: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
const { connectDB, disconnectDB } = require('./config/db');
const { app } = require('./app');

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  try {
    await connectDB(config.mongodbUri);
  } catch (err) {
    // Never print the connection string; the driver error name is enough to diagnose.
    console.error(`[server] could not connect to MongoDB (${err && err.name}); exiting`);
    process.exit(1);
  }
  console.log('[server] connected to MongoDB');

  const server = app.listen(config.port, () => {
    console.log(`[server] offershield-api listening on port ${config.port} (${config.nodeEnv})`);
  });

  let stopping = false;
  function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    console.log(`[server] ${signal} received, closing HTTP server`);
    // Stop accepting connections, let in-flight requests finish, then release the database.
    server.close(() => {
      disconnectDB()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
    server.closeIdleConnections?.();
    // Keep-alive or stuck requests must not block a platform restart forever.
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
