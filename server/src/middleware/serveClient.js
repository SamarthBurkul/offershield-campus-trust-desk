'use strict';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const IMMUTABLE = 'public, max-age=31536000, immutable';

/**
 * Production only: serve the built React client (client/dist) from the API service.
 * Hashed files under /assets are cached for a year; index.html is always revalidated, and any other
 * GET that accepts HTML (a deep link such as /staff/cases/123) gets index.html for the SPA router.
 * /api paths are never handled here, so unknown API routes still get the JSON 404.
 * @param {string} distDir absolute path to the built client
 */
function createClientRouter(distDir) {
  const router = express.Router();
  const indexFile = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexFile)) {
    console.warn('[server] client build not found; run "npm run build" before "npm start"');
    return router;
  }

  const sendIndex = (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile);
  };

  router.use(
    '/assets',
    express.static(path.join(distDir, 'assets'), {
      index: false,
      setHeaders: (res) => res.setHeader('Cache-Control', IMMUTABLE),
    }),
  );
  // A missing hashed asset is a plain 404, never index.html (that would be cached as JavaScript).
  router.use('/assets', (_req, res) => res.status(404).type('text/plain').send('Not found'));
  router.get(['/', '/index.html'], sendIndex);
  // Other top-level files (favicon.svg, ...): short cache, revalidated.
  router.use(express.static(distDir, { index: false, maxAge: '1h' }));
  router.get(/^\/(?!api(?:\/|$)).*/, (req, res, next) => (req.accepts('html') ? sendIndex(req, res) : next()));

  return router;
}

module.exports = { createClientRouter };
