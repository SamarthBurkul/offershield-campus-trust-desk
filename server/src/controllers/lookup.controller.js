'use strict';

const lookupService = require('../services/lookup.service');

async function lookup(req, res) {
  res.status(200).json(await lookupService.lookup(req.user, req.validatedQuery));
}

module.exports = { lookup };
