'use strict';

const writeLine = (line) => process.stdout.write(`${line}\n`);

/**
 * One JSON line per request: { t, requestId, method, path, status, ms, uid? }.
 * `path` never includes the query string (lookup queries are personal data), and bodies, headers,
 * cookies and tokens are never logged.
 * @param {{ sink?: (line: string) => void }} [options]
 */
function createRequestLogger({ sink = writeLine } = {}) {
  return function requestLogger(req, res, next) {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const entry = {
        t: new Date().toISOString(),
        requestId: req.id,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status: res.statusCode,
        ms: Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10,
      };
      if (req.user?.id) entry.uid = req.user.id;
      sink(JSON.stringify(entry));
    });
    next();
  };
}

module.exports = { createRequestLogger };
