'use strict';

const { version } = require('../../package.json');
const { config } = require('../config/env');
const { getDatabaseStatus } = require('../config/db');
const { POLICIES_VERSION } = require('../constants/policies');

function getHealth(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'offershield-api',
    version,
    commit: config.commit,
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: getDatabaseStatus(),
  });
}

/** Readiness for the platform health check: 503 until MongoDB is connected. */
function getReady(_req, res) {
  const database = getDatabaseStatus();
  res.status(database === 'connected' ? 200 : 503).json({ status: database === 'connected' ? 'ready' : 'unavailable', database });
}

/** Public facts the privacy notice and terms pages display (no secrets). */
function createPoliciesHandler(appConfig) {
  return function getPolicies(_req, res) {
    res.status(200).json({
      version: POLICIES_VERSION,
      retentionMonths: appConfig.retentionMonths,
      supportEmail: appConfig.supportEmail,
      // Sign-in options the client shows (booleans only).
      googleEnabled: Boolean(appConfig.google?.enabled),
      emailEnabled: Boolean(appConfig.email && (appConfig.email.provider === 'brevo' || !appConfig.isProduction)),
    });
  };
}

module.exports = { getHealth, getReady, createPoliciesHandler };
