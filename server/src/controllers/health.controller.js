'use strict';

const { version } = require('../../package.json');
const { config } = require('../config/env');

function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'offershield-api',
    version,
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: 'not_configured',
  });
}

module.exports = { getHealth };
