'use strict';

const staffService = require('../services/staff.service');

const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

async function listMembers(req, res) {
  res.status(200).json({ staff: await staffService.listStaff(req.tenant.collegeId) });
}

async function createOfficer(req, res) {
  res.status(201).json(await staffService.createOfficer(actorOf(req), req.tenant, req.body, { ip: req.ip }));
}

async function setOfficerStatus(req, res) {
  const user = await staffService.setOfficerStatus(actorOf(req), req.tenant, req.params.id, req.body.status, {
    ip: req.ip,
  });
  res.status(200).json({ user });
}

module.exports = { listMembers, createOfficer, setOfficerStatus };
