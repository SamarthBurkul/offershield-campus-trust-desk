'use strict';

const { config } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { app } = require('./app');

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

  function shutdown(signal) {
    console.log(`[server] ${signal} received, closing HTTP server`);
    server.close(() => {
      disconnectDB().finally(() => process.exit(0));
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
