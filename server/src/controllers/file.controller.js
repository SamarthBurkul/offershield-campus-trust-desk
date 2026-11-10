'use strict';

const evidenceService = require('../services/evidence.service');

function createFileController(config) {
  return {
    async download(req, res, next) {
      const file = await evidenceService.openEvidenceDownload(req.user, req.params.token, config, { ip: req.ip });
      const disposition = file.mime === 'application/pdf' ? 'attachment' : 'inline';

      res.status(200);
      res.setHeader('Content-Type', file.mime);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader('Content-Disposition', `${disposition}; filename="${file.originalName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      // Overrides helmet's page CSP: the file is rendered with no scripts, forms or same-origin access.
      res.setHeader('Content-Security-Policy', 'sandbox');

      file.stream.once('error', (err) => {
        if (res.headersSent) res.destroy(err);
        else next(err);
      });
      file.stream.pipe(res);
    },
  };
}

module.exports = { createFileController };
