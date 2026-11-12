'use strict';

const studentService = require('../services/student.service');
const staffService = require('../services/staff.service');

const actorOf = (req) => ({ id: req.user.id, role: req.user.role, collegeId: req.user.collegeId });

async function listStudents(req, res) {
  res.status(200).json(await studentService.listStudents(req.user, req.validatedQuery));
}

async function approve(req, res) {
  res.status(200).json({ student: await studentService.approve(req.user, req.params.id, { ip: req.ip }) });
}

async function reject(req, res) {
  res.status(200).json({ student: await studentService.reject(req.user, req.params.id, req.body, { ip: req.ip }) });
}

async function bulkApprove(req, res) {
  res.status(200).json(await studentService.bulkApprove(req.user, req.body.ids, { ip: req.ip }));
}

async function setStatus(req, res) {
  res.status(200).json({ student: await studentService.setStatus(req.user, req.params.id, req.body.status, { ip: req.ip }) });
}

async function resetPassword(req, res) {
  res.status(200).json(await staffService.resetPassword(actorOf(req), req.tenant, req.params.id, { ip: req.ip }));
}

module.exports = { listStudents, approve, reject, bulkApprove, setStatus, resetPassword };
