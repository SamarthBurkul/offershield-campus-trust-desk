'use strict';

const { randomUUID } = require('node:crypto');

// A proxy-supplied id (Render sends one) is kept only if it is short and plain, so it is safe to log.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Give every request an id, expose it as X-Request-Id, and use it to correlate log lines. */
function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };
