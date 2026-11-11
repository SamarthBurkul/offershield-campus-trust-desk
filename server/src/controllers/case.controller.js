'use strict';

const caseService = require('../services/case.service');

function createCaseController(config) {
  const options = (req) => ({ ip: req.ip, simhashMaxDistance: config.simhashMaxDistance });

  return {
    async createCase(req, res) {
      res.status(201).json({ case: await caseService.createCase(req.user, req.body, options(req)) });
    },

    async listMyCases(req, res) {
      res.status(200).json(await caseService.listMyCases(req.user, req.validatedQuery));
    },

    async getCase(req, res) {
      res.status(200).json(await caseService.getCaseForStudent(req.user, req.params.id));
    },

    async addMessage(req, res) {
      res.status(201).json(await caseService.addStudentMessage(req.user, req.params.id, req.body, options(req)));
    },
  };
}

module.exports = { createCaseController };
