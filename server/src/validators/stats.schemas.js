'use strict';

const { z } = require('./common');

const statsQuerySchema = z
  .object({
    from: z.coerce.date({ error: 'must be a valid date' }).optional(),
    to: z.coerce.date({ error: 'must be a valid date' }).optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, { error: 'from must be before to' });

module.exports = { statsQuerySchema };
