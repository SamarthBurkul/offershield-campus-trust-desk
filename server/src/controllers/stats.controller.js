'use strict';

const statsService = require('../services/stats.service');

function createStatsController(config) {
  return {
    async getStats(req, res) {
      res.status(200).json({ stats: await statsService.getStats(req.user, req.validatedQuery, { staleDays: config.caseStaleDays }) });
    },
  };
}

module.exports = { createStatsController };
