'use strict';

const auditQueryService = require('../services/auditQuery.service');

async function listAudit(req, res) {
  res.status(200).json(await auditQueryService.listAuditEntries(req.user, req.validatedQuery));
}

module.exports = { listAudit };
