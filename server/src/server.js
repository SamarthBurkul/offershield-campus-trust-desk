'use strict';

const { config } = require('./config/env');
const { app } = require('./app');

const server = app.listen(config.port, () => {
  console.log(`[server] offershield-api listening on port ${config.port} (${config.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`[server] ${signal} received, closing HTTP server`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
