'use strict';

const { version } = require('../../package.json');
const { config } = require('../config/env');
const { getDatabaseStatus } = require('../config/db');

function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'offershield-api',
    version,
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus(),
  });
}

module.exports = { getHealth };
