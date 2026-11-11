'use strict';

const { z } = require('./common');

const lookupQuerySchema = z.object({ q: z.string().trim().min(3).max(200) }).strict();

module.exports = { lookupQuerySchema };
