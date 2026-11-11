'use strict';

const { z } = require('./common');

const notificationListQuerySchema = z
  .object({
    unread: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

module.exports = { notificationListQuerySchema };
