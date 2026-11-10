'use strict';

const caseService = require('../services/case.service');

async function createCase(req, res) {
  res.status(201).json({ case: await caseService.createCase(req.user, req.body, { ip: req.ip }) });
}

async function listMyCases(req, res) {
  res.status(200).json(await caseService.listMyCases(req.user, req.validatedQuery));
}

async function getCase(req, res) {
  res.status(200).json(await caseService.getCaseForStudent(req.user, req.params.id));
}

async function addMessage(req, res) {
  res.status(201).json(await caseService.addStudentMessage(req.user, req.params.id, req.body, { ip: req.ip }));
}

module.exports = { createCase, listMyCases, getCase, addMessage };
