'use strict';

const { z } = require('./common');
const { createStaffSchema } = require('./admin.schemas');
const { USER_STATUSES } = require('../models/User');

const createOfficerSchema = createStaffSchema;

const officerStatusSchema = z.object({ status: z.enum(USER_STATUSES) }).strict();

module.exports = { createOfficerSchema, officerStatusSchema };
