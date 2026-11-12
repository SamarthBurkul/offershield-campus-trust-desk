'use strict';

const adminService = require('../services/admin.service');

const actorOf = (req) => ({ id: req.user.id, role: req.user.role });

async function createCollege(req, res) {
  res.status(201).json(await adminService.createCollege(actorOf(req), req.body, { ip: req.ip }));
}

async function listColleges(_req, res) {
  res.status(200).json({ colleges: await adminService.listColleges() });
}

async function getCollege(req, res) {
  res.status(200).json({ college: await adminService.getCollege(req.params.id) });
}

async function updateCollege(req, res) {
  const college = await adminService.updateCollege(actorOf(req), req.params.id, req.body, { ip: req.ip });
  res.status(200).json({ college });
}

async function rotateJoinCode(req, res) {
  res.status(200).json(await adminService.rotateJoinCode(actorOf(req), req.params.id, { ip: req.ip }));
}

async function createTpoHead(req, res) {
  res.status(201).json(await adminService.createTpoHead(actorOf(req), req.params.id, req.body, { ip: req.ip }));
}

async function listCollegeStaff(req, res) {
  res.status(200).json({ staff: await adminService.listCollegeStaff(req.params.id) });
}

async function resetTpoHeadPassword(req, res) {
  res.status(200).json(await adminService.resetTpoHeadPassword(actorOf(req), req.params.id, { ip: req.ip }));
}

module.exports = { createCollege, listColleges, getCollege, updateCollege, rotateJoinCode, createTpoHead, listCollegeStaff, resetTpoHeadPassword };
