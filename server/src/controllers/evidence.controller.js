'use strict';

const evidenceService = require('../services/evidence.service');

function createEvidenceController(config) {
  return {
    /** Runs before multer, so non-owners and closed cases are refused before any file is buffered. */
    async checkUploadAllowed(req, _res, next) {
      await evidenceService.assertUploadAllowed(req.user, req.params.id);
      next();
    },

    async upload(req, res) {
      const evidence = await evidenceService.uploadEvidence(req.user, req.params.id, req.files, { ip: req.ip });
      res.status(201).json({ evidence });
    },

    async createLink(req, res) {
      res.status(200).json(await evidenceService.createEvidenceLink(req.user, req.params.id, req.params.evidenceId, config));
    },
  };
}

module.exports = { createEvidenceController };
