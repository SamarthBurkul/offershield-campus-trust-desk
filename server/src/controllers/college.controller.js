'use strict';

const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');

async function getMyCollege(req, res) {
  const college = await authService.getCollegeSummary(req.tenant.collegeId);
  if (!college) throw new AppError(404, 'NOT_FOUND', 'College not found');
  const { name, code, branches } = college;
  res.status(200).json({ college: { name, code, branches } });
}

module.exports = { getMyCollege };
